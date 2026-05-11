import { Marp } from '@marp-team/marp-core'
import polyfillSource from '@marp-team/marpit-svg-polyfill/lib/polyfill.browser.js?raw'
import type { ThemeSettings } from '../types'

// Inlined into iframe HTML so the polyfill runs in the iframe's own window context.
// Fixes WebKit bug #23113 (foreignObject content not scaling with CSS-sized parent SVG)
// which breaks Marp's multi-slide rendering in Tauri/WKWebView on macOS.
// The bundle is a self-executing IIFE; it auto-detects WebKit and is a no-op elsewhere.
const SVG_POLYFILL_SCRIPT = `<script>${polyfillSource}</script>`

export function debounce<TArgs extends unknown[]>(
  fn: (...args: TArgs) => void,
  delay: number
): (...args: TArgs) => void {
  let timer: ReturnType<typeof setTimeout>
  return (...args: TArgs) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

export function downloadFile(content: BlobPart, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function generateId(): string {
  return Math.random().toString(36).substring(2, 9)
}

export function hexToRgb(hex: string) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : { r: 199, g: 91, b: 57 }
}

export interface SlideDocument {
  content: string
  startLine: number
  endLine: number
}

export interface MarkdownSlideParseResult {
  frontmatter: string
  slides: SlideDocument[]
}

function normalizeMarkdown(markdown: string): string {
  return markdown.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
}

export function parseMarkdownSlides(markdown: string): MarkdownSlideParseResult {
  const normalized = normalizeMarkdown(markdown)
  const lines = normalized.split('\n')
  const separatorLines: number[] = []

  lines.forEach((line, index) => {
    if (line.trim() === '---') {
      separatorLines.push(index)
    }
  })

  let frontmatter = ''
  let firstSlideStart = 0
  let contentSeparators = separatorLines

  if (separatorLines[0] === 0) {
    const closingFrontmatter = separatorLines.find((lineIndex) => lineIndex > 0)
    if (closingFrontmatter !== undefined) {
      frontmatter = lines.slice(0, closingFrontmatter + 1).join('\n')
      firstSlideStart = closingFrontmatter + 1
      contentSeparators = separatorLines.filter((lineIndex) => lineIndex > closingFrontmatter)
    }
  }

  const starts = [firstSlideStart, ...contentSeparators.map((lineIndex) => lineIndex + 1)]
  const ends = [...contentSeparators.map((lineIndex) => lineIndex - 1), lines.length - 1]
  const slides = starts.map((start, index) => ({
    content: lines.slice(start, ends[index] + 1).join('\n').trim(),
    startLine: start + 1,
    endLine: Math.max(starts[index] + 1, ends[index] + 1),
  }))

  return {
    frontmatter,
    slides: slides.length > 0 ? slides : [{ content: '', startLine: 1, endLine: 1 }],
  }
}

export function buildMarkdownFromSlides(frontmatter: string, slideContents: string[]): string {
  const body = slideContents.map((slide) => slide.trim()).join('\n\n---\n\n')
  if (!frontmatter.trim()) {
    return body
  }
  return `${frontmatter.trim()}\n\n${body}`.trimEnd() + '\n'
}

export function splitIntoSlides(markdown: string): string[] {
  return parseMarkdownSlides(markdown).slides.map((slide) => slide.content)
}

export function getSlideTitle(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return '(empty)'
  const match = trimmed.match(/^#+\s+(.+)$/m)
  return match ? match[1] : 'Untitled Slide'
}

export function getSlideLineRanges(text: string): Array<{ startLine: number; endLine: number }> {
  return parseMarkdownSlides(text).slides.map(({ startLine, endLine }) => ({ startLine, endLine }))
}

export function resolveImages(markdown: string, images: Record<string, string>): string {
  let processed = markdown
  const imageRefs = markdown.matchAll(/!\[(.*?)\]\(image:([^)]+)\)/g)
  for (const match of imageRefs) {
    const [fullMatch, alt, id] = match
    const base64 = images[id]
    if (base64) {
      processed = processed.replaceAll(fullMatch, `![${alt}](${base64})`)
    }
  }
  return processed
}

export interface ExtractedImage {
  id: string
  alt: string
  base64: string
}

/**
 * Extract inline base64 images from markdown and replace them with image:ID references.
 * Returns the cleaned markdown and list of extracted images to be stored.
 */
export function extractInlineImages(markdown: string): {
  cleanedMarkdown: string
  extractedImages: ExtractedImage[]
} {
  const extractedImages: ExtractedImage[] = []
  let cleanedMarkdown = markdown

  const pattern = /!\[(.*?)\]\((data:image\/[^;]+;base64,[A-Za-z0-9+/=]+)\)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(markdown)) !== null) {
    const [fullMatch, alt, base64] = match
    const id = `img_${generateId()}`
    extractedImages.push({ id, alt, base64 })
    cleanedMarkdown = cleanedMarkdown.replace(fullMatch, `![${alt}](image:${id})`)
  }

  return { cleanedMarkdown, extractedImages }
}

