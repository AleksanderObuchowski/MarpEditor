import { useEffect, useRef, useMemo } from 'react'
import { useStore } from '../lib/store'
import { generatePreviewHtml, getSlideLineRanges, splitIntoSlides } from '../lib/utils'
import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react'

export default function PreviewPanel() {
  const markdown = useStore((s) => s.markdown)
  const theme = useStore((s) => s.theme)
  const images = useStore((s) => s.images)
  const currentSlideIndex = useStore((s) => s.currentSlideIndex)
  const setCurrentSlideIndex = useStore((s) => s.setCurrentSlideIndex)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const slides = useMemo(() => {
    return splitIntoSlides(markdown).length
  }, [markdown])

  const previewHtml = useMemo(() => {
    return generatePreviewHtml(markdown, theme, images)
  }, [markdown, theme, images])

  // Update iframe content directly to preserve scroll position
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument) return

    const win = iframe.contentWindow
    const scrollY = win?.scrollY ?? 0

    const doc = iframe.contentDocument
    doc.open()
    doc.write(previewHtml)
    doc.close()

    // Use event delegation for slide clicks — clicking a slide jumps editor to its line
    const handleSlideClick = (e: Event) => {
      const svg = (e.target as HTMLElement).closest('svg[data-marpit-svg]')
      if (!svg) return
      e.stopPropagation()
      const svgs = doc.querySelectorAll('svg[data-marpit-svg]')
      const index = Array.from(svgs).indexOf(svg)
      const ranges = getSlideLineRanges(markdown)
      const range = ranges[index]
      if (range) {
        const jumpToLine = useStore.getState().jumpToLine
        if (jumpToLine) {
          jumpToLine(range.startLine)
        }
        useStore.getState().setCurrentSlideIndex(index)
      }
    }

    const svgs = doc.querySelectorAll('svg[data-marpit-svg]')
    svgs.forEach((svg) => {
      ;(svg as HTMLElement).style.cursor = 'pointer'
    })
    doc.body.addEventListener('click', handleSlideClick)

    // Restore scroll position after content update
    if (win) {
      win.scrollTo(0, scrollY)
    }

    return () => {
      doc.body.removeEventListener('click', handleSlideClick)
    }
  }, [previewHtml, markdown])

  // Scroll to current slide when navigating
  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      const svgs = iframeRef.current.contentDocument?.querySelectorAll('svg[data-marpit-svg]')
      if (svgs && svgs[currentSlideIndex]) {
        svgs[currentSlideIndex].scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [currentSlideIndex])

  const goToSlide = (index: number) => {
    if (index >= 0 && index < slides) {
      setCurrentSlideIndex(index)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Preview Toolbar */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[var(--border-color)] bg-[var(--bg-primary)]">
        <span 
          className="text-sm text-[var(--text-secondary)] tracking-wide"
          style={{ fontFamily: '"Newsreader", serif' }}
        >
          Preview
        </span>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => goToSlide(currentSlideIndex - 1)}
            disabled={currentSlideIndex === 0}
            className="btn-press p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Previous slide"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          
          <span className="text-sm text-[var(--text-secondary)] font-mono min-w-[60px] text-center">
            {currentSlideIndex + 1} / {slides}
          </span>
          
          <button
            onClick={() => goToSlide(currentSlideIndex + 1)}
            disabled={currentSlideIndex >= slides - 1}
            className="btn-press p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Next slide"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              const blob = new Blob([previewHtml], { type: 'text/html' })
              const url = URL.createObjectURL(blob)
              const printWindow = window.open(url, '_blank', 'noopener,noreferrer')
              if (printWindow) {
                const tryPrint = () => {
                  printWindow.print()
                  URL.revokeObjectURL(url)
                }
                // Wait for content to load before printing
                setTimeout(tryPrint, 800)
              }
            }}
            className="btn-press p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors ml-2"
            title="Print / PDF"
            aria-label="Print or export PDF"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Iframe Preview */}
      <div className="flex-1 overflow-hidden bg-[var(--bg-primary)]">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          title="Marp Preview"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    </div>
  )
}
