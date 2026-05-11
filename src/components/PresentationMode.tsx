import { useEffect, useRef, useMemo, useCallback } from 'react'
import { useStore } from '../lib/store'
import { generatePresentationHtml, splitIntoSlides } from '../lib/utils'
import { X } from 'lucide-react'

export default function PresentationMode() {
  const markdown = useStore((s) => s.markdown)
  const theme = useStore((s) => s.theme)
  const images = useStore((s) => s.images)
  const currentSlideIndex = useStore((s) => s.currentSlideIndex)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const slides = useMemo(() => {
    return splitIntoSlides(markdown).length
  }, [markdown])

  const html = useMemo(() => {
    return generatePresentationHtml(markdown, theme, images)
  }, [markdown, theme, images])

  // Write HTML to iframe
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument) return
    const doc = iframe.contentDocument
    doc.open()
    doc.write(html)
    doc.close()
  }, [html])

  // Update visible slide in iframe
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe?.contentDocument) return
    const svgs = iframe.contentDocument.querySelectorAll('svg[data-marpit-svg]')
    svgs.forEach((svg, i) => {
      if (i === currentSlideIndex) {
        svg.classList.add('active')
      } else {
        svg.classList.remove('active')
      }
    })
  }, [currentSlideIndex, html])

  // Keyboard handling — use getState to avoid stale closures
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const state = useStore.getState()
    const index = state.currentSlideIndex
    const totalSlides = splitIntoSlides(state.markdown).length

    switch (e.key) {
      case 'ArrowRight':
      case ' ':
      case 'PageDown':
        e.preventDefault()
        if (index + 1 < totalSlides) {
          state.setCurrentSlideIndex(index + 1)
        }
        break
      case 'ArrowLeft':
      case 'PageUp':
        e.preventDefault()
        if (index > 0) {
          state.setCurrentSlideIndex(index - 1)
        }
        break
      case 'Escape':
        e.preventDefault()
        state.setPresentationMode(false)
        break
    }
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    const iframeWindow = iframeRef.current?.contentWindow
    if (iframeWindow) {
      iframeWindow.addEventListener('keydown', handleKeyDown)
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (iframeWindow) {
        iframeWindow.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [handleKeyDown])

  // Fullscreen API
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const enterFullscreen = async () => {
      try {
        if (container.requestFullscreen) {
          await container.requestFullscreen()
        }
      } catch {
        // ignore
      }
    }

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        useStore.getState().setPresentationMode(false)
      }
    }

    enterFullscreen()
    document.addEventListener('fullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {})
      }
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-black flex flex-col"
      tabIndex={0}
    >
      {/* Close button */}
      <button
        onClick={() => useStore.getState().setPresentationMode(false)}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white/70 hover:text-white hover:bg-black/80 transition-colors opacity-0 hover:opacity-100 focus:opacity-100"
        title="Exit presentation (Esc)"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Iframe */}
      <div className="flex-1 overflow-hidden">
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          title="Presentation Mode"
          sandbox="allow-same-origin allow-scripts"
        />
      </div>

      {/* Slide counter */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/50 text-sm font-mono pointer-events-none">
        {currentSlideIndex + 1} / {slides}
      </div>
    </div>
  )
}
