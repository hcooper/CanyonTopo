# Canyon Topo Editor - Manageability Analysis

**Date:** 2026-02-19
**Codebase Size:** ~6,600 lines of JavaScript
**Status:** Stable, actively developed (15 commits in past 2 months)

## Executive Summary

The topo editor is well-architected with clean separation of concerns and zero build complexity. However, **code duplication** and **lack of testing** are the primary threats to long-term manageability. The recommended action plan focuses on extracting common patterns and adding minimal testing before considering structural changes.

---

## Current State

### Metrics
- **Total LOC:** ~6,600 (excluding dependencies)
- **Feature types:** 6 (line, rappel, pool, anchor, note, access)
- **Note icon types:** 7 (info, warning, swim, hydraulic, rockfall, bridge, name)
- **External dependencies:** 1 (js-yaml)
- **Build step:** None (plain JavaScript)
- **Test coverage:** 0%

### Architecture

```
TopoRenderer (1,080 LOC) - Base rendering
├── TopoEditor (5 extension files, 5,195 LOC)
│   ├── editor.js (1,049) - Core, events, selection
│   ├── editor-features.js (2,042) ⚠️ LARGEST FILE
│   ├── editor-ui.js (850) - Toolbar, properties panel
│   ├── editor-io.js (454) - Save, export, undo/redo
│   └── editor-feature-list.js (304) - Sidebar
└── TopoViewer (263 LOC) - Read-only mode
```

### File Load Order
1. `deps/js-yaml.min.js`
2. `lib/renderer.js`
3. `lib/editor.js`
4. `lib/editor-features.js`
5. `lib/editor-ui.js`
6. `lib/editor-feature-list.js`
7. `lib/editor-io.js`

---

## Strengths

1. **Zero build complexity**
   - No webpack, no npm scripts, no CI/CD brittleness
   - Instant refresh during development
   - Easy to understand what code is actually running

2. **Clean data model**
   - YAML-based with schema validation (`TopoRenderer.FEATURE_SCHEMA`)
   - Migration system handles schema evolution (`TopoRenderer.FEATURE_MIGRATIONS`)
   - Single source of truth for valid fields per feature type

3. **Separation of concerns**
   - Renderer base class cleanly separated from editor
   - Viewer inherits from renderer, overrides only what's needed
   - Prototype extension pattern allows logical file splitting without build

4. **Good documentation**
   - CLAUDE.md is comprehensive and maintained
   - Inline comments explain non-obvious logic
   - TODO.md tracks active work items

5. **Backward compatibility**
   - Migration system silently upgrades old data on load
   - Caller never sees old types (hazard → note, exit → access, keeper → note)

---

## Critical Manageability Issues

### 1. Code Duplication Crisis (HIGH PRIORITY)

**Problem:** Every feature type repeats the same drag handler pattern.

**Evidence:**
- `makeLineDraggable()` (lines 1815-1873)
- `makeRappelDraggable()` (lines 958-1002)
- `makePoolDraggable()` (lines 715-760)
- `makeAnchorDraggable()` (lines 520-566)
- `makeNoteDraggable()` (lines 1220-1262)
- `makeAccessDraggable()` (lines 200-241)
- `makeMetadataDraggable()` (lines 350-387)

Each contains ~40-60 lines with identical structure:
```javascript
let isDragging = false;
let startX, startY;

element.addEventListener('mousedown', (e) => {
  // 10-15 lines of setup (button check, exclusions, cursor)
});

this.svg.addEventListener('mousemove', (e) => {
  // 15-20 lines of coordinate transform + grid snap
});

document.addEventListener('mouseup', () => {
  // 5-8 lines of cleanup + saveState
});
```

**Text dragging pattern duplicated 4 times:**
- `makeRappelTextDraggable()` (lines 925-956)
- `makeNoteTextDraggable()` (lines 1187-1218)
- `makeAnchorNameDraggable()` (lines 487-518)
- `makeAccessTextDraggable()` (lines 167-198)

**Impact:**
- Adding a new feature type requires 300-400 lines of boilerplate
- Bug fixes must be applied to 6+ locations
- Behavior changes require coordinated updates across files

**Estimated duplication:** ~500 lines (7.5% of codebase)

---

### 2. editor-features.js is Too Large (MEDIUM PRIORITY)

**Problem:** Single file contains all feature-specific logic.

**Current size:** 2,042 lines (31% of codebase)

**Contains:**
- 6 × `addX()` methods (feature creation)
- 6 × `renderX()` overrides (add interactivity to base rendering)
- 6 × `updateX()` methods (sync data → SVG)
- 6 × `makeXDraggable()` methods
- 4 × `makeXTextDraggable()` methods
- Connection point factories (`createConnectionPoint`, `createMidpoint`, `createCurveMidpoint`)
- Curve/midpoint drag handlers

**Cognitive load:**
- Finding pool-specific logic requires scrolling past line/rappel/anchor code
- Merge conflicts likely if multiple features edited simultaneously
- No clear file to open when working on a specific feature

---

### 3. No Test Coverage (HIGH PRIORITY)

**Problem:** Zero automated tests means regressions go undetected.

**Evidence:**
```bash
$ find . -name "*test*" -o -name "*spec*"
# (no results)
```

