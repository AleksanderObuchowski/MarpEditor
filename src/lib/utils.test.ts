import { describe, it, expect, vi } from 'vitest'
import {
  debounce,
  generateId,
  hexToRgb,
  parseMarkdownSlides,
  buildMarkdownFromSlides,
  splitIntoSlides,
  getSlideTitle,
  getSlideLineRanges,
  resolveImages,
  extractInlineImages,
} from './utils'

describe('debounce', () => {
  it('delays execution until after the wait period', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('a')
    debounced('b')
    debounced('c')

    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
    expect(fn).toHaveBeenCalledWith('c')

    vi.useRealTimers()
  })
})

describe('generateId', () => {
  it('returns a non-empty string', () => {
    const id = generateId()
    expect(typeof id).toBe('string')
    expect(id.length).toBeGreaterThan(0)
  })

  it('returns unique values', () => {
    const ids = new Set(Array.from({ length: 20 }, generateId))
    expect(ids.size).toBe(20)
  })
})

describe('hexToRgb', () => {
  it('converts a hex color to rgb', () => {
    expect(hexToRgb('#c75b39')).toEqual({ r: 199, g: 91, b: 57 })
  })

  it('handles hex without hash prefix', () => {
    expect(hexToRgb('ffffff')).toEqual({ r: 255, g: 255, b: 255 })
  })

  it('returns default on invalid input', () => {
    expect(hexToRgb('not-a-color')).toEqual({ r: 199, g: 91, b: 57 })
  })
})

describe('parseMarkdownSlides', () => {
  it('parses frontmatter and slides', () => {
    const md = `---\nmarp: true\n---\n\n# Slide 1\n\nContent\n\n---\n\n# Slide 2\n`
    const result = parseMarkdownSlides(md)
    expect(result.frontmatter.trim()).toBe('---\nmarp: true\n---')
    expect(result.slides.length).toBe(2)
    expect(result.slides[0].content).toContain('# Slide 1')
    expect(result.slides[1].content).toContain('# Slide 2')
  })

  it('handles markdown without frontmatter', () => {
    const md = '# Slide 1\n\n---\n\n# Slide 2'
    const result = parseMarkdownSlides(md)
    expect(result.frontmatter).toBe('')
    expect(result.slides.length).toBe(2)
  })

  it('handles single slide without separators', () => {
    const md = '# Only Slide\n\nSome content'
    const result = parseMarkdownSlides(md)
    expect(result.slides.length).toBe(1)
    expect(result.slides[0].content).toContain('# Only Slide')
  })

  it('computes correct line ranges', () => {
    const md = '# Slide 1\n\n---\n\n# Slide 2'
    const result = parseMarkdownSlides(md)
    expect(result.slides[0].startLine).toBe(1)
    expect(result.slides[0].endLine).toBe(2)
    expect(result.slides[1].startLine).toBe(4)
    expect(result.slides[1].endLine).toBe(5)
  })
})

describe('buildMarkdownFromSlides', () => {
  it('reconstructs markdown from frontmatter and slides', () => {
    const result = buildMarkdownFromSlides('---\nmarp: true\n---', ['# A', '# B'])
    expect(result).toContain('---\nmarp: true\n---')
    expect(result).toContain('# A')
    expect(result).toContain('# B')
    expect(result).toContain('---\n\n')
  })

  it('works without frontmatter', () => {
    const result = buildMarkdownFromSlides('', ['# A', '# B'])
    expect(result).not.toContain('marp')
    expect(result).toContain('# A')
    expect(result).toContain('---\n\n# B')
  })
})

describe('splitIntoSlides', () => {
  it('returns an array of slide contents', () => {
    const md = '# A\n\n---\n\n# B\n\n---\n\n# C'
    expect(splitIntoSlides(md)).toHaveLength(3)
  })
})

describe('getSlideTitle', () => {
  it('extracts heading text', () => {
    expect(getSlideTitle('# Hello\n\nBody')).toBe('Hello')
  })

  it('returns untitled when no heading', () => {
    expect(getSlideTitle('Just body text')).toBe('Untitled Slide')
  })

  it('returns empty for blank slides', () => {
    expect(getSlideTitle('')).toBe('(empty)')
    expect(getSlideTitle('   ')).toBe('(empty)')
  })
})

describe('getSlideLineRanges', () => {
  it('returns ranges for each slide', () => {
    const md = '# A\n\n---\n\n# B'
    const ranges = getSlideLineRanges(md)
    expect(ranges).toHaveLength(2)
    expect(ranges[0]).toHaveProperty('startLine')
    expect(ranges[0]).toHaveProperty('endLine')
  })
})

describe('resolveImages', () => {
  it('replaces image:ID references with base64 data', () => {
    const md = '![alt](image:abc123)'
    const images = { abc123: 'data:image/png;base64,XYZ' }
    expect(resolveImages(md, images)).toBe('![alt](data:image/png;base64,XYZ)')
  })

  it('leaves unknown IDs unchanged', () => {
    const md = '![alt](image:missing)'
    expect(resolveImages(md, {})).toBe(md)
  })

  it('handles multiple images', () => {
    const md = '![a](image:x) ![b](image:y)'
    const images = { x: 'data:a', y: 'data:b' }
    expect(resolveImages(md, images)).toBe('![a](data:a) ![b](data:b)')
  })
})

describe('extractInlineImages', () => {
  it('extracts inline base64 images and replaces with image:ID', () => {
    const md = '![photo](data:image/png;base64,ABC123)'
    const result = extractInlineImages(md)
    expect(result.extractedImages).toHaveLength(1)
    expect(result.extractedImages[0].base64).toBe('data:image/png;base64,ABC123')
    expect(result.cleanedMarkdown).toMatch(/!\[photo\]\(image:img_/)
  })

  it('returns unchanged markdown when no inline images', () => {
    const md = '![external](https://example.com/img.png)'
    const result = extractInlineImages(md)
    expect(result.extractedImages).toHaveLength(0)
    expect(result.cleanedMarkdown).toBe(md)
  })
})
