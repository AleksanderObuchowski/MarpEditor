import { useEffect } from 'react'
import { useStore } from '../lib/store'

export function useKeyboardShortcuts() {
  const setExportModalOpen = useStore((s) => s.setExportModalOpen)
  const setPresentationMode = useStore((s) => s.setPresentationMode)
  const saveCurrentFile = useStore((s) => s.saveCurrentFile)
  const saveAsCurrentFile = useStore((s) => s.saveAsCurrentFile)
  const newFile = useStore((s) => s.newFile)
  const isDirty = useStore((s) => s.isDirty)
  const isPresentationMode = useStore((s) => s.isPresentationMode)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when in presentation mode (handled by PresentationMode component)
      if (isPresentationMode) return

      // Only handle shortcuts when not typing in the editor
      const target = e.target as HTMLElement
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT' || target.isContentEditable) {
        return
      }

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase()

        if (key === 's') {
          e.preventDefault()
          if (e.shiftKey) {
            saveAsCurrentFile()
          } else {
            saveCurrentFile()
          }
          return
        }

        if (key === 'o') {
          e.preventDefault()
          // Open is handled by toolbar; dispatch custom event for decoupling
          window.dispatchEvent(new CustomEvent('marp:open-file'))
          return
        }

        switch (key) {
          case 'e':
            e.preventDefault()
            setExportModalOpen(true)
            break
          case 'n':
            e.preventDefault()
            if (isDirty && !confirm('You have unsaved changes. Create a new file anyway?')) {
              return
            }
            newFile()
            break
        }
      }

      // F5 starts presentation mode
      if (e.key === 'F5') {
        e.preventDefault()
        setPresentationMode(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setExportModalOpen, setPresentationMode, saveCurrentFile, saveAsCurrentFile, newFile, isDirty, isPresentationMode])
}