**Critical untested paths:**
1. **Schema validation** - No tests for `FEATURE_SCHEMA` enforcement
2. **Migrations** - No tests for hazard→note, exit→access conversions
3. **Connection point snapping** - Complex logic (lines 1661-1813) with 4 feature types
4. **Undo/redo** - State snapshot/restore logic
5. **YAML serialization** - Round-trip data integrity

**Impact:**
- Regressions discovered only via manual testing
- Refactoring is risky (no safety net)
- New features may break old features silently
- Contributors hesitant to change core code

**Example risk:** The connection point drag handler (lines 1661-1813) handles:
- Lines (both endpoints)
- Pools (width adjustment)
- Anchors (move entire anchor + connection point together)
- Rappels (recalculate length/slope)

One bug could break all 4 behaviors, with no tests to catch it.

---

### 4. No Type Safety (MEDIUM PRIORITY)

**Problem:** Plain JavaScript with no JSDoc, TypeScript, or runtime validation.

**Evidence:**
```javascript
// What fields does 'feature' have? Unknown without reading docs
updateNote(feature) {
  const cx = feature.x;  // Could be undefined, typo'd, wrong type
  const cy = feature.y;
  const size = feature.size;
  this.drawNoteIconElements(element, cx, cy, size, feature.iconType);
}
```

**Impact:**
- Refactoring requires manual hunting for all property accesses
- Typos caught only at runtime (e.g., `feature.iconTypo`)
- No IDE autocomplete for feature properties
- New contributors must memorize schema from CLAUDE.md

**Example maintenance burden:**
- Renaming `curveOffset` → `curveBend` requires searching entire codebase
- No compile-time guarantee that all `updateRappel()` calls updated
- Easy to forget updating FEATURE_SCHEMA when adding fields

---

### 5. Tight SVG/DOM Coupling (LOW PRIORITY)

**Problem:** Every `updateX()` method directly manipulates SVG elements.

**Evidence:**
```javascript
updatePool(pool) {
  const element = this.featureLayer.querySelector(`[data-id="${pool.id}"]`);
  const path = element.querySelector('.pool-shape');
  path.setAttribute('d', pathData);
  // ... 30 more lines of setAttribute calls
}
```

**Impact:**
- Changing rendering strategy requires touching dozens of methods
- Hard to test (requires full DOM environment)
- Virtual DOM or canvas rendering would require complete rewrite

**Note:** This is acceptable given the project scope. Only mention if considering major architecture changes.

---

## Recommendations (Prioritized by ROI)

### Phase 1: Reduce Duplication (HIGH ROI, LOW RISK)

**Estimated time:** 3-4 days
**Impact:** Eliminates ~500 lines of duplication (7.5% of codebase)

#### 1.1 Extract Common Drag Handler Factory

**Create:** `lib/editor-drag-behaviors.js`

```javascript
// editor-drag-behaviors.js
const DragBehaviors = {
  /**
   * Make an element draggable with grid snapping and undo/redo support
   * @param {SVGElement} element - Element to make draggable
   * @param {Object} feature - Feature data object
   * @param {Object} options - Configuration
   * @param {string} options.featureType - Capitalized feature type (e.g., 'Note', 'Rappel')
   * @param {string} [options.xProp='x'] - Property name for X coordinate
   * @param {string} [options.yProp='y'] - Property name for Y coordinate
   * @param {string[]} [options.excludeClasses] - CSS classes to exclude from drag start
   * @param {Function} [options.onMove] - Called during drag (before update)
   */
  makeDraggable(element, feature, options) {
    let isDragging = false;
    let startX, startY;

    const xProp = options.xProp || 'x';
    const yProp = options.yProp || 'y';

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click

      // Check if clicking excluded element (connection point, text, etc.)
      if (options.excludeClasses) {
        for (const cls of options.excludeClasses) {
          if (e.target.classList.contains(cls)) return;
        }
      }

      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x - feature[xProp];
      startY = coords.y - feature[yProp];
      element.style.cursor = 'grabbing';
      e.stopPropagation();
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const coords = this.screenToSVGCoords(e);
      let newX = coords.x - startX;
      let newY = coords.y - startY;

      // Snap to grid if enabled
      if (this.snapToGrid) {
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newY = Math.round(newY / this.gridSize) * this.gridSize;
      }

      feature[xProp] = newX;
      feature[yProp] = newY;

      // Call custom move handler if provided
      if (options.onMove) {
        options.onMove.call(this, feature);
      }

      // Update visual representation
      this[`update${options.featureType}`](feature);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
        this.saveState();
      }
    });
  }
};
```

**Usage in editor-features.js:**

```javascript
// Before (60 lines):
makeNoteDraggable(element, note) {
  let isDragging = false;
  let startX, startY;

  element.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.classList.contains('note-text')) return;
    isDragging = true;
    const coords = this.screenToSVGCoords(e);
    startX = coords.x - note.x;
    startY = coords.y - note.y;
    element.style.cursor = 'grabbing';
    e.stopPropagation();
  });

  this.svg.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const coords = this.screenToSVGCoords(e);
    let newX = coords.x - startX;
    let newY = coords.y - startY;

    if (this.snapToGrid) {
      newX = Math.round(newX / this.gridSize) * this.gridSize;
      newY = Math.round(newY / this.gridSize) * this.gridSize;
    }

    note.x = newX;
    note.y = newY;
    this.updateNote(note);
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      element.style.cursor = 'move';
      this.saveState();
    }
  });
}

// After (5 lines):
makeNoteDraggable(element, note) {
  DragBehaviors.makeDraggable.call(this, element, note, {
    featureType: 'Note',
    excludeClasses: ['note-text']
  });
}
```

