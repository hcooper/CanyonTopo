# Visual Regression Tests

Automated visual regression testing for the Canyon Topo Editor.

## Quick Start

### First Time Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run tests to generate initial output images:
   ```bash
   npm test
   ```

3. Create reference images from the output:
   ```bash
   npm run test:update-refs
   ```

4. Run tests again to verify everything passes:
   ```bash
   npm test
   ```

## Usage

### Running Tests

```bash
npm test
```

This will:
- Load each YAML fixture from `fixtures/`
- Render it in a headless browser
- Compare against reference images in `reference/`
- Report pass/fail status

### Test Results

- **✅ PASS** - Image matches reference (< 1% difference)
- **❌ FAIL** - Image differs from reference (check `diffs/` folder)
- **⚠️ SKIP** - No reference image exists yet

### Updating Reference Images

When you make intentional visual changes:

```bash
# Run tests to generate new output
npm test

# Review the output images in tests/output/

# If changes look correct, update references
npm run test:update-refs

# Verify tests pass
npm test
```

## Directory Structure

```
tests/
├── fixtures/       # YAML test inputs
├── reference/      # "Golden" reference images
├── output/         # Generated images (during test runs)
├── diffs/          # Visual diff images (when tests fail)
├── visual-regression.js
├── update-references.js
└── README.md (this file)
```

## Adding New Tests

1. Create a new YAML file in `fixtures/`:
   ```bash
   nano tests/fixtures/my-new-test.yaml
   ```

2. Run tests to generate output:
   ```bash
   npm test
   ```

3. Review the output image:
   ```bash
   open tests/output/my-new-test.png
   ```

4. If it looks correct, create the reference:
   ```bash
   npm run test:update-refs
   ```

## Test Fixtures

Current test fixtures:

- **basic-features.yaml** - One of each feature type (line, rappel, pool, anchor, notes, access)
- **all-note-types.yaml** - All note icon types (info, warning, swim, hydraulic, rockfall, bridge, name)
- **edge-cases.yaml** - Edge cases (multiline text, text offsets, curved rappels, asymmetric pools, arrows, shorten marks, traverse lines, multiple bolts, metadata)

## Troubleshooting

### Tests failing after code changes

This is expected! Visual regression tests catch changes. Review the diff images in `tests/diffs/`:

```bash
open tests/diffs/
```

If the changes are correct, update references:
```bash
npm run test:update-refs
```

### "No reference image" warnings

Create reference images:
```bash
npm run test:update-refs
```

### Browser fails to launch

Install Playwright browsers:
```bash
npx playwright install chromium
```

## Configuration

Edit `visual-regression.js` to adjust:

- `THRESHOLD` - Pixel difference tolerance (default: 0.01 = 1%)
- `RENDER_WAIT` - Time to wait for rendering (default: 1000ms)
- Viewport size (default: 1400x1200)

## See Also

- [TESTING.md](../TESTING.md) - Full testing plan and architecture
- [CLAUDE.md](../CLAUDE.md) - Project documentation
