# Code Review: MarpEditor

Reviewed: 2026-05-11
Scope: Full source (`src/`), config, and architecture

## Summary

The codebase is well-structured for a single-person project. Component boundaries are sensible, Zustand is used correctly with selectors, and the "Monolithic Editorial" aesthetic is consistently applied. However, there are **real bugs, DRY violations, and architectural inconsistencies** that would get called out in an open-source review.

---

## Must Fix (Real Bugs)

### 1. Memory leak in `PreviewPanel` — SVG click listeners accumulate
**File:** `src/components/PreviewPanel.tsx`, lines 36-51

Every time `previewHtml` changes, the effect re-runs, writes new HTML to the iframe, and attaches fresh click listeners to SVGs. The old listeners are never removed. Since `doc.open()/doc.write()/doc.close()` destroys the old DOM, the listeners are technically orphaned — but this pattern is fragile. If the write strategy ever changes, you leak memory.

**Fix:** Use event delegation on the document body instead of per-SVG listeners, or explicitly remove listeners before `doc.open()`.

### 2. Debounced timers never cleaned up on unmount
**File:** `src/components/EditorPanel.tsx`

`debouncedApplyRef` (line 37) and `debouncedHandleChange` (line 388) both create timeouts that can fire after the component unmounts. React 19 StrictMode will double-mount in dev, making this visible.

**Fix:** Clear both timers in a `useEffect` cleanup.

### 3. `useKeyboardShortcuts` fires during presentation mode
**File:** `src/hooks/useKeyboardShortcuts.ts`

When `PresentationMode` is active, both its own `keydown` handler and the global shortcut handler fire. Pressing `Ctrl+E` during a presentation opens the Export Modal behind the fullscreen overlay. The global handler does not check `isPresentationMode`.

**Fix:** Add an early return in `handleKeyDown` when `isPresentationMode` is true.

### 4. Vite PWA manifest references missing icon
**File:** `vite.config.ts`, line 34

The manifest references `/vite.svg`, but the actual file in `public/` is `favicon.svg`. This causes a 404 on PWA install.

**Fix:** Change manifest icon `src` to `/favicon.svg`.

### 5. `window.open` without `noopener,noreferrer`
**File:** `src/components/ExportModal.tsx`, lines 39, 79

`exportPDF` and `exportGoogleSlides` open windows without security flags. `exportPDF` also writes to `printWindow.document` after opening `about:blank`, which is fine, but the Google Slides case should use `window.open(url, '_blank', 'noopener,noreferrer')`.

### 6. Recovery cache writes block the main thread on every keystroke
**File:** `src/lib/store.ts`, lines 90-98

`setMarkdown` writes to `localStorage` synchronously on every keystroke (the 50ms Monaco debounce doesn't help here). On large presentations with embedded base64 images, this causes visible typing lag.

**Fix:** Debounce the recovery cache write, not just the state update.

---

## Should Fix (Architecture / DRY)

### 7. `generatePreviewHtml` and `generatePresentationHtml` are ~70% identical
**File:** `src/lib/utils.ts`, lines 210-361

Two massive template literals duplicating CSS rules, theme injection, and logo handling. Any theme change requires editing both.

**Fix:** Extract a shared `generateMarpHtml(markdown, theme, images, mode: 'preview' | 'presentation')` function.

### 8. `resolveImagesForMarkdownExport` is a pointless alias
**File:** `src/lib/utils.ts`, lines 120-125

It just calls `resolveImages`. Remove it and call `resolveImages` directly from `storage.ts`.

### 9. `useMarpRenderer.ts` referenced in docs but doesn't exist
**File:** `AGENTS.md` (line 39) claims it exists. It doesn't.

**Fix:** Remove the reference from `AGENTS.md` or create the file if needed. Since it's unused, delete the reference.

### 10. `AGENTS.md` is outdated on dependencies
**File:** `AGENTS.md`

- Claims `pptxgenjs` is used for PowerPoint export — actually uses Tauri/Marp CLI.
- Claims `html2canvas` and `jspdf` are listed in `package.json` — they're not.

**Fix:** Update the dependency section to reflect actual stack.

### 11. Store hydration race condition for images
**File:** `src/lib/store.ts`, lines 294-301

The store initializes with `images: {}`, then asynchronously loads from IndexedDB. If a document with `image:ID` references renders before the DB loads, images appear as broken. There's no loading state.

**Fix:** Initialize images from localStorage fallback synchronously, or show a loading state.

### 12. Monaco editor not disposed on unmount
**File:** `src/components/EditorPanel.tsx`

The `onMount` return function disposes content/cursor disposables but never calls `editor.dispose()`. In StrictMode double-mounts, this leaks editor instances.

**Fix:** Call `editor.dispose()` in cleanup.

### 13. `getSlideTitle` fails on slides with leading whitespace
**File:** `src/lib/utils.ts`, lines 96-101

```ts
const trimmed = content.trim()
const match = trimmed.match(/^#+\s+(.+)$/m)
```

If a slide starts with a blank line then a heading, `trim()` removes it and the match works. Actually this one is fine. But if the slide has no heading at all, it returns "Untitled Slide" which is okay.

Wait — actually the real bug: if `trimmed` is empty it returns '(empty)', otherwise it searches for a heading. If there's no heading, it returns 'Untitled Slide'. This is acceptable behavior.

### 14. `handleOpen` and `handleSave` in Toolbar are unnecessary `useCallback` wrappers
**File:** `src/components/Toolbar.tsx`, lines 26-35

They just proxy to store methods. The `useCallback` adds dependency tracking overhead with zero benefit.

**Fix:** Inline them or use `useStore.getState()` directly in the JSX `onClick`.

---

## Could Improve (Polish)

### 15. No Error Boundary
Any React error (e.g., Marp throwing on malformed markdown) crashes the entire app.

### 16. No `aria-label` on icon-only buttons
Most toolbar buttons lack accessible labels.

### 17. `generateId()` uses `Math.random()`
Acceptable for image IDs, but `crypto.randomUUID()` is available in all target browsers.

### 18. `PreviewPanel` iframe `sandbox` doesn't mitigate the acknowledged XSS risk
**File:** `src/components/PreviewPanel.tsx`, line 135

`allow-scripts` means malicious HTML in Markdown can execute JavaScript in the iframe. The AGENTS.md acknowledges this but the sandbox isn't restrictive enough to actually help.

### 19. Inconsistent store access pattern
Some callbacks use `useStore.getState()` inside event handlers (good — no stale closures), others use hook selectors then pass them through `useCallback` deps (also fine, but inconsistent).

---

## What Works Well

- **Zustand selectors** are used properly to minimize re-renders.
- **Monaco decorations** for slide fading are a nice UX touch.
- **IndexedDB migration** from localStorage is thoughtful.
- **File System Access API** with graceful fallback.
- **Tailwind + CSS variables** hybrid works well for the dark theme.
- **Debounced color pickers** in StylePanel prevent re-render storms.
