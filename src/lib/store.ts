import { create } from 'zustand'
import type { OnMount } from '@monaco-editor/react'
import type { EditorState, ThemeSettings } from '../types'
import {
  DEFAULT_MARKDOWN,
  buildMarkdownFromSlides,
  extractInlineImages,
  generateId,
  parseMarkdownSlides,
} from './utils'
import { dbSaveImage, dbGetAllImages, migrateImagesFromLocalStorage } from './imageDb'
import { storage, prepareMarkdownForSave } from './storage'

const defaultTheme: ThemeSettings = {
  name: 'Editorial',
  backgroundColor: '#ffffff',
  fontFamily: 'system-ui, sans-serif',
  fontColor: '#1a1a1a',
  accentColor: '#c75b39',
  slideSize: '16:9',
}

interface Store extends EditorState {
  images: Record<string, string>
  setMarkdown: (markdown: string) => void
  setCurrentSlideIndex: (index: number) => void
  setTheme: (theme: Partial<ThemeSettings>) => void
  setStylePanelOpen: (open: boolean) => void
  setExportModalOpen: (open: boolean) => void
  setPresentationMode: (open: boolean) => void
  addSlide: () => void
  deleteSlide: (index: number) => void
  insertAtCursor: (text: string) => void
  addImage: (base64: string) => Promise<string>
  editorRef: React.MutableRefObject<EditorHandle | null> | null
  setEditorRef: (ref: React.MutableRefObject<EditorHandle | null> | null) => void
  jumpToLine: ((line: number) => void) | null
  setJumpToLine: (fn: ((line: number) => void) | null) => void

  // File management
  activeFileName: string | null
  activeFileHandle: FileSystemFileHandle | null
  isDirty: boolean
  setActiveFile: (name: string | null, handle?: FileSystemFileHandle | null) => void
  loadFile: (content: string, name: string, handle?: FileSystemFileHandle) => Promise<void>
  saveCurrentFile: () => Promise<boolean>
  saveAsCurrentFile: () => Promise<boolean>
  newFile: () => void
}

type EditorHandle = Parameters<OnMount>[0]

const LAST_FILE_KEY = 'marp-editor-last-file'

function getRecoveryKey(state: Store): string {
  if (state.activeFileName) {
    return `marp-editor-recovery-${state.activeFileName}`
  }
  return 'marp-editor-recovery-untitled'
}

function persistLastFile(name: string | null) {
  try {
    if (name) {
      localStorage.setItem(LAST_FILE_KEY, name)
    } else {
      localStorage.removeItem(LAST_FILE_KEY)
    }
  } catch {
    // ignore
  }
}

let recoveryTimer: ReturnType<typeof setTimeout> | null = null

