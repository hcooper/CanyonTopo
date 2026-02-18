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

- **`redux/lib/editor.js`** — `TopoEditor extends TopoRenderer`. Core class declaration + constructor, canvas/cursor, event listeners, drawing state machine (`startLine/finishLine/startRappel/finishRappel/startPool/finishPool/cancelDrawing`), cursor snap logic, `selectFeature`, `deleteFeature`, `render`, page bootstrap (`loadPage`, `DOMContentLoaded`).
- **`redux/lib/editor-features.js`** — Per-feature render/drag/update/add methods: `renderLine/Rappel/Pool/Anchor/Note/Access`, `updateLine/…`, `makeLineDraggable/…`, `addPool/Anchor/Rappel/Note/Access`. Also: connection point and midpoint factories (`createConnectionPoint`, `createMidpoint`, `createCurveMidpoint`) and their drag handlers (`makeConnectionPointDraggable`, `makeMidpointDraggable`, `makeCurveMidpointDraggable`, `makePoolCurveMidpointDraggable`, `makeRappelTextDraggable`).
- **`redux/lib/editor-ui.js`** — Toolbar, controls bar, right-click context menu, properties panel: `createToolbar`, `createControls`, `showContextMenu/hideContextMenu`, `updatePropertiesPanel`. Also declares a stub `renderFeatureList()` (overridden by `editor-feature-list.js`).
- **`redux/lib/editor-feature-list.js`** — Feature list sidebar: `getSortedFeatures`, `renderFeatureList`. Renders the route as a spine-flattened ASCII tree; branches (anchors, notes, mid-route access features) indent to the right.
- **`redux/lib/editor-io.js`** — Persistence and history: `saveState`, `undo/redo`, `restoreState`, `updateUndoRedoButtons`, `toYAML`, `loadFromYAML`, `exportSVG`, `exportPNG`, `exportData`, `importData`, `isEditMode`, `wikiPageName`, `saveToWiki`.

### Viewer (1 file)

- **`redux/lib/viewer.js`** — `TopoViewer extends TopoRenderer`. Read-only view. Overrides `drawGrid()` to a no-op. Has a file-load button and zoom controls only.

## Key Files

- `redux/index.html` — Editor entry point
- `redux/viewer.html` — Viewer entry point
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

## YAML Topo Format

```yaml
version: '1.0'
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
    description: '30m'
    textOffsetX: 0       # optional; pixels the label is offset from its natural position
    textOffsetY: 0       # optional; drag the label independently of the rappel line
  - type: pool
    id: 3
    x: 200
    y: 250
    width: 80
    depth: 30
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
  - type: note
    id: 5
    x: 300
    y: 200
    size: 20
    iconType: warning   # warning | swim | keeper | flood | cold | constriction | rockfall
    text: 'Keeper pothole'
    textOffsetX: 0      # optional
    textOffsetY: 0      # optional
  - type: access
    id: 6
    x: 400
    y: 500
    length: 60
    accessType: exit    # exit (black, arrow at far end) | entrance (green, arrow at near end)
```

## Legacy Migration

`loadFromYAML()` silently upgrades old data on load — the caller never sees the old types:

| Old type/field | Replacement | Notes |
|---|---|---|
| `type: hazard` | `type: note` | `iconType` defaults to `'warning'` |
| `type: exit` | `type: access` | `accessType` defaults to `'exit'` |
| Any unrecognized field | *(deleted)* | Logged as a console warning |

Fields not in the schema for a given feature type are deleted on load. The authoritative list of valid types, valid fields per type, and subtype values is `TopoRenderer.FEATURE_SCHEMA` (defined at the bottom of `renderer.js`). Migrations are in `TopoRenderer.FEATURE_MIGRATIONS`. `loadFromYAML()` in `editor-io.js` reads both statics — adding a new migration or field only requires editing `renderer.js`.

## Design Notes

- `TopoRenderer` constructor does NOT call `this.init()` — each subclass calls it after setting its own state.
- Each `renderXxx()` method in the base class appends the SVG group to `featureLayer` and returns it so `TopoEditor` can attach interactive elements.
- `applyViewTransform()` calls `this.drawGrid()` — the viewer overrides `drawGrid()` to a no-op, so no conditional needed.
- `fitToContent()` is called automatically after `loadFromYAML()` in both editor and viewer.
- Grid and cursor are editor-only; the viewer has neither.
- Pool depth control: the orange curve-midpoint handle sits at `(cx, cy + depth * 0.552 * 0.75)`. Dragging it vertically sets `depth = (mouseY - pool.y) / (0.552 * 0.75)`.
- Rappel `length` and `slope` are stored as floats (not rounded integers). Rounding them causes the rendered endpoint (`x2 = x + length*cos(slope)`) to drift from the snapped grid position.
- Rappel description text has an independent drag handle. `textOffsetX`/`textOffsetY` store the pixel offset from the natural position (`controlX + perpX*15`, `controlY + perpY*15 - 20`). Both fields default to 0 when absent. The viewer also respects them.
- Anchor `connectionX`/`connectionY` is the snap/connection point (the green dot). It differs from `x`/`y` because the X mark symbol is rendered with a visual offset. Dragging the X symbol moves `x`/`y` only; dragging the connection point moves everything together.
