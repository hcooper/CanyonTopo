# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Canyon Topo editor — a web-based tool for creating and editing topographic diagrams of canyoneering routes. The application renders SVG-based canyon topos from YAML data describing features like rappels, pools, anchors, and terrain lines. It is designed to be embedded in RopeWiki (a MediaWiki installation).

The old implementation lives in `old/` for reference. Active development is in `redux/`.

## Architecture (`redux/`)

Plain JavaScript classes, no build step. The editor is split across multiple files that extend the class via `Object.assign(TopoEditor.prototype, { ... })`.

### Base class

- **`redux/lib/renderer.js`** — `TopoRenderer` base class. Owns: SVG canvas creation, grid drawing, all feature render methods (visual only), zoom/pan state and methods, `screenToSVGCoords()`, `fitToContent()`, middle-mouse pan and mouse-wheel zoom event listeners. Also defines the static `TopoRenderer.FEATURE_SCHEMA` and `TopoRenderer.FEATURE_MIGRATIONS` objects (see below).

### Editor (5 files, loaded in order)

- **`redux/lib/editor.js`** — `TopoEditor extends TopoRenderer`. Core class declaration + constructor, canvas/cursor, event listeners, drawing state machine (`startLine/finishLine/startRappel/finishRappel/startPool/finishPool/cancelDrawing`), cursor snap logic, `selectFeature`, `deleteFeature`, `render`, page bootstrap (`loadPage`, `DOMContentLoaded`). Also owns the box-selection / group-move subsystem: `toggleSelectMode`, `startBoxSelect/updateBoxSelect/endBoxSelect`, `selectFeaturesInBox`, `featurePrimaryPoint`, `featureBounds`, `renderSelectionHighlights`, `startGroupDrag/updateGroupDrag/endGroupDrag`, `applySnapshotWithOffset`.
- **`redux/lib/editor-features.js`** — Per-feature render/drag/update/add methods: `renderLine/Rappel/Pool/Anchor/Note/Access`, `updateLine/…`, `makeLineDraggable/…`, `addPool/Anchor/Rappel/Note/Access`. Also: connection point and midpoint factories (`createConnectionPoint`, `createMidpoint`, `createCurveMidpoint`) and their drag handlers (`makeConnectionPointDraggable`, `makeMidpointDraggable`, `makeCurveMidpointDraggable`, `makePoolCurveMidpointDraggable`, `makeRappelTextDraggable`, `makeAnchorNameDraggable`, `makeNoteTextDraggable`).
- **`redux/lib/editor-ui.js`** — Toolbar, controls bar, right-click context menu, properties panel: `createToolbar`, `createControls`, `showContextMenu/hideContextMenu`, `updatePropertiesPanel`. Also declares a stub `renderFeatureList()` (overridden by `editor-feature-list.js`).
- **`redux/lib/editor-feature-list.js`** — Feature list sidebar: `getSortedFeatures`, `renderFeatureList`. Renders the route as a spine-flattened ASCII tree; branches (anchors, notes, mid-route access features) indent to the right.
- **`redux/lib/editor-io.js`** — Persistence and history: `saveState`, `undo/redo`, `restoreState`, `updateUndoRedoButtons`, `toYAML`, `loadFromYAML`, `exportSVG`, `exportPNG`, `exportData`, `importData`, `isEditMode`, `wikiPageName`, `saveToWiki`.

### Viewer (1 file)

- **`redux/lib/viewer.js`** — `TopoViewer extends TopoRenderer`. Read-only view. Overrides `drawGrid()` to a no-op. Has a file-load button and zoom controls only.

## Key Files

- `redux/index.html` — Editor entry point
- `redux/viewer.html` — Viewer entry point
- `redux/key.html` — Visual legend showing all feature types with live-rendered examples using TopoRenderer
- `redux/style.css` — Shared stylesheet
- `redux/deps/js-yaml.min.js` — YAML parsing (jsyaml)
- `old/` — Previous implementation (kept for reference)

## Script Load Order

The editor page loads scripts in this order:
1. `deps/js-yaml.min.js`
2. `lib/renderer.js`
3. `lib/editor.js`
4. `lib/editor-features.js`
5. `lib/editor-ui.js`
6. `lib/editor-feature-list.js`
7. `lib/editor-io.js`

The viewer page loads:
1. `deps/js-yaml.min.js`
2. `lib/renderer.js`
3. `lib/viewer.js`

