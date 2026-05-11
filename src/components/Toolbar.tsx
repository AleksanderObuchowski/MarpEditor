import { useEffect, useCallback } from 'react'
import {
  Plus,
  Palette,
  Download,
  Monitor,
  Play,
  FolderOpen,
  Save,
  FilePlus,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { storage } from '../lib/storage'

export default function Toolbar() {
  const addSlide = useStore((s) => s.addSlide)
  const setStylePanelOpen = useStore((s) => s.setStylePanelOpen)
  const setExportModalOpen = useStore((s) => s.setExportModalOpen)
  const isStylePanelOpen = useStore((s) => s.isStylePanelOpen)
  const activeFileName = useStore((s) => s.activeFileName)
  const isDirty = useStore((s) => s.isDirty)
  const loadFile = useStore((s) => s.loadFile)
  const saveCurrentFile = useStore((s) => s.saveCurrentFile)
  const newFile = useStore((s) => s.newFile)

  const handleOpen = useCallback(async () => {
    const result = await storage.openFile()
    if (result) {
      await loadFile(result.content, result.name, result.handle)
    }
  }, [loadFile])

  const handleSave = useCallback(async () => {
    await saveCurrentFile()
  }, [saveCurrentFile])

  const handleNew = useCallback(() => {
    if (isDirty && !confirm('You have unsaved changes. Create a new file anyway?')) {
      return
    }
    newFile()
  }, [isDirty, newFile])

  useEffect(() => {
    const onOpenFile = () => handleOpen()
    window.addEventListener('marp:open-file', onOpenFile)
    return () => window.removeEventListener('marp:open-file', onOpenFile)
  }, [handleOpen])

  const displayName = activeFileName || 'Untitled'

  return (
    <header className="h-14 border-b border-[var(--border-color)] flex items-center justify-between px-5 bg-[var(--bg-primary)] z-20">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 mr-4">
          <div className="w-7 h-7 rounded bg-[var(--accent)] flex items-center justify-center">
            <Monitor className="w-4 h-4 text-white" />
          </div>
          <h1
            className="text-lg font-medium tracking-tight"
            style={{ fontFamily: '"Newsreader", serif' }}
          >
            MarpEditor
          </h1>
        </div>

        <button
          onClick={handleNew}
          className="btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-panel)] text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)] hover:bg-[var(--bg-charcoal)] transition-colors"
          title="New file (Ctrl/Cmd+N)"
        >
          <FilePlus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>

        <button
          onClick={handleOpen}
          className="btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-panel)] text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)] hover:bg-[var(--bg-charcoal)] transition-colors"
          title="Open file (Ctrl/Cmd+O)"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          <span>Open</span>
        </button>

        <button
          onClick={handleSave}
          className="btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-panel)] text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)] hover:bg-[var(--bg-charcoal)] transition-colors"
          title="Save (Ctrl/Cmd+S)"
        >
          <Save className="w-3.5 h-3.5" />
          <span>Save</span>
        </button>

        <div className="h-5 w-px bg-[var(--border-color)] mx-1" />

        <button
          onClick={addSlide}
          className="btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-muted)] text-[var(--accent)] text-sm hover:bg-[var(--accent-muted)] transition-colors"
          title="Add new slide"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Slide</span>
        </button>

        <button
          onClick={() => setStylePanelOpen(!isStylePanelOpen)}
          className={`btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors ${
            isStylePanelOpen
              ? 'bg-[var(--accent)] text-white'
              : 'bg-[var(--bg-panel)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
          title="Style settings"
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Style</span>
        </button>
      </div>

      <div className="flex items-center gap-4">
        {/* File name indicator */}
        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
          <span className="max-w-[200px] truncate" title={displayName}>
            {displayName}
          </span>
          {isDirty && (
            <span className="text-[var(--accent)]">●</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => useStore.getState().setPresentationMode(true)}
            className="btn-press flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-panel)] text-[var(--text-secondary)] text-sm hover:text-[var(--text-primary)] hover:bg-[var(--bg-charcoal)] transition-colors"
            title="Start presentation (F5)"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Present</span>
          </button>

          <button
            onClick={() => setExportModalOpen(true)}
            className="btn-press flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm hover:bg-[var(--accent-hover)] transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </div>
    </header>
  )
}
