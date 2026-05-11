import { useEffect } from 'react'
import { useStore } from './lib/store'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { hexToRgb } from './lib/utils'
import Toolbar from './components/Toolbar'
import EditorPanel from './components/EditorPanel'
import PreviewPanel from './components/PreviewPanel'
import StylePanel from './components/StylePanel'
import ExportModal from './components/ExportModal'
import PresentationMode from './components/PresentationMode'

function App() {
  useKeyboardShortcuts()
  
  const theme = useStore((s) => s.theme)
  const isStylePanelOpen = useStore((s) => s.isStylePanelOpen)
  const isExportModalOpen = useStore((s) => s.isExportModalOpen)
  const isPresentationMode = useStore((s) => s.isPresentationMode)

  // Sync CSS accent variables with theme accent color
  useEffect(() => {
    const root = document.documentElement
    const rgb = hexToRgb(theme.accentColor)
    root.style.setProperty('--accent', theme.accentColor)
    root.style.setProperty('--accent-hover', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`)
    root.style.setProperty('--accent-muted', `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.15)`)
  }, [theme.accentColor])

  return (
    <div className="flex flex-col h-screen w-screen bg-[var(--bg-primary)] text-[var(--text-primary)] overflow-hidden">
      <Toolbar />
      
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left side: Editor */}
        <div className="flex flex-col w-full md:w-[58%] md:min-w-[400px] border-r-0 md:border-r border-[var(--border-color)] flex-1 md:flex-none md:h-auto min-h-0">
          <div className="flex-1 overflow-hidden editor-texture">
            <EditorPanel />
          </div>
        </div>

        {/* Right side: Preview */}
        <div className="flex-1 bg-[var(--bg-primary)] relative overflow-hidden min-h-0">
          <PreviewPanel />
        </div>
      </div>

      {isStylePanelOpen && <StylePanel />}
      {isExportModalOpen && <ExportModal />}
      {isPresentationMode && <PresentationMode />}
    </div>
  )
}

export default App