## Testing

Visual regression tests are located in `tests/` and use Playwright for headless browser automation and pixelmatch for pixel-by-pixel comparison.

- **`tests/visual-regression.js`** — Main test runner. Loads YAML fixtures, renders them in a headless browser using `test-viewer.html`, captures screenshots, and compares against reference images. Tests pass if pixel difference is below 1% threshold.
- **`tests/update-references.js`** — Helper script to copy output images to reference directory (run after intentional visual changes).
- **`tests/test-viewer.html`** — Test-specific viewer with relative paths (required for headless browser environment).
- **`tests/fixtures/`** — YAML test fixtures (davis.yaml, basic-features.yaml, edge-cases.yaml, all-note-types.yaml).
- **`tests/reference/`** — "Golden" reference images for comparison.
- **`tests/output/`** — Generated screenshots (gitignored).
- **`tests/diffs/`** — Diff images showing pixel differences for failed tests (gitignored).

Run tests with `npm test`. Update references after intentional visual changes with `npm run test:update-refs`. See `tests/README.md` for details.

## Keyboard Shortcuts

All shortcuts are disabled when typing in input fields or textareas.

### Tools
- **V** — Cursor mode (exit drawing/select modes)
- **S** — Select mode (box select and group move)
- **L** — Line tool (click-drag to draw)
- **R** — Rappel tool (click-drag to draw)
- **P** — Pool tool (click-drag to draw)
- **A** — Add anchor at viewport center
- **N** — Add note at viewport center
- **X** — Add access point at viewport center
- **I** — Add info box (title/grade) at viewport center

### Editing
- **Ctrl+Z** / **Cmd+Z** — Undo
- **Ctrl+Shift+Z** / **Cmd+Shift+Z** / **Ctrl+Y** — Redo
- **Ctrl+S** / **Cmd+S** — Save to wiki (if in edit mode)
- **Delete** / **Backspace** — Delete selected feature(s)
- **Escape** — Cancel active drawing, or clear selection (first press), or exit select mode (second press)

### View
- **+** / **=** — Zoom in
- **-** — Zoom out
- **0** — Reset zoom and pan to 1:1

## Prototype Extension Pattern

`editor-features.js`, `editor-ui.js`, `editor-feature-list.js`, and `editor-io.js` each use:

```javascript
Object.assign(TopoEditor.prototype, {
  methodName(args) { ... },
  // ...
});
```

This requires no build step. All methods share `this` (the `TopoEditor` instance) as usual. Cross-file method calls work because prototype lookups are resolved at runtime — all files must be loaded before `new TopoEditor()` is called.

**`super` does not work in extension files.** Methods defined in `Object.assign({...})` have their `[[HomeObject]]` set to the temporary object literal, not `TopoEditor.prototype`, so `super.foo()` resolves against `Object.prototype` and throws. Use the explicit form instead:

```javascript
// WRONG — super resolves against Object.prototype, throws at runtime
const group = super.renderLine(line);

// CORRECT — explicit prototype call
const group = TopoRenderer.prototype.renderLine.call(this, line);
```

## Embedding in MediaWiki

`TopoContentHandler/includes/TopoEditAction.php` injects the editor by outputting all 7 `<script>` tags (plus `raw_yaml` as a JS global) into the page via `addHTML()`.

- `raw_yaml` — YAML string preloaded from the wiki page content (empty string for new pages).
- Saving uses `mw.Api.postWithToken('csrf', { action: 'edit', ... })`.
- Edit mode is detected via `mw.config.get('wgAction') === 'edit-topo'`.
- Undo URLs (`?undo=X&undoafter=Y`) are handled in `TopoEditAction.php`: the `undoafter` revision's YAML is loaded into the editor instead of the current content. A 3-way text merge is not attempted — the user saves the restored content as a new revision.

## YAML Topo Format

