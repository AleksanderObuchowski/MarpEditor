# AGENTS.md — MarpEditor

> This file contains project-specific context for AI coding agents. The reader is assumed to know nothing about this codebase.

## Project Overview

**MarpEditor** is a single-page web application for creating presentations using Markdown with Marp extensions. It provides a split-pane interface: a Monaco Editor (VS Code editor) on the left for writing Markdown, and a live-rendered slide preview on the right. The app is designed as a PWA (Progressive Web App) and can be installed on desktop or mobile.

The design aesthetic is called **"Monolithic Editorial"**: a nearly monochromatic dark interface with a single warm terracotta accent (`#c75b39`), Newsreader serif font for UI chrome, and Source Code Pro monospace for the editor.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19 (with StrictMode) |
| Language | TypeScript ~6.0 |
| Build Tool | Vite 8 |
| Styling | Tailwind CSS 3 + custom CSS variables |
| Editor | `@monaco-editor/react` (Monaco Editor) |
| Slide Rendering | `@marp-team/marp-core` |
| State Management | Zustand 5 |
| Export (PPTX) | `pptxgenjs` (dynamically imported) |
| Icons | `lucide-react` |
| PWA | `vite-plugin-pwa` with Workbox |

## Project Structure

```
src/
  App.tsx                    -- Root layout: toolbar + 58/42 split panes + modals
  main.tsx                   -- React root entry point
  index.css                  -- Tailwind directives, CSS variables, custom animations
  types/
    index.ts                 -- ThemeSettings, Slide, EditorState, ExportFormat, TableData
  lib/
    store.ts                 -- Zustand store: markdown, theme, UI state, images, editor ref
    utils.ts                 -- Marp rendering, preview HTML generation, helpers, DEFAULT_MARKDOWN
  hooks/
    useKeyboardShortcuts.ts  -- Global Ctrl/Cmd + S/E/N shortcuts
  components/
    Toolbar.tsx              -- App header: logo, Add Slide, Style toggle, Export button
    EditorPanel.tsx          -- Monaco Editor + formatting toolbar + drag-drop image upload + status bar
    PreviewPanel.tsx         -- iframe preview with slide navigation + print-to-PDF button
    StylePanel.tsx           -- Right-side panel for theme presets, colors, fonts, slide size
    ExportModal.tsx          -- Modal with export options: MD, PDF, PPTX, Google Slides
public/
  favicon.svg
  icons.svg
dist/                        -- Production build output (vite build)
```

## Build & Development Commands

All commands are defined in `package.json`:

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Production build (TypeScript check + Vite build)
npm run build

# Preview production build locally
npm run preview

# Run ESLint
npm run lint
```

There is **no test suite** configured. The project has no Vitest, Jest, Playwright, or other testing framework.

## Key Configuration Files

- **`vite.config.ts`** — Vite + React plugin + PWA plugin. Manual chunks split `monaco`, `marp`, and `pptx` into separate bundles. PWA manifest name is "MarpEditor".
- **`tsconfig.app.json`** — TypeScript for the app. Target `es2023`, `jsx: react-jsx`, `moduleResolution: bundler`, `verbatimModuleSyntax: true`. Strict flags: `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noFallthroughCasesInSwitch`.
- **`tsconfig.node.json`** — TypeScript for Vite config.
- **`eslint.config.js`** — Flat ESLint config. Extends `@eslint/js/recommended`, `typescript-eslint/recommended`, `react-hooks/flat-recommended`, `react-refresh/vite`. Ignores `dist`.
- **`tailwind.config.js`** — Custom theme extensions: `fontFamily.newsreader`, `fontFamily.mono`, colors `charcoal`, `offwhite`, `terracotta`.
- **`postcss.config.js`** — Standard Tailwind + autoprefixer setup.
- **`index.html`** — Loads Google Fonts (Newsreader + Source Code Pro).

## State Management (Zustand)

The global store (`src/lib/store.ts`) holds:

- `markdown: string` — The full Marp Markdown document. Persisted to `localStorage` key `marp-editor-content`.
- `currentSlideIndex: number` — Active slide for preview navigation.
- `theme: ThemeSettings` — Background color, font color, font family, accent color, slide size. Persisted to `localStorage` key `marp-editor-theme`.
- `images: Record<string, string>` — Base64 image data keyed by generated IDs. Persisted to `localStorage` key `marp-editor-images`.
- `isStylePanelOpen / isExportModalOpen: boolean` — Modal visibility flags.
- `editorRef: React.MutableRefObject<any> | null` — Reference to the Monaco editor instance for cursor insertion and slide appending.

On module init, the store hydrates itself from `localStorage`.

## Slide Model

Slides are separated by `---` (horizontal rule) lines in the Markdown. The `splitIntoSlides()` utility splits on `/^---\s*$/m`. The first "slide" may include the Marp frontmatter block (`---\nmarp: true\n...\n---`).

Default content is defined in `DEFAULT_MARKDOWN` inside `src/lib/utils.ts`.

## Image Handling

- Users can drag-and-drop or upload images into the editor. Images are inserted as standard Markdown `![alt](dataUrl)`.
- There is also a legacy image reference format `![alt](image:ID)` resolved via the `images` store map. This is handled by `resolveImages()` before rendering.
- Images are stored as base64 strings in `localStorage`, which has practical size limits.

## Export Architecture

| Format | Implementation |
|--------|---------------|
| Markdown | Blob download of raw `.md` text |
| PDF | Opens a new window with `printWindow.print()` containing slide-styled HTML |
| PowerPoint | Dynamic import of `pptxgenjs`, parses Markdown lines into text boxes per slide. Basic formatting only (headings, lists, bold/italic stripped to plain text). |
| Google Slides | Opens `https://docs.google.com/presentation/create` in a new tab |