export function renderMarp(markdown: string, images: Record<string, string>) {
  const processedMarkdown = resolveImages(markdown, images)

  const marp = new Marp({
    html: true,
    markdown: { breaks: true },
    script: false,
  })

  const renderResult = marp.render(processedMarkdown)
  let html = renderResult.html
  const css = renderResult.css

  // Post-process: Marpit ignores width/height percentages for inline images.
  // We manually inject them as inline styles so they actually work.
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')

    for (const img of doc.querySelectorAll('img')) {
      const alt = img.getAttribute('alt') || ''
      const widthMatch = alt.match(/width:((?:\d*\.)?\d+%)/)
      const heightMatch = alt.match(/height:((?:\d*\.)?\d+%)/)

      if (widthMatch || heightMatch) {
        const style = img.getAttribute('style') || ''
        const styleMap = new Map<string, string>()

        for (const rule of style.split(';').filter(Boolean)) {
          const colonIdx = rule.indexOf(':')
          if (colonIdx > -1) {
            styleMap.set(rule.slice(0, colonIdx).trim(), rule.slice(colonIdx + 1).trim())
          }
        }

        if (widthMatch) styleMap.set('width', widthMatch[1])
        if (heightMatch) styleMap.set('height', heightMatch[1])

        const newStyle = Array.from(styleMap.entries())
          .map(([k, v]) => `${k}:${v}`)
          .join(';')
        img.setAttribute('style', newStyle)
      }
    }

    html = doc.body.innerHTML
  }

  const slideCount = (html.match(/data-marpit-svg/g) || []).length
  
  return { html, css, slides: slideCount || 1 }
}

function extractRenderedSlideSvg(html: string): SVGSVGElement | null {
  if (typeof DOMParser === 'undefined') return null

  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  return doc.querySelector('svg[data-marpit-svg]')
}

function renderPreviewSlides(markdown: string, images: Record<string, string>): {
  html: string
  css: string
} {
  const fullRender = renderMarp(markdown, images)
  if (typeof DOMParser === 'undefined') {
    return { html: fullRender.html, css: fullRender.css }
  }

  const parsed = parseMarkdownSlides(markdown)
  const renderedSlides = parsed.slides
    .map((slide) => buildMarkdownFromSlides(parsed.frontmatter, [slide.content]))
    .map((slideMarkdown) => renderMarp(slideMarkdown, images).html)
    .map(extractRenderedSlideSvg)
    .filter((slide): slide is SVGSVGElement => slide !== null)

  if (renderedSlides.length === 0) {
    return { html: fullRender.html, css: fullRender.css }
  }

  const doc = document.implementation.createHTMLDocument('')
  const marpit = doc.createElement('div')
  marpit.className = 'marpit'

  renderedSlides.forEach((slide, index) => {
    slide.setAttribute('data-preview-slide-index', String(index))
    const section = slide.querySelector('section')
    if (section) {
      section.id = String(index + 1)
      section.setAttribute('data-marpit-pagination', String(index + 1))
      section.setAttribute('data-marpit-pagination-total', String(renderedSlides.length))
    }
    marpit.appendChild(doc.importNode(slide, true))
  })

  return { html: marpit.outerHTML, css: fullRender.css }
}

