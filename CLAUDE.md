# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Canyon Topo editor — a web-based tool for creating and editing topographic diagrams of canyoneering routes. The application renders SVG-based canyon topos from YAML data describing features like rappels, pools, anchors, and terrain lines. It is designed to be embedded in RopeWiki (a MediaWiki installation).

The old implementation lives in `old/` for reference. Active development is in `redux/`.

## Architecture (`redux/`)

Three plain JavaScript classes, no build step:

- **`redux/lib/renderer.js`** — `TopoRenderer` base class. Owns: SVG canvas creation, grid drawing, all feature render methods (visual only), zoom/pan state and methods, `screenToSVGCoords()`, `fitToContent()`, middle-mouse pan and mouse-wheel zoom event listeners.
- **`redux/lib/editor.js`** — `TopoEditor extends TopoRenderer`. Adds: interactive handles on features, right-click context menu, properties panel, feature list sidebar, undo/redo, snap-to-grid, YAML import/export, MediaWiki save via `mw.Api`.
- **`redux/lib/viewer.js`** — `TopoViewer extends TopoRenderer`. Read-only view. Overrides `drawGrid()` to a no-op. Has a file-load button and zoom controls only.

## Key Files

- `redux/index.html` — Editor entry point
- `redux/viewer.html` — Viewer entry point
- `redux/style.css` — Shared stylesheet
- `redux/deps/js-yaml.min.js` — YAML parsing (jsyaml)
- `old/` — Previous implementation (kept for reference)

## Script Load Order

Both pages load scripts in this order:
1. `deps/js-yaml.min.js`
2. `lib/renderer.js`
3. `lib/editor.js` or `lib/viewer.js`

## Embedding in MediaWiki

A wiki page embeds the editor or viewer by setting globals before loading the scripts:

```html
<script>
  var rw_domain = 'https://ropewiki.com'; // used as mw.Api base (optional, mw.Api handles it)
  var rw_page   = 'Canyon_Page_Name';     // wiki page to save to (read via mw.config.get('wgPageName'))
  var raw_yaml  = '...';                  // YAML string to preload on init
</script>
```

- The Save to Wiki button is always visible in the editor.
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
    length: 120
    slope: 90
    curveOffset: -15
    curvePosition: 0.5
    description: '30m'
  - type: pool
    id: 3
    x: 200
    y: 250
    width: 80
    depth: 30
  - type: anchor
    id: 4
    x: 150
    y: 100
    anchorType: bolt
    count: 2
    name: 'Main anchor'
  - type: hazard
    id: 5
    x: 300
    y: 200
    size: 20
    text: '!'
  - type: exit
    id: 6
    x: 400
    y: 500
    length: 60
```

## Design Notes

- `TopoRenderer` constructor does NOT call `this.init()` — each subclass calls it after setting its own state.
- Each `renderXxx()` method appends the SVG group to `featureLayer` and returns it so `TopoEditor` can attach interactive elements.
- `applyViewTransform()` calls `this.drawGrid()` — the viewer overrides `drawGrid()` to a no-op, so no conditional needed.
- `fitToContent()` is called automatically after `loadFromYAML()` in both editor and viewer.
- Grid and cursor are editor-only; the viewer has neither.