## Keyboard Shortcuts

Handled globally in `useKeyboardShortcuts.ts`, but **ignored when focus is in an input/textarea/contentEditable**:

| Shortcut | Action |
|----------|--------|
| Ctrl/Cmd + S | No-op (auto-save is always on) |
| Ctrl/Cmd + E | Open Export modal |
| Ctrl/Cmd + N | Append a new slide at the end |

## Styling Conventions

- **Tailwind** is used for layout and utility classes.
- **CSS custom properties** (in `index.css`) define the dark theme palette. Components reference them directly, e.g., `bg-[var(--bg-primary)]`.
- **Custom utility classes** defined in `index.css`:
  - `.editor-texture` — Blueprint grid background on the editor panel.
  - `.btn-press` — 150ms press-down animation (`transform: scale(0.96)`).
  - `.slide-enter` — 200ms fade-in + scale entrance.
  - `.panel-enter` — 200ms slide-in from left.
- **Font usage**:
  - UI chrome / headings: `"Newsreader", serif`
  - Editor / status bar / monospace needs: `"Source Code Pro", monospace`
  - Slide content: `system-ui, sans-serif` (or the user-selected theme font)

## Development Guidelines

- Use **TypeScript** for all new code. The compiler enforces `noUnusedLocals` and `noUnusedParameters` — unused variables will fail the build.
- Use **`verbatimModuleSyntax: true`** — import types with `import type { ... }`.
- The project is an **ES Module** (`"type": "module"`). All source files use `.ts` / `.tsx`.
- Follow the existing component pattern: functional components, default exports, `lucide-react` for icons.
- When adding new store state, remember to add the setter/getter in `src/lib/store.ts` and persist to `localStorage` if the data should survive reloads.
- The Monaco editor instance is accessed via a ref stored in Zustand (`editorRef`). Use `insertAtCursor()` or direct Monaco APIs for text manipulation.

## Testing

There is **no testing infrastructure** in this project. If you add tests, you will need to install and configure a test runner (e.g., Vitest) yourself.

## Security Considerations

- **XSS via Marp**: `Marp` is initialized with `html: true`, which allows raw HTML inside Markdown. User-generated content is rendered into an `<iframe sandbox="allow-same-origin">`, which provides some isolation, but be cautious if relaxing sandbox restrictions.
- **localStorage**: All content, images, and theme settings are stored unencrypted in the browser's `localStorage`. There is no server-side persistence.
- **No auth / backend**: This is a fully client-side application. There are no API keys, secrets, or server endpoints.

## Deployment

The app builds to a static site in `dist/`.

```bash
npm run build
```

The PWA manifest and service worker are generated automatically by `vite-plugin-pwa`. The `dist/` folder can be served by any static file host (e.g., Netlify, Vercel, GitHub Pages, S3).

## Dependencies of Note

- `@marp-team/marp-core` — Renders Markdown + Marp directives into SVG-based slides.
- `@monaco-editor/react` — Lazy-loads the Monaco editor. It is split into its own chunk by Vite.
- `pptxgenjs` — Dynamically imported only when PowerPoint export is triggered, keeping the initial bundle small.