```yaml
version: '1.0'
title: 'Davis Creek Canyon'   # optional; rendered bold at top-left of SVG
grade: 'IV A3 III'            # optional; rendered below title
lastModified: '2026-02-19T10:30:00.000Z'  # optional; ISO 8601 timestamp, displayed as '2026-02-19 10:30 AM' at bottom-right
width: 800
height: 600
gridSize: 10
nextId: 42
features:
  - type: line
    id: 1
    x1: 100
    y1: 100
    x2: 200
    y2: 300
    slope: 90
    length: 200
    arrow: false
    shorten: false
    traverse: false
  - type: rappel
    id: 2
    x: 150
    y: 150
    length: 120          # float, not rounded — preserves exact grid-snap endpoint
    slope: 90            # float degrees
    curveOffset: -15
    curvePosition: 0.5
    description: "30m\nDBL"  # supports multiline with \n; drag the label independently
    textOffsetX: 0       # optional; pixels the label is offset from its natural position
    textOffsetY: 0       # optional
  - type: pool
    id: 3
    x: 200
    y: 250
    width: 80
    leftDepth: 30       # depth of left side of pool curve
    rightDepth: 40      # depth of right side (asymmetric pools supported)
  - type: anchor
    id: 4
    x: 150              # position of the X mark symbol
    y: 100
    size: 10            # size of each X mark
    connectionX: 140    # snap point (may differ from x/y — anchor symbol is offset)
    connectionY: 105
    anchorType: bolt
    count: 2
    name: 'Main anchor'
    nameOffsetX: 0      # optional; pixels the name text is offset from its natural position
    nameOffsetY: 0      # optional; drag the name text independently
  - type: note
    id: 5
    x: 300
    y: 200
    size: 20
    iconType: warning   # info | warning | water | hydraulic | rockfall | name | bridge
    text: 'Hydraulic hazard'
    textOffsetX: 0      # optional; drag the text independently
    textOffsetY: 0      # optional
  - type: access
    id: 6
    x: 400
    y: 500
    length: 60
    accessType: exit    # exit (black, arrow at far end) | entrance (green, arrow at near end)
    text: 'Exit here'   # optional label text
    textOffsetX: 0      # optional; drag the text independently
    textOffsetY: 0      # optional
```

## Legacy Migration

`loadFromYAML()` silently upgrades old data on load — the caller never sees the old types:

| Old type/field | Replacement | Notes |
|---|---|---|
| `type: hazard` | `type: note` | `iconType` defaults to `'warning'` |
| `type: exit` | `type: access` | `accessType` defaults to `'exit'` |
| `type: keeper` | `type: note` | `iconType` defaults to `'hydraulic'` |
| `iconType: swim` | `iconType: water` | Legacy name for water icon (blue wavy lines) |
| Any unrecognized field | *(deleted)* | Logged as a console warning |

Fields not in the schema for a given feature type are deleted on load. The authoritative list of valid types, valid fields per type, and subtype values is `TopoRenderer.FEATURE_SCHEMA` (defined at the bottom of `renderer.js`). Migrations are in `TopoRenderer.FEATURE_MIGRATIONS` (for feature type migrations) and inline in `loadFromYAML()` (for field-level migrations like note iconType). Adding a new migration requires editing either `renderer.js` (for type-level) or `editor-io.js` (for field-level).

## Design Notes

