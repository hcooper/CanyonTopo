# Visual Regression Testing Plan

## Goal

Create a simple, automated visual regression test system that:
1. Loads YAML topo files programmatically
2. Renders them to PNG images using the actual renderer
3. Compares output against reference images
4. Shows visual diffs when changes occur

## Motivation

- Catch unintended visual regressions when modifying renderer code
- Document expected visual output for different feature types
- Provide confidence when refactoring or adding features
- Create a baseline for feature rendering behavior

## Architecture

### Approach: Playwright + Pixel Comparison

**Why Playwright?**
- Already in node_modules (dependency of vitest)
- Can run headless browser with actual SVG rendering
- No need for fake DOM or canvas mocking
- Tests run against real viewer.html page
- Accurate representation of actual user experience

**Comparison Library: pixelmatch**
- Fast pixel-by-pixel image comparison
- Generates visual diff images highlighting changes
- Well-established, lightweight library
- Returns numerical difference score

### Directory Structure

```
topo/
├── tests/
│   ├── fixtures/           # YAML test fixtures
│   │   ├── basic-features.yaml
│   │   ├── complex-rappels.yaml
│   │   └── all-note-types.yaml
│   ├── reference/          # Reference "golden" images
│   │   ├── basic-features.png
│   │   ├── complex-rappels.png
│   │   └── all-note-types.png
│   ├── output/             # Generated images during test runs
│   │   ├── basic-features.png
│   │   └── ...
│   ├── diffs/              # Visual diff images (when tests fail)
│   │   ├── basic-features-diff.png
│   │   └── ...
│   └── visual-regression.js  # Test runner script
├── package.json
└── TESTING.md (this file)
```

## How It Works

### Test Flow

1. **For each YAML fixture:**
   - Launch headless browser (Playwright)
   - Navigate to `redux/viewer.html`
   - Inject YAML data into viewer
   - Wait for render completion
   - Take screenshot (PNG)
   - Save to `tests/output/`

2. **Compare against reference:**
   - Load reference image from `tests/reference/`
   - Use pixelmatch to compare pixel-by-pixel
   - If difference > threshold:
     - Generate diff image showing changes
     - Mark test as FAILED
   - If difference <= threshold:
     - Mark test as PASSED

3. **Report results:**
   - Console output showing pass/fail for each test
   - List of files with differences
   - Instructions for updating references if changes are intentional

### Test Runner API

```javascript
// tests/visual-regression.js
const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const fs = require('fs');
const path = require('path');

async function runVisualTests() {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  // Get all YAML fixtures
  const fixtures = fs.readdirSync('./tests/fixtures')
    .filter(f => f.endsWith('.yaml'));

  for (const fixture of fixtures) {
    const name = path.basename(fixture, '.yaml');
    const yamlPath = `./tests/fixtures/${fixture}`;
    const yaml = fs.readFileSync(yamlPath, 'utf8');

    // Load viewer page
    await page.goto(`file://${process.cwd()}/redux/viewer.html`);

    // Inject YAML and wait for render
    await page.evaluate((yamlData) => {
      const viewer = window.viewer; // Assumes viewer.html exposes this
      viewer.loadFromYAML(yamlData);
    }, yaml);

    // Wait for render to complete
    await page.waitForTimeout(500); // or use a custom ready signal

    // Screenshot the SVG
    const outputPath = `./tests/output/${name}.png`;
    await page.screenshot({ path: outputPath });

    // Compare with reference
    const refPath = `./tests/reference/${name}.png`;
    if (fs.existsSync(refPath)) {
      const diff = compareImages(refPath, outputPath);
      if (diff.mismatch > 0.01) { // 1% threshold
        // Generate diff image
        saveDiffImage(diff, `./tests/diffs/${name}-diff.png`);
        console.log(`❌ FAIL: ${name} (${diff.mismatch.toFixed(2)}% different)`);
      } else {
        console.log(`✅ PASS: ${name}`);
      }
    } else {
      console.log(`⚠️  SKIP: ${name} (no reference image)`);
    }
  }

  await browser.close();
}
```

## Dependencies

- **playwright** — Browser automation (already available)
- **pixelmatch** — Pixel-by-pixel image comparison
- **pngjs** — PNG encoding/decoding for Node.js

Install with:
```bash
npm install --save-dev pixelmatch pngjs
```

## Usage

### Running Tests

```bash
npm test
```

### Creating Reference Images

First time setup or after intentional visual changes:

```bash
# Run tests to generate output images
npm test