**Update index.html:**

```html
<script src="lib/renderer.js"></script>
<script src="lib/editor.js"></script>
<script src="lib/editor-drag-behaviors.js"></script>  <!-- NEW -->
<script src="lib/editor-features.js"></script>
<!-- ... rest unchanged -->
```

**Files to update:**
- Create `lib/editor-drag-behaviors.js`
- Update `editor-features.js` (replace 7 drag handlers)
- Update `index.html` (add script tag)

**Lines saved:** ~400 lines (7 handlers × ~55 lines each → 7 × ~5 lines)

---

#### 1.2 Extract Text Offset Pattern

**Create:** `lib/editor-text-offsets.js`

```javascript
// editor-text-offsets.js
const TextOffsets = {
  /**
   * Make text element independently draggable with offset tracking
   * @param {SVGTextElement} textEl - Text element to make draggable
   * @param {Object} feature - Feature data object
   * @param {Object} options - Configuration
   * @param {string} options.offsetXProp - Property name for X offset (e.g., 'textOffsetX')
   * @param {string} options.offsetYProp - Property name for Y offset (e.g., 'textOffsetY')
   * @param {string} options.updateMethod - Method name to call on update (e.g., 'updateRappel')
   */
  makeTextDraggable(textEl, feature, options) {
    let isDragging = false;
    let startX, startY, startOffsetX, startOffsetY;

    textEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      e.stopPropagation();
      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x;
      startY = coords.y;
      startOffsetX = feature[options.offsetXProp] || 0;
      startOffsetY = feature[options.offsetYProp] || 0;
      textEl.style.cursor = 'grabbing';
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const coords = this.screenToSVGCoords(e);
      feature[options.offsetXProp] = startOffsetX + (coords.x - startX);
      feature[options.offsetYProp] = startOffsetY + (coords.y - startY);
      this[options.updateMethod](feature);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        textEl.style.cursor = 'move';
        this.saveState();
      }
    });
  }
};
```

**Usage in editor-features.js:**

```javascript
// Before (32 lines):
makeRappelTextDraggable(textEl, rappel) {
  let isDragging = false;
  let startX, startY, startOffsetX, startOffsetY;

  textEl.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    isDragging = true;
    const coords = this.screenToSVGCoords(e);
    startX = coords.x;
    startY = coords.y;
    startOffsetX = rappel.textOffsetX || 0;
    startOffsetY = rappel.textOffsetY || 0;
    textEl.style.cursor = 'grabbing';
  });

  this.svg.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const coords = this.screenToSVGCoords(e);
    rappel.textOffsetX = startOffsetX + (coords.x - startX);
    rappel.textOffsetY = startOffsetY + (coords.y - startY);
    this.updateRappel(rappel);
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      textEl.style.cursor = 'move';
      this.saveState();
    }
  });
}

// After (6 lines):
makeRappelTextDraggable(textEl, rappel) {
  TextOffsets.makeTextDraggable.call(this, textEl, rappel, {
    offsetXProp: 'textOffsetX',
    offsetYProp: 'textOffsetY',
    updateMethod: 'updateRappel'
  });
}
```

**Update index.html:**

```html
<script src="lib/editor.js"></script>
<script src="lib/editor-drag-behaviors.js"></script>
<script src="lib/editor-text-offsets.js"></script>  <!-- NEW -->
<script src="lib/editor-features.js"></script>
```

**Lines saved:** ~120 lines (4 handlers × ~30 lines each → 4 × ~6 lines)

---

### Phase 2: Add Minimal Testing (MEDIUM ROI, MEDIUM RISK)

**Estimated time:** 4-5 days
**Impact:** Catches regressions, enables confident refactoring

#### 2.1 Add Schema Validation Tests

**Create:** `tests/test-schema.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Schema Tests</title>
  <style>
    body { font-family: monospace; padding: 20px; }
    .pass { color: green; }
    .fail { color: red; }
    .summary { margin-top: 20px; font-weight: bold; }
  </style>
</head>
<body>
  <h1>Schema Validation Tests</h1>
  <div id="results"></div>
  <div id="summary" class="summary"></div>

  <script src="../deps/js-yaml.min.js"></script>
  <script src="../lib/renderer.js"></script>
  <script src="test-schema.js"></script>
</body>
</html>
```

**Create:** `tests/test-schema.js`