- `TopoRenderer` constructor does NOT call `this.init()` — each subclass calls it after setting its own state.
- Each `renderXxx()` method in the base class appends the SVG group to `featureLayer` and returns it so `TopoEditor` can attach interactive elements.
- `applyViewTransform()` calls `this.drawGrid()` — the viewer overrides `drawGrid()` to a no-op, so no conditional needed.
- `fitToContent()` is called automatically after `loadFromYAML()` in both editor and viewer.
- Grid and cursor are editor-only; the viewer has neither.
- Pool controls: pools support asymmetric curves via independent `leftDepth` and `rightDepth` values. A single orange curve-midpoint handle (like rappels) controls the shape: vertical position determines depth at the handle location, horizontal position (offset from center) determines asymmetry. When centered, the pool is symmetric; when dragged left or right, that side becomes deeper. Old pools with a single `depth` field are migrated on load to `leftDepth = rightDepth = depth`.
- Rappel `length` and `slope` are stored as floats (not rounded integers). Rounding them causes the rendered endpoint (`x2 = x + length*cos(slope)`) to drift from the snapped grid position.
- Rappel description text has an independent drag handle. `textOffsetX`/`textOffsetY` store the pixel offset from the natural position (`controlX + perpX*15`, `controlY + perpY*15 - 20`). Both fields default to 0 when absent. The viewer also respects them. Rappel descriptions support multiline text via `\n` characters; rendered using `<tspan>` elements with 16px line height.
- Anchor `connectionX`/`connectionY` is the snap/connection point (the green dot). It differs from `x`/`y` because the anchor symbol is rendered with a visual offset (up and to the right by default). Dragging the anchor symbol moves `x`/`y` only; dragging the connection point moves everything together. Anchor name text has an independent drag handle via `nameOffsetX`/`nameOffsetY` (similar to rappel descriptions and note text). The `anchorType` field determines the visual representation: `'bolt'` renders X marks (default), while `'natural'` renders "N" letters. Both types support multiple anchors via the `count` field.
- Note text has an independent drag handle via `textOffsetX`/`textOffsetY`. For `iconType: 'name'`, the text is centered and italic, with a box drawn around it after DOM insertion (required for `getBBox()`). For `iconType: 'info'`, no icon is drawn — the text is centered at `note.x, note.y` with a connection point visible for linking to other features (similar to anchors). All other icon types render the icon to the left and the text to the right. When adding a note, it is auto-selected so the properties panel is immediately ready for editing.
- Note icon types: the properties panel uses a visual icon picker (grid of buttons showing actual rendered icons) instead of a text dropdown, making it easy to see what each icon type looks like before selecting it. The picker uses `drawNoteIconElements()` to render live previews that exactly match the canvas appearance.
- Hydraulic icon: uses exact SVG path data copied from new.svg (two curved arrows forming a recirculation loop), scaled and positioned via transform attribute rather than recreating the geometry with arcs.
- Access features have optional draggable text labels via `text`, `textOffsetX`, `textOffsetY` fields. Text is positioned at the midpoint of the access line and can be moved independently. Text color matches the access type (green for entrance, black for exit).
- Line shorten marks: when `shorten: true`, two parallel diagonal slashes are rendered at the midpoint, rotated 105° (15° past vertical), each 15px long and separated by 6px. This indicates the section is compressed/not to scale.
- Important: all schema changes need to be recorded in TopoRenderer.FEATURE_SCHEMA - it is the source of truth
- `isDirty` flag: set to `true` by `saveState()`, reset to `false` after the initial load in `init()`, after `loadFromYAML()`, and after a successful `saveToWiki()`. A `beforeunload` listener in `editor.js` shows the browser's native "Leave site?" dialog when `isDirty` is true.
- Traverse lines render in `#666` (same grey as rappel lines) to visually distinguish them from regular terrain lines (`#000`).
- **Canyon metadata** (`title`, `grade`, `lastModified`): stored as top-level YAML fields; rendered by `renderMetadata()` into a dedicated `metadataLayer` (sits between `gridLayer` and `featureLayer`). Title at `x=10,y=20` (bold, 20px font); grade at `x=10,y=42` (16px font); lastModified timestamp at bottom-right (`x=width-10,y=height-10`, right-anchored, 10px font). Timestamp is stored as ISO 8601 string, auto-updated on every `saveState()`, and displayed in 12-hour format (e.g., "2026-02-19 10:30 AM"). Title/grade edited via text inputs in controls bar; updating either calls `renderMetadata()` directly (no full re-render). All metadata appears in SVG/PNG exports and viewer.
- **Box select / group move**: toolbar "Select" button (dashed-rect icon) toggles `selectMode`. In select mode, dragging empty canvas draws a selection box; features whose primary point falls inside are added to `selectedFeatures` (a `Set` of IDs). Dragging any selected feature moves all of them together (grid-snapped; undo-able). Shift+click toggles a single feature in/out of the selection. ESC clears selection; second ESC exits select mode. Selection highlights (blue dashed rects) are drawn in the cursor layer by `renderSelectionHighlights()`, which is called from `render()` so they survive full redraws. `applySnapshotWithOffset()` offsets both `x`/`y` and `connectionX`/`connectionY` (present on anchors) to keep the snap point aligned.
- **Toolbar modes**: The toolbar includes a "Cursor" button (pointer icon) that clears `pendingTool` and exits select mode, returning to default pointer behavior. Tool buttons highlight when active via `updateToolbarStates()`, which is called after tool selection and after completing drawing operations. This provides visual feedback about the current mode.
- **Drawing at connection points**: When `pendingTool`, `drawingLine`, `drawingRappel`, or `drawingPool` is active, all feature click handlers and `makeConnectionPointDraggable` return early without calling `e.stopPropagation()`, allowing clicks to bubble up to the canvas handler. This enables users to start/end lines and rappels at existing connection points without the feature selection or connection point dragging intercepting the click.