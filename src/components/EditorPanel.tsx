import { useCallback, useRef, useMemo, useState, useEffect } from 'react'
import Editor from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import { useStore } from '../lib/store'
import { debounce, getSlideLineRanges, splitIntoSlides } from '../lib/utils'
import { 
  Bold, 
  Italic, 
  Heading1, 
  Heading2, 
  List, 
  ListOrdered, 
  Quote, 
  Code, 
  Image,
  Table,
  Link,
  LayoutTemplate,
  Upload,
  Loader2,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react'

export default function EditorPanel() {
  const markdown = useStore((s) => s.markdown)
  const setMarkdown = useStore((s) => s.setMarkdown)
  const setEditorRef = useStore((s) => s.setEditorRef)
  const setJumpToLine = useStore((s) => s.setJumpToLine)
  const addImage = useStore((s) => s.addImage)
  const currentSlideIndex = useStore((s) => s.currentSlideIndex)
  const isDirty = useStore((s) => s.isDirty)
  type EditorInstance = Parameters<OnMount>[0]
  type MonacoInstance = Parameters<OnMount>[1]
  type EditorDecoration = Parameters<EditorInstance['deltaDecorations']>[1][number]
  const editorRef = useRef<EditorInstance | null>(null)
  const monacoRef = useRef<MonacoInstance | null>(null)
  const decorationsRef = useRef<string[]>([])
  const debouncedApplyRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  type ImageAlign = 'left' | 'center' | 'right' | null
  const [imageAtCursor, setImageAtCursor] = useState<{
    lineNumber: number
    startColumn: number
    endColumn: number
    alt: string
    url: string
    width: string | null
    align: ImageAlign
  } | null>(null)

  const insertText = useCallback((before: string, after: string = '') => {
    const editor = editorRef.current
    if (!editor) return
    
    const selection = editor.getSelection()
    if (!selection) return
    const model = editor.getModel()
    if (!model) return
    const selectedText = model.getValueInRange(selection)
    const newText = before + (selectedText || '') + after
    
    editor.executeEdits('', [
      {
        range: selection,
        text: newText,
        forceMoveMarkers: true,
      },
    ])
    editor.focus()
  }, [])

  const toggleBold = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return

    const selection = editor.getSelection()
    const model = editor.getModel()
    if (!selection || !model) return
    const selectedText = model.getValueInRange(selection)

    if (selectedText.startsWith('**') && selectedText.endsWith('**') && selectedText.length >= 4) {
      const unwrapped = selectedText.slice(2, -2)
      editor.executeEdits('toggle-bold', [
        {
          range: selection,
          text: unwrapped,
          forceMoveMarkers: true,
        },
      ])
    } else {
      editor.executeEdits('toggle-bold', [
        {
          range: selection,
          text: `**${selectedText}**`,
          forceMoveMarkers: true,
        },
      ])
    }
    editor.focus()
  }, [])

  const insertSlideBreak = useCallback(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor) return
    if (!monaco) return

    const pos = editor.getPosition()
    if (!pos) return

    const model = editor.getModel()
    if (!model) return
    const line = model.getLineContent(pos.lineNumber)

    const text = line.trim() === '' ? '---\n\n' : '\n\n---\n\n'

    editor.executeEdits('toolbar', [
      {
        range: new monaco.Range(pos.lineNumber, line.length + 1, pos.lineNumber, line.length + 1),
        text,
        forceMoveMarkers: true,
      },
    ])
    editor.focus()
  }, [])

  const handleImageUpload = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      const id = await addImage(dataUrl)
      insertText(`![${file.name}](image:${id})`)
    }
    reader.readAsDataURL(file)
  }, [addImage, insertText])

  const detectImageAtCursor = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return null
    const model = editor.getModel()
    const pos = editor.getPosition()
    if (!model || !pos) return null

    const line = model.getLineContent(pos.lineNumber)
    const match = line.match(/(!\[(.*?)\]\((.*?)\))/)
    if (!match) return null

    const fullMatch = match[1]
    const alt = match[2]
    const url = match[3]
    const startColumn = (match.index || 0) + 1
    const endColumn = startColumn + fullMatch.length

    const widthMatch = alt.match(/width:(\d+%?|\d+px)/)
    const alignMatch = alt.match(/align:(left|center|right)/)

    return {
      lineNumber: pos.lineNumber,
      startColumn,
      endColumn,
      alt,
      url,
      width: widthMatch ? widthMatch[1] : null,
      align: alignMatch ? (alignMatch[1] as ImageAlign) : null,
    }
  }, [])

  const applyImageAltEdit = (
    img: NonNullable<typeof imageAtCursor>,
    newAlt: string,
    nextState: Partial<NonNullable<typeof imageAtCursor>>,
  ) => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    const newText = `![${newAlt}](${img.url})`

    editor.executeEdits('image-update', [
      {
        range: new monaco.Range(img.lineNumber, img.startColumn, img.lineNumber, img.endColumn),
        text: newText,
        forceMoveMarkers: true,
      },
    ])

    editor.focus()

    setImageAtCursor({
      ...img,
      alt: newAlt,
      endColumn: img.startColumn + newText.length,
      ...nextState,
    })
  }

  const updateImageWidth = (widthValue: string) => {
    const img = imageAtCursor
    if (!img) return

    let newAlt = img.alt
      .replace(/\s*width:\d+%?/g, '')
      .replace(/\s*width:\d+px/g, '')
      .trim()

    if (widthValue && widthValue !== 'auto') {
      newAlt = newAlt ? `${newAlt} width:${widthValue}` : `width:${widthValue}`
    }

    applyImageAltEdit(img, newAlt, {
      width: widthValue === 'auto' ? null : widthValue,
    })
  }

  const updateImageAlign = (alignValue: ImageAlign) => {
    const img = imageAtCursor
    if (!img) return

    let newAlt = img.alt.replace(/\s*align:(left|center|right)/g, '').trim()

    if (alignValue) {
      newAlt = newAlt ? `${newAlt} align:${alignValue}` : `align:${alignValue}`
    }

    applyImageAltEdit(img, newAlt, { align: alignValue })
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    
    imageFiles.forEach(file => {
      handleImageUpload(file)
    })
  }

  // Apply Monaco decorations to show slide regions on the scrollbar
  // and fade out all lines outside the currently active slide
  const applyDecorations = useCallback(() => {
    const editor = editorRef.current
    const monaco = monacoRef.current
    if (!editor || !monaco) return

    const model = editor.getModel()
    if (!model) return

    const value = model.getValue()
    const ranges = getSlideLineRanges(value)
    const storeIndex = useStore.getState().currentSlideIndex
    const activeSlide = Math.max(0, Math.min(storeIndex, ranges.length - 1))
    const activeRange = ranges[activeSlide]
    const lineCount = model.getLineCount()

    const newDecorations: EditorDecoration[] = []

    // Fade everything before the active slide
    if (activeRange.startLine > 1) {
      newDecorations.push({
        range: new monaco.Range(1, 1, activeRange.startLine - 1, 1),
        options: {
          isWholeLine: true,
          inlineClassName: 'monaco-faded-line',
        },
      })
    }

    // Fade everything after the active slide
    if (activeRange.endLine < lineCount) {
      newDecorations.push({
        range: new monaco.Range(activeRange.endLine + 1, 1, lineCount, 1),
        options: {
          isWholeLine: true,
          inlineClassName: 'monaco-faded-line',
        },
      })
    }

    // Overview ruler colors per slide
    ranges.forEach((range, index) => {
      newDecorations.push({
        range: new monaco.Range(range.startLine, 1, range.endLine, 1),
        options: {
          isWholeLine: true,
          overviewRuler: {
            color: index === activeSlide
              ? 'rgba(199, 91, 57, 0.9)'
              : 'rgba(128, 128, 128, 0.25)',
            position: monaco.editor.OverviewRulerLane.Full,
          },
        },
      })
    })

    decorationsRef.current = editor.deltaDecorations(decorationsRef.current, newDecorations)
  }, [])

  const handleEditorDidMount = useCallback<OnMount>((editor, monaco) => {
    editorRef.current = editor
    monacoRef.current = monaco
    setEditorRef(editorRef)

    // Register jump-to-line function for preview click
    setJumpToLine((line: number) => {
      editor.setPosition({ lineNumber: line, column: 1 })
      editor.revealLineInCenter(line)
      editor.focus()
    })
    
    // Image paste handler
    const pasteHandler = (e: ClipboardEvent) => {
      const dt = e.clipboardData
      if (!editor.hasTextFocus()) return
      if (!dt) return

      const imageFiles: File[] = []

      if (dt.items) {
        for (let i = 0; i < dt.items.length; i++) {
          const item = dt.items[i]
          if (item.kind === 'file' && item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) imageFiles.push(file)
          }
        }
      }

      if (imageFiles.length === 0 && dt.files) {
        for (let i = 0; i < dt.files.length; i++) {
          if (dt.files[i].type.startsWith('image/')) {
            imageFiles.push(dt.files[i])
          }
        }
      }

      if (imageFiles.length === 0) return

      e.preventDefault()
      e.stopPropagation()

      imageFiles.forEach(file => handleImageUpload(file))
    }

    window.addEventListener('paste', pasteHandler, true)

    // Ctrl/Cmd + B toggle bold
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, toggleBold)
    
    // Initial decorations
    applyDecorations()
    
    // Update decorations when content changes (debounced for performance)
    const contentDisposable = editor.onDidChangeModelContent(() => {
      if (debouncedApplyRef.current) clearTimeout(debouncedApplyRef.current)
      debouncedApplyRef.current = setTimeout(() => {
        applyDecorations()
      }, 150)
    })
    
    // Update decorations and sync slide index when cursor moves
    const cursorDisposable = editor.onDidChangeCursorPosition(() => {
      applyDecorations()
      setImageAtCursor(detectImageAtCursor())

      const pos = editor.getPosition()
      if (pos) {
        const model = editor.getModel()
        if (model) {
          const ranges = getSlideLineRanges(model.getValue())
          let slideIndex = ranges.findIndex(
            r => pos.lineNumber >= r.startLine && pos.lineNumber <= r.endLine
          )
          if (slideIndex === -1) {
            if (pos.lineNumber < (ranges[0]?.startLine ?? 1)) {
              slideIndex = 0
            } else if (pos.lineNumber > (ranges[ranges.length - 1]?.endLine ?? 1)) {
              slideIndex = ranges.length - 1
            }
          }
          if (slideIndex !== -1) {
            const storeIndex = useStore.getState().currentSlideIndex
            if (slideIndex !== storeIndex) {
              useStore.getState().setCurrentSlideIndex(slideIndex)
            }
          }
        }
      }
    })
    
    return () => {
      contentDisposable.dispose()
      cursorDisposable.dispose()
      window.removeEventListener('paste', pasteHandler, true)
      editor.dispose()
      editorRef.current = null
      monacoRef.current = null
      setEditorRef(null)
    }
  }, [setEditorRef, setJumpToLine, detectImageAtCursor, applyDecorations, handleImageUpload, toggleBold])

  const handleChange = useCallback(
    (value: string | undefined) => {
      if (value !== undefined) {
        setMarkdown(value)
      }
    },
    [setMarkdown]
  )
  
  const debouncedHandleChange = useMemo(() => debounce(handleChange, 50), [handleChange])

  // Cleanup debounced timers on unmount
  useEffect(() => {
    return () => {
      if (debouncedApplyRef.current) clearTimeout(debouncedApplyRef.current)
    }
  }, [])

  // Re-apply decorations when currentSlideIndex changes from preview navigation
  useEffect(() => {
    applyDecorations()
  }, [currentSlideIndex, applyDecorations])

  const toolbarItems = [
    { icon: Bold, command: 'bold', title: 'Bold' },
    { icon: Italic, command: 'italic', title: 'Italic' },
    { icon: Heading1, command: 'h1', title: 'Heading 1' },
    { icon: Heading2, command: 'h2', title: 'Heading 2' },
    { icon: List, command: 'ul', title: 'Bullet list' },
    { icon: ListOrdered, command: 'ol', title: 'Numbered list' },
    { icon: Quote, command: 'quote', title: 'Quote' },
    { icon: Code, command: 'code', title: 'Code block' },
    { icon: Link, command: 'link', title: 'Link' },
    { icon: Image, command: 'image', title: 'Image' },
    { icon: Table, command: 'table', title: 'Table' },
    { icon: LayoutTemplate, command: 'slide-break', title: 'Slide break' },
  ]

  const runToolbarCommand = (command: string) => {
    switch (command) {
      case 'bold':
        insertText('**', '**')
        break
      case 'italic':
        insertText('*', '*')
        break
      case 'h1':
        insertText('# ')
        break
      case 'h2':
        insertText('## ')
        break
      case 'ul':
        insertText('- ')
        break
      case 'ol':
        insertText('1. ')
        break
      case 'quote':
        insertText('> ')
        break
      case 'code':
        insertText('```\n', '\n```')
        break
      case 'link':
        insertText('[', '](url)')
        break
      case 'image':
        insertText('![alt](', ')')
        break
      case 'table':
        insertText('| Col1 | Col2 |\n|------|------|\n| Data | Data |\n')
        break
      case 'slide-break':
        insertSlideBreak()
        break
    }
  }

  return (
    <div 
      className="flex flex-col h-full relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-[var(--accent-muted)] border-2 border-dashed border-[var(--accent)] flex items-center justify-center backdrop-blur-sm">
          <div className="text-center">
            <Upload className="w-12 h-12 text-[var(--accent)] mx-auto mb-3" />
            <p className="text-lg text-[var(--accent)] font-medium">Drop images here</p>
          </div>
        </div>
      )}

      {/* Formatting Toolbar */}
      <div className="flex items-center gap-0.5 px-3 py-2 border-b border-[var(--border-color)] bg-[var(--bg-editor)]">
        {toolbarItems.map((item) => (
          <button
            key={item.title}
            onClick={() => runToolbarCommand(item.command)}
            className="btn-press p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors"
            title={item.title}
            aria-label={item.title}
          >
            <item.icon className="w-4 h-4" />
          </button>
        ))}
        
        <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
        
        <label
          className="btn-press p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)] transition-colors cursor-pointer"
          aria-label="Upload image"
          title="Upload image"
        >
          <Upload className="w-4 h-4" />
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImageUpload(file)
            }}
          />
        </label>

        {imageAtCursor && (
          <>
            <div className="w-px h-5 bg-[var(--border-color)] mx-1" />
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-[var(--text-secondary)] font-mono">Size</span>
              <select
                value={imageAtCursor.width || 'auto'}
                onChange={(e) => updateImageWidth(e.target.value)}
                className="text-xs bg-[var(--bg-panel)] text-[var(--text-primary)] border border-[var(--border-color)] rounded px-1.5 py-1 font-mono outline-none focus:border-[var(--accent)]"
              >
                <option value="auto">Auto</option>
                <option value="25%">25%</option>
                <option value="33%">33%</option>
                <option value="50%">50%</option>
                <option value="66%">66%</option>
                <option value="75%">75%</option>
                <option value="100%">100%</option>
              </select>
            </div>
            <div className="flex items-center gap-0.5 ml-1">
              {(['left', 'center', 'right'] as const).map((side) => {
                const Icon = side === 'left' ? AlignLeft : side === 'center' ? AlignCenter : AlignRight
                const active = imageAtCursor.align === side
                return (
                  <button
                    key={side}
                    onClick={() => updateImageAlign(active ? null : side)}
                    className={`btn-press p-1.5 rounded-md transition-colors ${
                      active
                        ? 'text-[var(--accent)] bg-[var(--bg-panel)]'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-panel)]'
                    }`}
                    aria-label={`Align ${side}`}
                    aria-pressed={active}
                    title={`Align ${side}`}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Monaco Editor */}
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage="markdown"
          value={markdown}
          onChange={debouncedHandleChange}
          onMount={handleEditorDidMount}
          theme="vs-dark"
          loading={
            <div className="flex items-center justify-center h-full text-[var(--text-secondary)]">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span style={{ fontFamily: '"Newsreader", serif' }}>Loading editor...</span>
            </div>
          }
          options={{
            minimap: { enabled: false },
            lineNumbers: 'on',
            wordWrap: 'on',
            stopRenderingLineAfter: 1000,
            fontSize: 14,
            fontFamily: '"Source Code Pro", monospace',
            fontLigatures: true,
            padding: { top: 16, bottom: 16 },
            scrollBeyondLastLine: false,
            smoothScrolling: true,
            renderLineHighlight: 'line',
            lineHeight: 1.6,
            folding: true,
            automaticLayout: true,
            quickSuggestions: false,
            suggestOnTriggerCharacters: false,
          }}
        />
      </div>

      {/* Status Bar */}
      <div className="flex items-center justify-between px-4 py-1.5 border-t border-[var(--border-color)] bg-[var(--bg-editor)] text-xs text-[var(--text-secondary)] font-mono">
        <div className="flex items-center gap-4">
          <span>{markdown.split(/\s+/).filter(Boolean).length} words</span>
          <span>{splitIntoSlides(markdown).length} slides</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${isDirty ? 'bg-[var(--accent)]' : 'bg-emerald-500'}`} />
          <span>{isDirty ? 'Unsaved changes' : 'Saved'}</span>
        </div>
      </div>
    </div>
  )
}