```javascript
// Simple test framework (no dependencies)
const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function test(name, fn) {
  try {
    fn();
    results.push({ name, status: 'pass' });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.push({ name, status: 'fail', error: error.message });
    console.error(`✗ ${name}: ${error.message}`);
  }
}

// Helper to validate feature against schema
function validateFeature(feature) {
  const schema = TopoRenderer.FEATURE_SCHEMA[feature.type];
  if (!schema) {
    return [`Unknown feature type: ${feature.type}`];
  }

  const errors = [];
  const validFields = schema.fields;

  for (const key in feature) {
    if (!validFields.has(key)) {
      errors.push(`Invalid field '${key}' for type '${feature.type}'`);
    }
  }

  return errors;
}

// Helper to apply migrations
function applyMigrations(features) {
  return features.map(feature => {
    const migration = TopoRenderer.FEATURE_MIGRATIONS.find(m => m.from === feature.type);
    if (migration) {
      const migrated = { ...feature, type: migration.to };
      if (migration.defaults) {
        Object.assign(migrated, migration.defaults);
      }
      return migrated;
    }
    return feature;
  });
}

// --- TESTS BEGIN ---

test('validates line has all required fields', () => {
  const errors = validateFeature({
    type: 'line',
    id: 1,
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 100,
    slope: 45,
    length: 141,
    arrow: false,
    shorten: false,
    traverse: false
  });
  assert(errors.length === 0, `Should have no errors, got: ${errors.join(', ')}`);
});

test('detects invalid field for line', () => {
  const errors = validateFeature({
    type: 'line',
    id: 1,
    x1: 0,
    y1: 0,
    x2: 100,
    y2: 100,
    slope: 45,
    length: 141,
    arrow: false,
    shorten: false,
    traverse: false,
    invalidField: 'bad'  // ← Should be detected
  });
  assert(errors.length === 1, `Should have 1 error, got ${errors.length}`);
  assert(errors[0].includes('invalidField'), 'Error should mention invalidField');
});

test('migrates legacy exit to access', () => {
  const legacy = [{ type: 'exit', id: 1, x: 10, y: 20, length: 30 }];
  const migrated = applyMigrations(legacy);

  assert(migrated[0].type === 'access', `Type should be 'access', got '${migrated[0].type}'`);
  assert(migrated[0].accessType === 'exit', `accessType should be 'exit', got '${migrated[0].accessType}'`);
  assert(migrated[0].x === 10, 'X coordinate should be preserved');
});

test('migrates legacy hazard to note with warning icon', () => {
  const legacy = [{ type: 'hazard', id: 1, x: 50, y: 50, size: 20, text: 'Danger' }];
  const migrated = applyMigrations(legacy);

  assert(migrated[0].type === 'note', `Type should be 'note', got '${migrated[0].type}'`);
  assert(migrated[0].iconType === 'warning', `iconType should be 'warning', got '${migrated[0].iconType}'`);
});

test('migrates legacy keeper to note with hydraulic icon', () => {
  const legacy = [{ type: 'keeper', id: 1, x: 50, y: 50, size: 20, text: 'Keeper' }];
  const migrated = applyMigrations(legacy);

  assert(migrated[0].type === 'note', `Type should be 'note', got '${migrated[0].type}'`);
  assert(migrated[0].iconType === 'hydraulic', `iconType should be 'hydraulic', got '${migrated[0].iconType}'`);
});

test('validates rappel has required fields', () => {
  const errors = validateFeature({
    type: 'rappel',
    id: 2,
    x: 100,
    y: 100,
    length: 120,
    slope: 90,
    curveOffset: -15,
    curvePosition: 0.5,
    description: '30m'
  });
  assert(errors.length === 0, `Should have no errors, got: ${errors.join(', ')}`);
});

test('validates pool has required fields', () => {
  const errors = validateFeature({
    type: 'pool',
    id: 3,
    x: 200,
    y: 250,
    width: 80,
    leftDepth: 30,
    rightDepth: 40
  });
  assert(errors.length === 0, `Should have no errors, got: ${errors.join(', ')}`);
});

test('validates anchor has required fields', () => {
  const errors = validateFeature({
    type: 'anchor',
    id: 4,
    x: 150,
    y: 100,
    size: 10,
    connectionX: 140,
    connectionY: 105,
    anchorType: 'bolt',
    count: 2,
    name: 'Main anchor'
  });
  assert(errors.length === 0, `Should have no errors, got: ${errors.join(', ')}`);
});

test('validates note has required fields', () => {
  const errors = validateFeature({
    type: 'note',
    id: 5,
    x: 300,
    y: 200,
    size: 20,
    iconType: 'warning',
    text: 'Hazard'
  });
  assert(errors.length === 0, `Should have no errors, got: ${errors.join(', ')}`);
});

test('validates access has required fields', () => {
  const errors = validateFeature({
    type: 'access',
    id: 6,
    x: 400,
    y: 500,
    length: 60,
    accessType: 'exit'
  });
  assert(errors.length === 0, `Should have no errors, got: ${errors.join(', ')}`);
});

test('rejects unknown feature type', () => {
  const errors = validateFeature({
    type: 'unknown',
    id: 99
  });
  assert(errors.length > 0, 'Should have errors for unknown type');
  assert(errors[0].includes('Unknown feature type'), 'Error should mention unknown type');
});

test('accepts optional fields', () => {
  const errors = validateFeature({
    type: 'rappel',
    id: 2,
    x: 100,
    y: 100,
    length: 120,
    slope: 90,
    curveOffset: -15,
    curvePosition: 0.5,
    description: '30m',
    textOffsetX: 10,  // Optional
    textOffsetY: 5    // Optional
  });
  assert(errors.length === 0, `Should accept optional fields, got: ${errors.join(', ')}`);
});

// --- TESTS END ---

// Display results
const resultsDiv = document.getElementById('results');
const summaryDiv = document.getElementById('summary');

results.forEach(result => {
  const div = document.createElement('div');
  div.className = result.status;
  div.textContent = result.status === 'pass'
    ? `✓ ${result.name}`
    : `✗ ${result.name}: ${result.error}`;
  resultsDiv.appendChild(div);
});

const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;
summaryDiv.textContent = `${passed} passed, ${failed} failed (${results.length} total)`;
summaryDiv.className = failed === 0 ? 'pass summary' : 'fail summary';
```

