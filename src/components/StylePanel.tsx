import { useState, useLayoutEffect, useMemo } from 'react'
import { X, Type, Palette, Image, Layout, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { debounce } from '../lib/utils'

const FONT_OPTIONS = [
  { label: 'System', value: 'system-ui, -apple-system, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: '"Courier New", monospace' },
  { label: 'Newsreader', value: '"Newsreader", serif' },
]

const THEME_PRESETS = [
  { name: 'Editorial', bg: '#ffffff', color: '#1a1a1a', accent: '#c75b39' },
  { name: 'Darkroom', bg: '#0a0a0a', color: '#e8e4dc', accent: '#c75b39' },
  { name: 'Blueprint', bg: '#1e3a5f', color: '#ffffff', accent: '#60a5fa' },
  { name: 'Minimal', bg: '#f5f2eb', color: '#1a1a1a', accent: '#1a1a1a' },
  { name: 'Warm', bg: '#faf6f1', color: '#3d2b1f', accent: '#c75b39' },
]

export default function StylePanel() {
  const theme = useStore((s) => s.theme)
  const setTheme = useStore((s) => s.setTheme)
  const setStylePanelOpen = useStore((s) => s.setStylePanelOpen)

  // Local state for smooth color picker interaction (avoids re-rendering whole app on every mousemove)
  const [localColors, setLocalColors] = useState({
    backgroundColor: theme.backgroundColor,
    fontColor: theme.fontColor,
    accentColor: theme.accentColor,
  })

  useLayoutEffect(() => {
    // Sync local color pickers when theme changes from presets or external sources
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocalColors({
      backgroundColor: theme.backgroundColor,
      fontColor: theme.fontColor,
      accentColor: theme.accentColor,
    })
  }, [theme.backgroundColor, theme.fontColor, theme.accentColor])

  const debouncedSetTheme = useMemo(
    () => debounce((update: Partial<typeof theme>) => setTheme(update), 100),
    [setTheme]
  )

  return (
    <div className="fixed right-0 top-14 bottom-0 w-80 bg-[var(--bg-panel)] border-l border-[var(--border-color)] z-30 panel-enter shadow-[-8px_0_32px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
        <h2 
          className="text-lg font-medium"
          style={{ fontFamily: '"Newsreader", serif' }}
        >
          Style Settings
        </h2>
        <button
          onClick={() => setStylePanelOpen(false)}
          className="btn-press p-1.5 rounded-md text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-charcoal)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-5 space-y-6 overflow-y-auto h-[calc(100%-65px)]">
        {/* Theme Presets */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Palette className="w-4 h-4" />
            Theme Presets
          </label>
          <div className="grid grid-cols-2 gap-2">
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                onClick={() => setTheme({
                  backgroundColor: preset.bg,
                  fontColor: preset.color,
                  accentColor: preset.accent,
                })}
                className={`p-3 rounded-lg border transition-all ${
                  theme.backgroundColor === preset.bg && theme.fontColor === preset.color
                    ? 'border-[var(--accent)] bg-[var(--accent-muted)]'
                    : 'border-[var(--border-color)] hover:border-[var(--text-secondary)]'
                }`}
              >
                <div 
                  className="w-full h-8 rounded mb-2"
                  style={{ backgroundColor: preset.bg }}
                />
                <span className="text-xs text-[var(--text-secondary)]">{preset.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Background Color */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Image className="w-4 h-4" />
            Background Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={localColors.backgroundColor}
              onChange={(e) => {
                const value = e.target.value
                setLocalColors(prev => ({ ...prev, backgroundColor: value }))
                debouncedSetTheme({ backgroundColor: value })
              }}
              className="w-10 h-10 rounded-lg border border-[var(--border-color)] cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={localColors.backgroundColor}
              onChange={(e) => {
                const value = e.target.value
                setLocalColors(prev => ({ ...prev, backgroundColor: value }))
                setTheme({ backgroundColor: value })
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-charcoal)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Font Color */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Type className="w-4 h-4" />
            Font Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={localColors.fontColor}
              onChange={(e) => {
                const value = e.target.value
                setLocalColors(prev => ({ ...prev, fontColor: value }))
                debouncedSetTheme({ fontColor: value })
              }}
              className="w-10 h-10 rounded-lg border border-[var(--border-color)] cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={localColors.fontColor}
              onChange={(e) => {
                const value = e.target.value
                setLocalColors(prev => ({ ...prev, fontColor: value }))
                setTheme({ fontColor: value })
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-charcoal)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>

        {/* Font Family */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Type className="w-4 h-4" />
            Font Family
          </label>
          <select
            value={theme.fontFamily}
            onChange={(e) => setTheme({ fontFamily: e.target.value })}
            className="w-full px-3 py-2.5 rounded-lg bg-[var(--bg-charcoal)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent)]"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font.value} value={font.value}>{font.label}</option>
            ))}
          </select>
        </div>

        {/* Slide Size */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Layout className="w-4 h-4" />
            Slide Size
          </label>
          <div className="flex gap-2">
            {(['16:9', '4:3', '16:10'] as const).map((size) => (
              <button
                key={size}
                onClick={() => setTheme({ slideSize: size })}
                className={`flex-1 py-2 rounded-lg text-sm transition-colors ${
                  theme.slideSize === size
                    ? 'bg-[var(--accent)] text-white'
                    : 'bg-[var(--bg-charcoal)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-color)]'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Logo */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Image className="w-4 h-4" />
            Logo
          </label>
          
          {theme.logo ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <img 
                  src={theme.logo} 
                  alt="Logo preview" 
                  className="h-12 w-auto object-contain border border-[var(--border-color)] rounded-lg bg-white"
                />
                <button
                  onClick={() => setTheme({ logo: undefined })}
                  className="btn-press p-1.5 rounded-md text-[var(--text-secondary)] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Remove logo"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--text-secondary)]">Size</span>
                  <span className="text-xs font-mono text-[var(--text-primary)]">{theme.logoSize || 120}px</span>
                </div>
                <input
                  type="range"
                  min={20}
                  max={300}
                  step={5}
                  value={theme.logoSize || 120}
                  onChange={(e) => setTheme({ logoSize: parseInt(e.target.value) })}
                  className="w-full accent-[var(--accent)]"
                />
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-lg border border-dashed border-[var(--border-color)] hover:border-[var(--accent)] hover:bg-[var(--accent-muted)] transition-colors cursor-pointer">
              <Image className="w-5 h-5 text-[var(--text-secondary)]" />
              <span className="text-sm text-[var(--text-secondary)]">Click to upload logo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    setTheme({ logo: ev.target?.result as string, logoSize: 120 })
                  }
                  reader.readAsDataURL(file)
                }}
              />
            </label>
          )}
        </div>

        {/* Accent Color */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
            <Palette className="w-4 h-4" />
            Accent Color
          </label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={localColors.accentColor}
              onChange={(e) => {
                const value = e.target.value
                setLocalColors(prev => ({ ...prev, accentColor: value }))
                debouncedSetTheme({ accentColor: value })
              }}
              className="w-10 h-10 rounded-lg border border-[var(--border-color)] cursor-pointer bg-transparent"
            />
            <input
              type="text"
              value={localColors.accentColor}
              onChange={(e) => {
                const value = e.target.value
                setLocalColors(prev => ({ ...prev, accentColor: value }))
                setTheme({ accentColor: value })
              }}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-charcoal)] border border-[var(--border-color)] text-sm text-[var(--text-primary)] font-mono focus:outline-none focus:border-[var(--accent)]"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
