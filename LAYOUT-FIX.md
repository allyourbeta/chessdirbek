# Layout Fix — Exact Changes

Apply these EXACT changes to the specified files. Do not modify any other properties or files.

## File 1: `frontend/css/components.css`

### Change A: Replace lines 592-612 (the `.collection-landing`, `.collection-featured`, `.collection-browse` block) with exactly this:

```css
.collection-landing {
  display: grid;
  grid-template-columns: 420px auto;
  gap: 60px;
  align-items: start;
}
.collection-featured {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: var(--sp-5);
  box-shadow: var(--shadow-sm);
}
.collection-browse {
  min-width: 0;
}
```

Key changes explained:
- `.collection-landing`: left column is `420px`, right column is `auto` (shrinks to fit content). Removed `padding-left`.
- `.collection-featured`: background is `var(--surface)` (pure white), not `#faf8f5`.
- `.collection-browse`: ALL styling removed — no background, no border, no padding, no shadow. It's just a transparent container now. The individual `.pos-item` cards provide their own visual structure. This prevents the "huge white box with small cards inside" problem.

### Change B: Replace lines 36-39 (the `.pos-list` block) with exactly this:

```css
.pos-list {
  display: grid;
  grid-template-columns: repeat(3, 180px);
  gap: var(--sp-4);
}
```

Key changes: fixed 180px columns instead of `1fr`, gap reduced from `--sp-8` (32px) to `--sp-4` (16px) since smaller cards need less gap.

### Change C: Add these rules after the `.pos-item:hover .pos-item-delete` block (after line 99):

```css
.pos-item .mini-board {
  opacity: 0.77;
  transition: opacity 0.15s ease;
}
.pos-item:hover .mini-board {
  opacity: 1;
}
```

### Change D: In `.pos-item .title` (line 73), change `font-size: var(--fs-18)` to `font-size: var(--fs-14)` since cards are now smaller.

### Change E: In `.collection-header-row` (line 652), add `margin-bottom: var(--sp-3);` (change from 14px to 12px — minor tweak for tighter header).

## File 2: `frontend/manifest.json`

Change `"theme_color": "#c9a84c"` to `"theme_color": "#f5f3ef"`.

This makes the macOS PWA title bar match the warm page background instead of showing a gold bar.

## File 3: `frontend/sw.js`

Change `CACHE_NAME` from `'chessdirbek-v2'` to `'chessdirbek-v5'`.

## IMPORTANT: After applying, you MUST uninstall and reinstall the PWA for the title bar color change to take effect. The manifest theme_color is read at install time.

## Do NOT change:
- style.css (no changes needed)
- Any JS files
- Any backend files
- Any other CSS properties not listed above