**To run:** Open `tests/test-schema.html` in browser

**Maintenance:** Add a test whenever you:
- Add a new feature type
- Add a migration
- Change FEATURE_SCHEMA

---

#### 2.2 Add Critical Path Integration Tests

**Create:** `tests/test-integration.html`

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Integration Tests</title>
  <style>
    body { font-family: monospace; padding: 20px; }
    .pass { color: green; }
    .fail { color: red; }
    .summary { margin-top: 20px; font-weight: bold; }
    #test-container { display: none; }
  </style>
</head>
<body>
  <h1>Integration Tests</h1>
  <div id="results"></div>
  <div id="summary" class="summary"></div>
  <div id="test-container"></div>

  <script src="../deps/js-yaml.min.js"></script>
  <script src="../lib/renderer.js"></script>
  <script src="../lib/editor.js"></script>
  <script src="../lib/editor-drag-behaviors.js"></script>
  <script src="../lib/editor-text-offsets.js"></script>
  <script src="../lib/editor-features.js"></script>
  <script src="../lib/editor-ui.js"></script>
  <script src="../lib/editor-feature-list.js"></script>
  <script src="../lib/editor-io.js"></script>
  <script src="test-integration.js"></script>
</body>
</html>
```

**Create:** `tests/test-integration.js`

```javascript
// Simple test framework (same as test-schema.js)
const results = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function test(name, fn) {
  try {
    // Clean up before each test
    const container = document.getElementById('test-container');
    container.innerHTML = '';

    fn();
    results.push({ name, status: 'pass' });
    console.log(`✓ ${name}`);
  } catch (error) {
    results.push({ name, status: 'fail', error: error.message });
    console.error(`✗ ${name}: ${error.message}`);
  }
}

// --- TESTS BEGIN ---

test('addRappel creates feature with correct defaults', () => {
  const editor = new TopoEditor('test-container');
  editor.init();

  editor.addRappel(100, 100);

  assert(editor.features.length === 1, `Should have 1 feature, got ${editor.features.length}`);

  const rappel = editor.features[0];
  assert(rappel.type === 'rappel', `Type should be 'rappel', got '${rappel.type}'`);
  assert(rappel.x === 100, `X should be 100, got ${rappel.x}`);
  assert(rappel.y === 100, `Y should be 100, got ${rappel.y}`);
  assert(rappel.length === 100, `Length should be 100, got ${rappel.length}`);
  assert(rappel.slope === 90, `Slope should be 90, got ${rappel.slope}`);
  assert(rappel.curveOffset === -15, `curveOffset should be -15, got ${rappel.curveOffset}`);
  assert(rappel.curvePosition === 0.5, `curvePosition should be 0.5, got ${rappel.curvePosition}`);
});

test('addRappel renders SVG elements', () => {
  const editor = new TopoEditor('test-container');
  editor.init();

  editor.addRappel(100, 100);
  const rappel = editor.features[0];

  const svg = document.querySelector('#test-container svg');
  assert(svg, 'SVG element should exist');

  const group = svg.querySelector(`[data-id="${rappel.id}"]`);
  assert(group, 'Feature group should exist');

  const curve = group.querySelector('.rappel-curve');
  assert(curve, 'Rappel curve should be rendered');

  const arrowhead = group.querySelector('.rappel-arrowhead');
  assert(arrowhead, 'Arrowhead should be rendered');

  const connectionPoints = group.querySelectorAll('.connection-point');
  assert(connectionPoints.length === 2, `Should have 2 connection points, got ${connectionPoints.length}`);

  const curveMidpoint = group.querySelector('.curve-midpoint');
  assert(curveMidpoint, 'Curve midpoint should be rendered');
});

test('addNote auto-selects the note', () => {
  const editor = new TopoEditor('test-container');
  editor.init();

  editor.addNote(50, 50);
  const note = editor.features[0];

  assert(editor.selectedFeature === note.id, `Note should be selected, selectedFeature is ${editor.selectedFeature}`);
});

test('addPool creates symmetric pool by default', () => {
  const editor = new TopoEditor('test-container');
  editor.init();

  editor.addPool(200, 200);
  const pool = editor.features[0];

  assert(pool.type === 'pool', `Type should be 'pool', got '${pool.type}'`);
  assert(pool.leftDepth === pool.rightDepth, `Pool should be symmetric, leftDepth=${pool.leftDepth}, rightDepth=${pool.rightDepth}`);
});

test('addAnchor creates bolt anchor with count=2 by default', () => {
  const editor = new TopoEditor('test-container');
  editor.init();

  editor.addAnchor(150, 150);
  const anchor = editor.features[0];

  assert(anchor.type === 'anchor', `Type should be 'anchor', got '${anchor.type}'`);
  assert(anchor.anchorType === 'bolt', `anchorType should be 'bolt', got '${anchor.anchorType}'`);
  assert(anchor.count === 2, `count should be 2, got ${anchor.count}`);
  assert(anchor.connectionX !== undefined, 'connectionX should be set');
  assert(anchor.connectionY !== undefined, 'connectionY should be set');
});

