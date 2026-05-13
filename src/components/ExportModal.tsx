import { useState } from 'react'
import { X, FileText, FileImage, Presentation, ExternalLink, Loader2 } from 'lucide-react'
import { useStore } from '../lib/store'
import {
  downloadFile,
  generatePreviewHtml,
  resolveImages,
} from '../lib/utils'

declare global {
  interface Window {
    __TAURI__?: {
      core?: {
        invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>
      }
    }
  }
}

export default function ExportModal() {
  const markdown = useStore((s) => s.markdown)
  const theme = useStore((s) => s.theme)
  const images = useStore((s) => s.images)
  const setExportModalOpen = useStore((s) => s.setExportModalOpen)
  const [exporting, setExporting] = useState<string | null>(null)

  const exportMarkdown = () => {
    setExporting('md')
    const resolvedMarkdown = resolveImages(markdown, images)
    downloadFile(resolvedMarkdown, 'presentation.md', 'text/markdown')
    setTimeout(() => {
      setExporting(null)
      setExportModalOpen(false)
    }, 500)
  }

  const exportPDF = () => {
    setExporting('pdf')
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Popup was blocked. Please allow popups for this site to export PDF.')
      setExporting(null)
      return
    }

    const html = generatePreviewHtml(markdown, theme, images)
    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()

    let printed = false
    const triggerPrint = () => {
      if (printed) return
      printed = true
      try {
        printWindow.focus()
        printWindow.print()
      } finally {
        setExporting(null)
        setExportModalOpen(false)
      }
    }

    if (printWindow.document.readyState === 'complete') {
      setTimeout(triggerPrint, 300)
    } else {
      printWindow.addEventListener('load', () => setTimeout(triggerPrint, 300), { once: true })
      // Safety net in case the load event never fires (e.g. blocked subresources)
      setTimeout(triggerPrint, 5000)
    }
  }

  const exportPPTX = async () => {
    setExporting('pptx')
    try {
      const invoke = window.__TAURI__?.core?.invoke
      if (!invoke) {
        alert('PowerPoint export uses the official Marp CLI and is available in the desktop app. In the browser, export Markdown and run: marp presentation.md --pptx -o presentation.pptx')
        setExporting(null)
        return
      }

      const resolvedMarkdown = resolveImages(markdown, images)
      const bytes = await invoke<number[]>('export_pptx', { markdown: resolvedMarkdown })
      const blob = new Blob([new Uint8Array(bytes)], {
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      })
      downloadFile(blob, 'presentation.pptx', blob.type)
      setExporting(null)
      setExportModalOpen(false)
    } catch (error) {
      console.error('PPTX export error:', error)
      setExporting(null)
      alert('Error exporting to PowerPoint. Make sure the Marp CLI is installed and available to the desktop app.')
    }
  }

  const exportGoogleSlides = () => {
    setExporting('google')
    window.open('https://docs.google.com/presentation/create', '_blank', 'noopener,noreferrer')
    setExporting(null)
    setExportModalOpen(false)
  }

  const exportOptions = [
    {
      id: 'md',
      label: 'Markdown',
      description: 'Export as .md file with embedded images',
      icon: FileText,
      action: exportMarkdown,
      color: 'text-emerald-400',
    },
    {
      id: 'pdf',
      label: 'PDF',
      description: 'Print to PDF with full styling',
      icon: FileImage,
      action: exportPDF,
      color: 'text-red-400',
    },
    {
      id: 'pptx',
      label: 'PowerPoint',
      description: 'Desktop only: official Marp CLI .pptx export',
      icon: Presentation,
      action: exportPPTX,
      color: 'text-orange-400',
    },
    {
      id: 'google',
      label: 'Google Slides',
      description: 'Open blank presentation in Google Slides',
      icon: ExternalLink,
      action: exportGoogleSlides,
      color: 'text-blue-400',
    },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[var(--bg-panel)] border border-[var(--border-color)] rounded-xl w-full max-w-md mx-4 shadow-2xl slide-enter">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2
            className="text-xl font-medium"
            style={{ fontFamily: '"Newsreader", serif' }}
          >
            Export Presentation
          </h2>
          <button
            onClick={() => setExportModalOpen(false)}
            className="btn-press p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-charcoal)] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {exportOptions.map((option) => (
            <button
              key={option.id}
              onClick={option.action}
              disabled={exporting === option.id}
              className="w-full flex items-center gap-4 p-4 rounded-xl bg-[var(--bg-charcoal)] border border-[var(--border-color)] hover:border-[var(--accent)] transition-all group text-left"
            >
              <div className={`p-2.5 rounded-lg bg-[var(--bg-primary)] ${option.color}`}>
                {exporting === option.id ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <option.icon className="w-5 h-5" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                  {option.label}
                </h3>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {option.description}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