export function generatePreviewHtml(
  markdown: string,
  theme: ThemeSettings,
  images: Record<string, string>
): string {
  const { html, css } = renderPreviewSlides(markdown, images)
  const aspectRatio = theme.slideSize === '4:3' ? '4/3' : theme.slideSize === '16:10' ? '16/10' : '16/9'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Presentation</title>
  ${SVG_POLYFILL_SCRIPT}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #1a1a1a;
      min-height: 100vh;
      padding: 32px 24px;
    }
    ${css}
    .marpit {
      display: flex !important;
      flex-direction: column;
      align-items: center;
      gap: 32px;
    }
    .marpit > svg {
      display: block;
      width: 100%;
      max-width: 960px;
      aspect-ratio: ${aspectRatio};
      box-shadow: 0 24px 48px rgba(0,0,0,0.4), 0 8px 16px rgba(0,0,0,0.3);
      border-radius: 4px;
      overflow: hidden;
      break-after: page;
      margin: 0;
    }
    section {
      background-color: ${theme.backgroundColor};
      color: ${theme.fontColor};
      font-family: ${theme.fontFamily} !important;
      ${theme.logo ? `background-image: url('${theme.logo}') !important;
      background-position: calc(100% - 24px) 24px !important;
      background-repeat: no-repeat !important;
      background-size: ${theme.logoSize || 120}px auto !important;` : ''}
    }
    section h1, section h2, section h3, section h4, section h5, section h6 {
      color: inherit;
    }
    section a {
      color: ${theme.accentColor} !important;
    }
    section strong, section b {
      color: ${theme.accentColor} !important;
    }
    @media print {
      @page {
        margin: 0;
        size: auto;
      }
      body { 
        background: white; 
        padding: 0;
      }
      .marpit {
        gap: 0;
      }
      .marpit > svg {
        box-shadow: none;
        border-radius: 0;
        max-width: none;
        page-break-after: always;
        break-after: auto;
      }
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`
}

export function generatePresentationHtml(
  markdown: string,
  theme: ThemeSettings,
  images: Record<string, string>
): string {
  const { html, css } = renderMarp(markdown, images)
  const aspectRatio = theme.slideSize === '4:3' ? '4/3' : theme.slideSize === '16:10' ? '16/10' : '16/9'

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Presentation</title>
  ${SVG_POLYFILL_SCRIPT}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #000;
      height: 100vh;
      width: 100vw;
      overflow: hidden;
    }
    ${css}
    .marpit {
      display: flex !important;
      align-items: center;
      justify-content: center;
      width: 100vw;
      height: 100vh;
    }
    .marpit > svg {
      display: none;
      max-width: 95vw;
      max-height: 95vh;
      width: auto !important;
      height: auto !important;
      aspect-ratio: ${aspectRatio};
      box-shadow: none;
      border-radius: 0;
    }
    .marpit > svg.active {
      display: block !important;
    }
    section {
      background-color: ${theme.backgroundColor};
      color: ${theme.fontColor};
      font-family: ${theme.fontFamily} !important;
      ${theme.logo ? `background-image: url('${theme.logo}') !important;
      background-position: calc(100% - 24px) 24px !important;
      background-repeat: no-repeat !important;
      background-size: ${theme.logoSize || 120}px auto !important;` : ''}
    }
    section h1, section h2, section h3, section h4, section h5, section h6 {
      color: inherit;
    }
    section a {
      color: ${theme.accentColor} !important;
    }
    section strong, section b {
      color: ${theme.accentColor} !important;
    }
  </style>
</head>
<body>
  ${html}
</body>
</html>`
}

export const DEFAULT_MARKDOWN = `---
marp: true
theme: default
paginate: true
---

<!--
_class: lead
_paginate: false
-->

# MarpEditor

Create beautiful presentations with **Markdown**

_Edit on the left. Preview on the right._

---

<!--
_backgroundColor: #1a1a1a
_color: #f5f2eb
-->

# Why Markdown?

Focus on **content**, not formatting.

> "The best slides are written, not designed."

---

## Everything You Need

### Editor

- **Monaco** syntax highlighting
- Formatting toolbar
- Drag & drop images
- Paste from clipboard

### Preview

- Real-time slide rendering
- Keyboard navigation
- Presentation mode
- PDF export

---

## Markdown Superpowers

Lists, tables, code, and quotes — all out of the box.

| Feature | Status |
|---------|--------|
| Editor | ✓ |
| Preview | ✓ |
| Export | ✓ |

\`\`\`javascript
function hello() {
  return "Hello, World!";
}
\`\`\`

> Design is intelligence made visible.

---

<!--
_backgroundColor: #c75b39
_color: #ffffff
-->

# Make It Yours

Themes · Colors · Fonts · Logos · Slide Sizes

Open the **Style** panel and start customizing.

---

<!--
_class: lead
_paginate: false
-->

# Thank You

Built with **MarpEditor**

Try editing this slide →
`