test('undo/redo works for feature addition', () => {
  const editor = new TopoEditor('test-container');
  editor.init();

  assert(editor.features.length === 0, 'Should start with 0 features');

  editor.addRappel(100, 100);
  assert(editor.features.length === 1, 'Should have 1 feature after add');

  editor.undo();
  assert(editor.features.length === 0, 'Should have 0 features after undo');

  editor.redo();
  assert(editor.features.length === 1, 'Should have 1 feature after redo');
});

test('toYAML round-trips data correctly', () => {
  const editor = new TopoEditor('test-container');
  editor.init();

  editor.addRappel(100, 100);
  editor.addNote(50, 50);

  const yaml = editor.toYAML();
  assert(yaml.length > 0, 'YAML should not be empty');

  // Create new editor and load the YAML
  const editor2 = new TopoEditor('test-container');
  editor2.init();
  editor2.loadFromYAML(yaml);

  assert(editor2.features.length === 2, `Should have 2 features, got ${editor2.features.length}`);
  assert(editor2.features[0].type === 'rappel', 'First feature should be rappel');
  assert(editor2.features[1].type === 'note', 'Second feature should be note');
});

test('selectFeature highlights in feature list', () => {
  const editor = new TopoEditor('test-container');
  editor.init();

  editor.addRappel(100, 100);
  editor.addNote(50, 50);

  const rappel = editor.features[0];
  const note = editor.features[1];

  editor.selectFeature(rappel.id);
  assert(editor.selectedFeature === rappel.id, 'Rappel should be selected');

  editor.selectFeature(note.id);
  assert(editor.selectedFeature === note.id, 'Note should be selected');
});

test('deleteFeature removes from array and SVG', () => {
  const editor = new TopoEditor('test-container');
  editor.init();

  editor.addRappel(100, 100);
  const rappel = editor.features[0];
  const rappelId = rappel.id;

  assert(editor.features.length === 1, 'Should have 1 feature');

  const svg = document.querySelector('#test-container svg');
  const groupBefore = svg.querySelector(`[data-id="${rappelId}"]`);
  assert(groupBefore, 'SVG group should exist before delete');

  editor.deleteFeature(rappelId);

  assert(editor.features.length === 0, 'Should have 0 features after delete');

  const groupAfter = svg.querySelector(`[data-id="${rappelId}"]`);
  assert(!groupAfter, 'SVG group should not exist after delete');
});

// --- TESTS END ---

// Display results (same as test-schema.js)
const resultsDiv = document.getElementById('results');
const summaryDiv = document.getElementById('summary');

results.forEach(result => {
  const div = document.createElement('div');
  div.className = result.status;
  div.textContent = result.status === 'pass'
    ? `✓ ${result.name}`
    : `✗ ${result.name}: ${result.error}`;
  resultsDiv.appendChild(div);
});

const passed = results.filter(r => r.status === 'pass').length;
const failed = results.filter(r => r.status === 'fail').length;
summaryDiv.textContent = `${passed} passed, ${failed} failed (${results.length} total)`;
summaryDiv.className = failed === 0 ? 'pass summary' : 'fail summary';
```

**To run:** Open `tests/test-integration.html` in browser

**Maintenance:** Add a test whenever you:
- Add a new feature type
- Change core interaction behavior
- Fix a regression bug

---

### Phase 3: Improve Structure (LOWER ROI, HIGHER RISK)

**Estimated time:** 3-5 days
**Impact:** Easier navigation, clearer organization

#### 3.1 Split editor-features.js by Feature Type

**New structure:**

```
lib/
├── renderer.js
├── editor.js
├── editor-ui.js
├── editor-io.js
├── editor-feature-list.js
├── editor-drag-behaviors.js   ← From Phase 1
├── editor-text-offsets.js      ← From Phase 1
└── features/                   ← NEW directory
    ├── line.js       (~350 lines)
    ├── rappel.js     (~400 lines)
    ├── pool.js       (~300 lines)
    ├── anchor.js     (~350 lines)
    ├── note.js       (~300 lines)
    └── access.js     (~200 lines)
```

**Each feature file contains:**

```javascript
// features/rappel.js
Object.assign(TopoEditor.prototype, {

  addRappel(x, y) {
    const rappel = {
      id: this.nextId++,
      type: 'rappel',
      x: x,
      y: y,
      length: 100,
      slope: 90,
      curveOffset: -15,
      curvePosition: 0.5,
      description: ''
    };

    this.features.push(rappel);
    this.renderRappel(rappel);
    this.saveState();
    console.log('Added rappel:', rappel);
  },

  renderRappel(rappel) {
    const group = TopoRenderer.prototype.renderRappel.call(this, rappel);
    group.style.cursor = 'move';

    // ... (all rappel-specific rendering logic)

    this.makeRappelDraggable(group, rappel);
  },

  updateRappel(rappel) {
    // ... (all rappel update logic)
  },

  makeRappelDraggable(element, rappel) {
    DragBehaviors.makeDraggable.call(this, element, rappel, {
      featureType: 'Rappel',
      excludeClasses: ['connection-point', 'rappel-description']
    });
  },

  makeRappelTextDraggable(textEl, rappel) {
    TextOffsets.makeTextDraggable.call(this, textEl, rappel, {
      offsetXProp: 'textOffsetX',
      offsetYProp: 'textOffsetY',
      updateMethod: 'updateRappel'
    });
  },

  makeCurveMidpointDraggable(circle, featureId) {
    // ... (curve control logic - only in rappel.js)
  }

});
```

**Update index.html:**

```html
<script src="lib/renderer.js"></script>
<script src="lib/editor.js"></script>
<script src="lib/editor-drag-behaviors.js"></script>
<script src="lib/editor-text-offsets.js"></script>