# Copy output to reference (if changes are correct)
cp tests/output/basic-features.png tests/reference/basic-features.png
```

Or use a helper script:
```bash
npm run test:update-refs
```

### Interpreting Results

**PASS:** Image matches reference within threshold (< 1% difference)
**FAIL:** Image differs from reference (check `tests/diffs/` for visual diff)
**SKIP:** No reference image exists yet (create one from output)

## Test Fixtures

### Planned Test Cases

1. **basic-features.yaml** — One of each feature type
   - Line (straight, with arrow, shorten marks)
   - Rappel (straight and curved)
   - Pool (symmetric and asymmetric)
   - Anchor (bolt and natural)
   - Notes (all icon types: info, warning, swim, hydraulic, rockfall, name, bridge)
   - Access (entrance and exit)

2. **edge-cases.yaml** — Edge cases and tricky scenarios
   - Multiline rappel descriptions
   - Dragged text offsets (textOffsetX/Y, nameOffsetX/Y)
   - Multiple anchors (count > 2)
   - Very long/short features
   - Title and grade metadata
   - Timestamp rendering

3. **complex-route.yaml** — Realistic full route
   - Use existing old/yaml/mineral.yaml as basis
   - Tests full layout and spacing

4. **connection-points.yaml** — Snap and connection behavior
   - Lines connecting to anchors
   - Rappels from anchors
   - Info notes with connection points

## Threshold Configuration

**Recommended threshold: 0.01 (1%)**

Why not 0%?
- Anti-aliasing can vary slightly between runs
- Sub-pixel rendering differences
- Font rendering quirks

When to adjust:
- Too many false positives → increase threshold
- Missing real regressions → decrease threshold

## CI/CD Integration (Future)

```yaml
# .github/workflows/visual-regression.yml
name: Visual Regression Tests
on: [pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test
      - uses: actions/upload-artifact@v3
        if: failure()
        with:
          name: visual-diffs
          path: tests/diffs/
```

## Limitations & Future Enhancements

### Current Limitations

- No interaction testing (dragging, clicking, etc.)
- Only tests final rendered output
- Doesn't test editor-specific features (handles, connection points)
- Manual reference image management

### Possible Enhancements

1. **Interactive testing** — Test dragging, box select, etc.
2. **Editor tests** — Verify handles and controls render correctly
3. **Performance benchmarks** — Track render time for complex topos
4. **Automatic reference updates** — CLI tool to review and accept changes
5. **Parallel execution** — Run multiple tests concurrently
6. **Animation testing** — Verify cursor, selection highlights
7. **Cross-browser testing** — Test in Firefox, Safari via Playwright
8. **Accessibility testing** — Verify SVG has proper ARIA labels

## Alternative Approaches Considered

### Rejected: Canvas-based rendering in Node.js
- Would require node-canvas or similar
- Doesn't use actual SVG rendering engine
- Risk of false confidence (passes in tests, fails in browser)

### Rejected: Unit tests with jsdom
- jsdom doesn't render SVG visually
- Can test structure but not appearance
- Misses rendering bugs

### Rejected: Manual screenshot comparison
- Not automated
- Time-consuming
- Easy to miss regressions

## Success Metrics

The test system is successful if:
- ✅ Runs in < 30 seconds for full suite
- ✅ Catches visual regressions before they reach production
- ✅ Easy to add new test cases (just add YAML file)
- ✅ Clear output showing what changed
- ✅ Low maintenance burden (no flaky tests)
