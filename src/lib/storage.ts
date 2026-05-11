import { downloadFile, resolveImages } from './utils'

// Minimal type declarations for File System Access API
// (not yet in all TypeScript lib.dom.d.ts versions)
declare global {
  interface Window {
    showOpenFilePicker?: (options?: {
      types?: Array<{ description?: string; accept: Record<string, string[]> }>
      multiple?: boolean
      excludeAcceptAllOption?: boolean
    }) => Promise<FileSystemFileHandle[]>
    showSaveFilePicker?: (options?: {
      suggestedName?: string
      types?: Array<{ description?: string; accept: Record<string, string[]> }>
      excludeAcceptAllOption?: boolean
    }) => Promise<FileSystemFileHandle>
  }

  interface FileSystemFileHandle {
    getFile(): Promise<File>
    createWritable(): Promise<FileSystemWritableFileStream>
  }

  interface FileSystemWritableFileStream {
    write(data: string | Blob | ArrayBuffer | ArrayBufferView): Promise<void>
    close(): Promise<void>
  }
}

export interface FileEntry {
  name: string
  handle?: FileSystemFileHandle
}

export interface StorageProvider {
  openFile(): Promise<{ name: string; content: string; handle?: FileSystemFileHandle } | null>
  saveFile(content: string, suggestedName: string, existingHandle?: FileSystemFileHandle): Promise<{ name: string; handle?: FileSystemFileHandle } | null>
  saveAsFile(content: string, suggestedName: string): Promise<{ name: string; handle?: FileSystemFileHandle } | null>
  getRecentFiles(): FileEntry[]
  addRecentFile(entry: FileEntry): void
}

const RECENT_FILES_KEY = 'marp-editor-recent-files'
const MAX_RECENT_FILES = 10

function hasFileSystemAccess(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window && 'showSaveFilePicker' in window
}

class BrowserFileStorage implements StorageProvider {
  openFile(): Promise<{ name: string; content: string; handle?: FileSystemFileHandle } | null> {
    if (hasFileSystemAccess()) {
      return this.openWithFileSystemAccess()
    }
    return this.openWithFallback()
  }

  private async openWithFileSystemAccess(): Promise<{ name: string; content: string; handle?: FileSystemFileHandle } | null> {
    try {
      const showOpenFilePicker = window.showOpenFilePicker!
      const [handle] = await showOpenFilePicker({
        types: [
          {
            description: 'Markdown files',
            accept: { 'text/markdown': ['.md', '.markdown'] },
          },
          {
            description: 'Text files',
            accept: { 'text/plain': ['.txt'] },
          },
        ],
        multiple: false,
      })
      const file = await handle.getFile()
      const content = await file.text()
      const entry = { name: file.name, handle }
      this.addRecentFile(entry)
      return { name: file.name, content, handle }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      console.error('Failed to open file:', err)
      return null
    }
  }

  private openWithFallback(): Promise<{ name: string; content: string; handle?: FileSystemFileHandle } | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.md,.markdown,.txt'
      input.onchange = async () => {
        const file = input.files?.[0]
        if (!file) {
          resolve(null)
          return
        }
        const content = await file.text()
        const entry = { name: file.name }
        this.addRecentFile(entry)
        resolve({ name: file.name, content })
      }
      input.oncancel = () => resolve(null)
      input.click()
    })
  }

  async saveFile(
    content: string,
    suggestedName: string,
    existingHandle?: FileSystemFileHandle
  ): Promise<{ name: string; handle?: FileSystemFileHandle } | null> {
    if (hasFileSystemAccess() && existingHandle) {
      return this.saveWithFileSystemAccess(content, existingHandle)
    }
    return this.saveAsFile(content, suggestedName)
  }

  private async saveWithFileSystemAccess(
    content: string,
    handle: FileSystemFileHandle
  ): Promise<{ name: string; handle?: FileSystemFileHandle } | null> {
    try {
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      const file = await handle.getFile()
      const entry = { name: file.name, handle }
      this.addRecentFile(entry)
      return { name: file.name, handle }
    } catch (err) {
      console.error('Failed to save file:', err)
      return null
    }
  }

  async saveAsFile(content: string, suggestedName: string): Promise<{ name: string; handle?: FileSystemFileHandle } | null> {
    if (hasFileSystemAccess()) {
      return this.saveAsWithFileSystemAccess(content, suggestedName)
    }
    this.saveWithFallback(content, suggestedName)
    const entry = { name: suggestedName }
    this.addRecentFile(entry)
    return { name: suggestedName }
  }

  private async saveAsWithFileSystemAccess(
    content: string,
    suggestedName: string
  ): Promise<{ name: string; handle?: FileSystemFileHandle } | null> {
    try {
      const showSaveFilePicker = window.showSaveFilePicker!
      const handle = await showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'Markdown file',
            accept: { 'text/markdown': ['.md'] },
          },
          {
            description: 'Text file',
            accept: { 'text/plain': ['.txt'] },
          },
        ],
      })
      const writable = await handle.createWritable()
      await writable.write(content)
      await writable.close()
      const file = await handle.getFile()
      const entry = { name: file.name, handle }
      this.addRecentFile(entry)
      return { name: file.name, handle }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return null
      console.error('Failed to save file:', err)
      return null
    }
  }

  private saveWithFallback(content: string, filename: string): void {
    downloadFile(content, filename, 'text/markdown')
  }

  getRecentFiles(): FileEntry[] {
    try {
      const raw = localStorage.getItem(RECENT_FILES_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw) as FileEntry[]
      return parsed.slice(0, MAX_RECENT_FILES)
    } catch {
      return []
    }
  }

  addRecentFile(entry: FileEntry): void {
    const recent = this.getRecentFiles()
    const filtered = recent.filter((r) => r.name !== entry.name)
    filtered.unshift(entry)
    const trimmed = filtered.slice(0, MAX_RECENT_FILES)
    // Don't persist handles to localStorage (not serializable)
    const storable = trimmed.map((r) => ({ name: r.name }))
    localStorage.setItem(RECENT_FILES_KEY, JSON.stringify(storable))
  }
}

export const storage: StorageProvider = new BrowserFileStorage()

/**
 * Prepare markdown for saving: resolve image references to inline base64.
 */
export function prepareMarkdownForSave(
  markdown: string,
  images: Record<string, string>
): string {
  return resolveImages(markdown, images)
}