<!-- Load all feature modules -->
<script src="lib/features/line.js"></script>
<script src="lib/features/rappel.js"></script>
<script src="lib/features/pool.js"></script>
<script src="lib/features/anchor.js"></script>
<script src="lib/features/note.js"></script>
<script src="lib/features/access.js"></script>

<script src="lib/editor-ui.js"></script>
<script src="lib/editor-feature-list.js"></script>
<script src="lib/editor-io.js"></script>
```

**Benefits:**
- Clear file to open when working on a specific feature
- Easier to review feature-specific changes in PRs
- Simpler mental model (one feature per file)

**Risks:**
- Script load order becomes more fragile (6 new files)
- Need to update 2 HTML files (index.html and tests)
- Potential for missed cross-feature dependencies

**Migration strategy:**
1. Create `lib/features/` directory
2. Copy each feature's methods from editor-features.js to its own file
3. Test that all features still work
4. Delete old editor-features.js
5. Update script tags in index.html, viewer.html, test files

---

#### 3.2 Add JSDoc Type Annotations

**Goal:** IDE autocomplete and type checking without TypeScript

**Example:** `features/rappel.js`

```javascript
/**
 * @typedef {Object} RappelFeature
 * @property {'rappel'} type - Feature type identifier
 * @property {number} id - Unique feature ID
 * @property {number} x - Start point X coordinate
 * @property {number} y - Start point Y coordinate
 * @property {number} length - Length in SVG units (float for precision)
 * @property {number} slope - Angle in degrees (float for precision)
 * @property {number} curveOffset - Perpendicular offset for curve control
 * @property {number} curvePosition - Position along line where curve control is (0-1)
 * @property {string} [description] - Optional multiline text label (use \n for newlines)
 * @property {number} [textOffsetX] - Optional X offset for description text
 * @property {number} [textOffsetY] - Optional Y offset for description text
 */

Object.assign(TopoEditor.prototype, {

  /**
   * Add a new rappel feature at the specified coordinates
   * @param {number} x - Start point X
   * @param {number} y - Start point Y
   * @returns {void}
   */
  addRappel(x, y) {
    // ...
  },

  /**
   * Render a rappel feature with interactive elements
   * @param {RappelFeature} rappel - Rappel feature to render
   * @returns {void}
   */
  renderRappel(rappel) {
    // ...
  },

  /**
   * Update the SVG representation of a rappel feature
   * @param {RappelFeature} rappel - Rappel feature to update
   * @returns {void}
   */
  updateRappel(rappel) {
    const element = this.featureLayer.querySelector(`[data-id="${rappel.id}"]`);
    if (!element) return;

    // IDE now knows rappel.length exists and is a number
    const x2 = rappel.x + rappel.length * Math.cos(slopeRadians);
    // ...
  }

});
```

**Enable VS Code type checking:**

```json
// .vscode/settings.json (create this file)
{
  "javascript.suggest.names": true,
  "javascript.implicitProjectConfig.checkJs": true,
  "javascript.validate.enable": true
}
```

**Benefits:**
- IDE autocomplete for feature properties
- Catch typos at development time (`rappel.lenght` → error)
- Self-documenting code (types visible in hover tooltips)
- No runtime overhead (comments are stripped)

**Effort:**
- ~1-2 hours per feature type (6 features = 6-12 hours)
- Add typedef comments as you work on each feature

---

### Phase 4: Optional Enhancements (LOWEST PRIORITY)

**Only consider if:**
- Codebase grows beyond 10,000 LOC
- Team grows beyond 2-3 developers
- Adding 5+ new feature types

#### 4.1 Consider Lightweight TypeScript

**Pros:**
- Full type safety
- Refactoring confidence
- Best IDE support

**Cons:**
- Adds build step (defeats current simplicity)
- Learning curve for non-TS developers
- Potential debugging complexity (source maps)

**Recommendation:** Skip unless team has TS experience and codebase doubles in size.

---

#### 4.2 Add Simple Reactive Layer

**Problem:** Manual `updateX()` calls are error-prone.

**Solution:** Proxy-based reactivity (no framework)

```javascript
// lib/editor-reactive.js
function reactive(obj, onChange) {
  return new Proxy(obj, {
    set(target, prop, value) {
      target[prop] = value;
      onChange(prop, value);
      return true;
    }
  });
}

