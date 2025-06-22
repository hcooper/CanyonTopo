# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Canyon Topo editor - a web-based tool for creating and editing topographic diagrams of canyoneering routes. The application allows users to create SVG-based canyon topos using YAML configuration files that describe features like rappels, pools, anchors, and terrain lines.

## Architecture

The codebase is organized as a client-side JavaScript application with modular ES6 structure:

- **Core Drawing Engine**: `lib/draw.js` - Main SVG rendering class that converts YAML feature data into SVG elements
- **Data Management**: `lib/io.js` - Handles YAML parsing, serialization, and config management  
- **MediaWiki Integration**: `lib/mediawiki.js` and `lib/wiki_api.js` - Interface with RopeWiki for loading/saving topos
- **User Interface**: `lib/buttons.js`, `lib/editor.js`, `lib/viewer.js` - Interactive editing components
- **Feature Interaction**: `lib/dragging.js`, `lib/highlight.js` - Handle user interactions with topo elements

## Key Files

- `index.html` - Main application entry point with UI layout
- `test.html` - Minimal test environment using `lib/bootstrap.js`
- `yaml/` - Sample YAML topo configurations (big.yaml, mineral.yaml)
- `deps/` - External dependencies (js-yaml, Sortable)

## Development Setup

This is a static web application with no build process. Development workflow:

1. Open `index.html` in a web browser for full application
2. Use `test.html` for minimal testing environment
3. Edit JavaScript modules directly in `lib/` directory
4. Test changes by refreshing the browser

## YAML Topo Format

Topo configurations use YAML with this structure:
```yaml
canyon_name: "Canyon Name"
canyon_location: "Location"  
canyon_grade: "v4a4 III"
width: 1024
height: 1024
features:
  - type: line|rap|pool|anchor|exit|break
    # type-specific properties
```

Feature types include: line (terrain), rap (rappel), pool, anchor (bolt/natural), exit, break (page break).

## Module Dependencies

The application uses ES6 modules with these key dependencies:
- `draw.js` exports the main `Draw` class
- `buttons.js` imports `refresh` from `editor.js`
- `io.js` handles YAML serialization and manages `window.topo.config`
- MediaWiki modules handle RopeWiki API integration

## Data Flow

1. YAML loaded via `io.js` into `window.topo.config`
2. `Draw` class processes config and generates SVG
3. Editor components allow interactive modification
4. Changes reflected in real-time via `refresh()` calls
5. Modified config can be saved back to YAML or MediaWiki