export const useStore = create<Store>((set, get) => ({
  markdown: DEFAULT_MARKDOWN,
  currentSlideIndex: 0,
  theme: defaultTheme,
  isStylePanelOpen: false,
  isExportModalOpen: false,
  isPresentationMode: false,
  editorRef: null,
  jumpToLine: null,
  images: {},

  // File management
  activeFileName: null,
  activeFileHandle: null,
  isDirty: false,

  setMarkdown: (markdown) => {
    const state = get()
    set({ markdown, isDirty: true })
    // Debounce recovery cache write to avoid main-thread jank on large docs
    const key = getRecoveryKey(state)
    if (recoveryTimer) clearTimeout(recoveryTimer)
    recoveryTimer = setTimeout(() => {
      try {
        localStorage.setItem(key, markdown)
      } catch {
        // ignore storage errors
      }
      recoveryTimer = null
    }, 300)
  },

  setCurrentSlideIndex: (index) => set({ currentSlideIndex: index }),

  setTheme: (theme) => {
    const newTheme = { ...get().theme, ...theme }
    set({ theme: newTheme })
    localStorage.setItem('marp-editor-theme', JSON.stringify(newTheme))
  },

  setStylePanelOpen: (open) => set({ isStylePanelOpen: open }),
  setExportModalOpen: (open) => set({ isExportModalOpen: open }),
  setPresentationMode: (open) => set({ isPresentationMode: open }),

  setActiveFile: (name, handle = null) => {
    set({ activeFileName: name, activeFileHandle: handle || null, isDirty: false })
    persistLastFile(name)
  },

  loadFile: async (content, name, handle) => {
    // Extract inline base64 images and replace with image:ID references
    const { cleanedMarkdown, extractedImages } = extractInlineImages(content)
    const newImages: Record<string, string> = {}
    for (const img of extractedImages) {
      await dbSaveImage(img.id, img.base64)
      newImages[img.id] = img.base64
    }

    set((state) => ({
      markdown: cleanedMarkdown,
      activeFileName: name,
      activeFileHandle: handle || null,
      currentSlideIndex: 0,
      isDirty: false,
      images: { ...state.images, ...newImages },
    }))

    persistLastFile(name)

    // Also save to recovery cache under the new file name
    try {
      localStorage.setItem(`marp-editor-recovery-${name}`, cleanedMarkdown)
    } catch {
      // ignore
    }
  },

  saveAsCurrentFile: async () => {
    const { markdown, images, activeFileName } = get()
    const content = prepareMarkdownForSave(markdown, images)
    const suggestedName = activeFileName || 'presentation.md'

    const result = await storage.saveAsFile(content, suggestedName)
    if (result) {
      set({
        activeFileName: result.name,
        activeFileHandle: result.handle || null,
        isDirty: false,
      })
      return true
    }
    return false
  },

  saveCurrentFile: async () => {
    const { markdown, images, activeFileName, activeFileHandle } = get()
    const content = prepareMarkdownForSave(markdown, images)
    const suggestedName = activeFileName || 'presentation.md'

    const result = await storage.saveFile(content, suggestedName, activeFileHandle || undefined)
    if (result) {
      set({
        activeFileName: result.name,
        activeFileHandle: result.handle || null,
        isDirty: false,
      })
      persistLastFile(result.name)
      return true
    }
    return false
  },

  newFile: () => {
    set({
      markdown: DEFAULT_MARKDOWN,
      activeFileName: null,
      activeFileHandle: null,
      currentSlideIndex: 0,
      isDirty: false,
    })
    persistLastFile(null)
  },

  addSlide: () => {
    const { markdown, editorRef } = get()
    const newSlide = '\n\n---\n\n# New Slide\n\n'
    const newMarkdown = markdown + newSlide
    set({ markdown: newMarkdown, isDirty: true })
    try {
      localStorage.setItem(getRecoveryKey(get()), newMarkdown)
    } catch {
      // ignore
    }

    if (editorRef?.current) {
      const model = editorRef.current.getModel()
      if (!model) return
      const lineCount = model.getLineCount()
      editorRef.current.setPosition({ lineNumber: lineCount, column: model.getLineMaxColumn(lineCount) })
      editorRef.current.focus()
    }
  },

  deleteSlide: (index) => {
    const { markdown } = get()
    const parsed = parseMarkdownSlides(markdown)
    const slides = parsed.slides.map((slide) => slide.content)
    if (slides.length <= 1) return
    if (index < 0 || index >= slides.length) return

    slides.splice(index, 1)
    const newMarkdown = buildMarkdownFromSlides(parsed.frontmatter, slides)
    set({ markdown: newMarkdown, currentSlideIndex: Math.min(index, slides.length - 1), isDirty: true })
    try {
      localStorage.setItem(getRecoveryKey(get()), newMarkdown)
    } catch {
      // ignore
    }
  },

  insertAtCursor: (text) => {
    const { editorRef } = get()
    if (editorRef?.current) {
      const selection = editorRef.current.getSelection()
      if (!selection) return
      editorRef.current.executeEdits('', [
        {
          range: selection,
          text: text,
          forceMoveMarkers: true,
        },
      ])
      editorRef.current.focus()
    }
  },

  addImage: async (base64) => {
    const id = `img_${generateId()}`
    // Save to IndexedDB first, then update in-memory cache
    await dbSaveImage(id, base64)
    set((state) => ({ images: { ...state.images, [id]: base64 } }))
    return id
  },

  setEditorRef: (ref) => set({ editorRef: ref }),
  setJumpToLine: (fn) => set({ jumpToLine: fn }),
}))

// Load from recovery cache on init
const savedContent = localStorage.getItem('marp-editor-content')
const savedTheme = localStorage.getItem('marp-editor-theme')
const lastFileName = localStorage.getItem(LAST_FILE_KEY)

// Migrate old localStorage content to recovery cache
if (savedContent) {
  localStorage.setItem('marp-editor-recovery-untitled', savedContent)
  localStorage.removeItem('marp-editor-content')
}

// Determine which recovery cache to load
const recoveryKey = lastFileName
  ? `marp-editor-recovery-${lastFileName}`
  : 'marp-editor-recovery-untitled'
const recoveryContent = localStorage.getItem(recoveryKey)

if (recoveryContent) {
  useStore.setState({
    markdown: recoveryContent,
    activeFileName: lastFileName,
  })
} else if (lastFileName) {
  // If we know the last file but have no recovery cache for it,
  // at least restore the file name so the user sees what they were working on
  useStore.setState({ activeFileName: lastFileName })
}

if (savedTheme) {
  try {
    useStore.setState({ theme: JSON.parse(savedTheme) })
  } catch {
    // ignore
  }
}

// Async init: migrate legacy localStorage images and load from IndexedDB
;(async () => {
  try {
    await migrateImagesFromLocalStorage()
    const images = await dbGetAllImages()
    useStore.setState({ images })
  } catch (err) {
    console.error('Failed to init image DB:', err)
  }
})()