// Usage in editor.js:
loadFromYAML(yaml) {
  const data = jsyaml.load(yaml);

  this.features = data.features.map(f => reactive(f, (prop, val) => {
    this[`update${capitalize(f.type)}`](f);  // Auto-update on any change
  }));
}
```

**Pros:**
- Eliminates manual update calls
- Simpler feature code

**Cons:**
- Debugging complexity (proxy indirection)
- Performance concerns with large feature lists
- Not needed for current scale

**Recommendation:** Skip unless adding 10+ new feature types.

---

## What NOT to Do

### ❌ Don't Add a Build Step (Yet)

**Why:** Current zero-build setup is a major strength.

**Exception:** Only add build if:
- LOC > 10,000
- Team size > 3
- Need minification for production

---

### ❌ Don't Introduce React/Vue/Svelte

**Why:** Massive overkill for this use case.

**Current approach works well:**
- Direct SVG manipulation is simple and performant
- No virtual DOM reconciliation needed
- No framework lock-in

**Exception:** Only consider if building a large dashboard with many views.

---

### ❌ Don't Rewrite in TypeScript (Yet)

**Why:** Duplication problem must be solved first.

**Rationale:**
- TypeScript won't reduce duplication
- Adds build complexity before extracting patterns
- Better to use JSDoc for now (Phase 3.2)

**Exception:** Only consider if:
- Team has TS experience
- Duplication already solved (Phase 1 complete)
- Codebase > 10k LOC

---

### ❌ Don't Add ESLint/Prettier (Yet)

**Why:** Team is single developer, style is already consistent.

**Exception:** Only add when team grows beyond 2 developers.

---

## Success Metrics

Track these to measure manageability improvements:

### 1. Time to Add New Feature Type
- **Baseline:** ~4 hours (write add/render/update/drag methods from scratch)
- **Target after Phase 1:** <1 hour (use DragBehaviors/TextOffsets)

### 2. Lines of Code per Feature
- **Baseline:** ~350 lines/feature (including boilerplate)
- **Target after Phase 1:** <150 lines/feature (boilerplate extracted)

### 3. Test Coverage
- **Baseline:** 0% (no tests)
- **Target after Phase 2:** >60% of core paths

### 4. Bug Regression Rate
- **Baseline:** Unknown (track via GitHub issues going forward)
- **Target:** <2 regressions per month

### 5. Time to Find Feature-Specific Code
- **Baseline:** ~2 minutes (scroll through 2042-line file)
- **Target after Phase 3:** <30 seconds (open dedicated feature file)

### 6. Onboarding Time
- **Baseline:** Unknown (track for next contributor)
- **Target:** <2 hours to add first feature (with Phase 1+2 complete)

---

## Recommended Action Plan

### Immediate (Next 1-2 weeks)

**Priority 1: Reduce Duplication**
- [ ] Create `lib/editor-drag-behaviors.js` (Phase 1.1)
- [ ] Create `lib/editor-text-offsets.js` (Phase 1.2)
- [ ] Update all 6 feature drag handlers to use new utilities
- [ ] Update all 4 text drag handlers to use TextOffsets
- [ ] Test all features still work correctly
- [ ] Commit and tag as `v1.0-refactor-drag`

**Expected result:** ~500 lines removed, all features behave identically

---

### Short-term (Next 1-2 months)

**Priority 2: Add Testing**
- [ ] Create `tests/` directory
- [ ] Add schema validation tests (Phase 2.1)
- [ ] Add integration tests for add/render/update (Phase 2.2)
- [ ] Run tests in CI (GitHub Actions or similar)
- [ ] Add test badge to README
- [ ] Commit and tag as `v1.1-tests`

**Expected result:** >20 tests covering core paths, catches regressions automatically

**Priority 3: Improve Structure**
- [ ] Create `lib/features/` directory (Phase 3.1)
- [ ] Split editor-features.js into 6 feature files
- [ ] Update script load order in index.html
- [ ] Update test files to load new structure
- [ ] Verify all tests still pass
- [ ] Commit and tag as `v1.2-structure`

**Expected result:** Easier to find feature-specific code

---

### Long-term (3-6 months)

**Priority 4: Type Safety**
- [ ] Add JSDoc typedefs for all feature types (Phase 3.2)
- [ ] Add JSDoc for all public methods
- [ ] Enable VS Code type checking
- [ ] Fix any type errors discovered
- [ ] Commit and tag as `v1.3-types`

**Expected result:** IDE autocomplete, fewer typos

**Priority 5 (Optional): Advanced**
- [ ] Consider TypeScript if LOC > 10k (Phase 4.1)
- [ ] Consider reactive layer if adding 5+ features (Phase 4.2)

**Decision point:** Re-evaluate need based on codebase growth

---

## Conclusion

The topo editor is well-designed with strong fundamentals. The primary threats to long-term manageability are:

1. **Code duplication** (HIGH) - Solved by Phase 1
2. **Lack of tests** (HIGH) - Solved by Phase 2
3. **Large files** (MEDIUM) - Solved by Phase 3
4. **No type safety** (MEDIUM) - Solved by Phase 3.2

By following the phased approach above, you can significantly improve manageability while preserving the project's core strength: **simplicity**.

**Preserve these strengths:**
- ✅ Zero build step
- ✅ Plain JavaScript
- ✅ Direct SVG manipulation
- ✅ Clean data model
- ✅ Separation of concerns

**Improve these weaknesses:**
- ⚠️ Code duplication → Extract common patterns
- ⚠️ No tests → Add minimal test coverage
- ⚠️ Large files → Split by feature
- ⚠️ No types → Add JSDoc annotations

This keeps the project maintainable, testable, and easy to understand for years to come.
