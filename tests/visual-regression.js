#!/usr/bin/env node

/**
 * Visual regression test runner for Canyon Topo Editor
 *
 * Loads YAML fixtures, renders them in a headless browser,
 * and compares the output against reference images.
 */

const { chromium } = require('playwright');
const { PNG } = require('pngjs');
const pixelmatch = require('pixelmatch');
const fs = require('fs');
const path = require('path');

// Configuration
const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const REFERENCE_DIR = path.join(__dirname, 'reference');
const OUTPUT_DIR = path.join(__dirname, 'output');
const DIFFS_DIR = path.join(__dirname, 'diffs');
const VIEWER_PATH = path.join(__dirname, 'test-viewer.html');
const THRESHOLD = 0.01; // 1% pixel difference threshold
const RENDER_WAIT = 1000; // milliseconds to wait for rendering

// Ensure output directories exist
[OUTPUT_DIR, DIFFS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

/**
 * Compare two PNG images and return difference metrics
 */
function compareImages(refPath, outputPath) {
  const ref = PNG.sync.read(fs.readFileSync(refPath));
  const output = PNG.sync.read(fs.readFileSync(outputPath));

  const { width, height } = ref;

  // Create diff image
  const diff = new PNG({ width, height });

  // Count mismatched pixels
  const mismatchedPixels = pixelmatch(
    ref.data,
    output.data,
    diff.data,
    width,
    height,
    {
      threshold: 0.1, // pixel-level sensitivity (0-1)
      alpha: 0.5,
      diffColor: [255, 0, 0], // red for differences
    }
  );

  const totalPixels = width * height;
  const mismatchPercent = (mismatchedPixels / totalPixels) * 100;

  return {
    mismatchedPixels,
    totalPixels,
    mismatchPercent,
    diffImage: diff,
  };
}

/**
 * Run visual regression tests
 */
async function runTests() {
  console.log('🎨 Starting visual regression tests...\n');

  // Get all YAML fixtures
  const fixtures = fs.readdirSync(FIXTURES_DIR)
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml'))
    .sort();

  if (fixtures.length === 0) {
    console.error('❌ No YAML fixtures found in', FIXTURES_DIR);
    process.exit(1);
  }

  console.log(`Found ${fixtures.length} test fixture(s):\n`);
  fixtures.forEach(f => console.log(`  - ${f}`));
  console.log();

  // Launch browser
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1400, height: 1200 },
    deviceScaleFactor: 1, // Prevent retina scaling
  });
  const page = await context.newPage();

  const results = {
    passed: [],
    failed: [],
    skipped: [],
  };

  // Run tests
  for (const fixture of fixtures) {
    const testName = path.basename(fixture, path.extname(fixture));
    const fixturePath = path.join(FIXTURES_DIR, fixture);
    const outputPath = path.join(OUTPUT_DIR, `${testName}.png`);
    const refPath = path.join(REFERENCE_DIR, `${testName}.png`);
    const diffPath = path.join(DIFFS_DIR, `${testName}-diff.png`);

    process.stdout.write(`Testing ${testName}... `);

    try {
      // Load YAML fixture
      const yamlData = fs.readFileSync(fixturePath, 'utf8');

      // Navigate to viewer
      await page.goto(`file://${VIEWER_PATH}`);

      // Wait for viewer to initialize
      await page.waitForFunction(() => window.topoViewer !== undefined);

      // Load YAML into viewer
      await page.evaluate((yaml) => {
        window.topoViewer.loadFromYAML(yaml);
      }, yamlData);

      // Wait for rendering to complete
      await page.waitForTimeout(RENDER_WAIT);

      // Take screenshot of the SVG canvas
      const svgElement = await page.$('#canvas-container svg');
      if (!svgElement) {
        throw new Error('SVG element not found');
      }

      await svgElement.screenshot({ path: outputPath });

      // Compare with reference if it exists
      if (fs.existsSync(refPath)) {
        const comparison = compareImages(refPath, outputPath);

        if (comparison.mismatchPercent > THRESHOLD) {
          // Test failed - save diff image
          fs.writeFileSync(diffPath, PNG.sync.write(comparison.diffImage));

          console.log(`❌ FAIL (${comparison.mismatchPercent.toFixed(2)}% different)`);
          console.log(`   Diff saved to: ${path.relative(process.cwd(), diffPath)}`);

          results.failed.push({
            name: testName,
            mismatchPercent: comparison.mismatchPercent,
            diffPath,
          });
        } else {
          // Test passed
          console.log(`✅ PASS (${comparison.mismatchPercent.toFixed(3)}% difference)`);

          // Clean up old diff if it exists
          if (fs.existsSync(diffPath)) {
            fs.unlinkSync(diffPath);
          }

          results.passed.push(testName);
        }
      } else {
        // No reference image - skip comparison
        console.log(`⚠️  SKIP (no reference image)`);
        console.log(`   Output saved to: ${path.relative(process.cwd(), outputPath)}`);
        console.log(`   To create reference: cp ${outputPath} ${refPath}`);

        results.skipped.push(testName);
      }
    } catch (error) {
      console.log(`💥 ERROR: ${error.message}`);
      results.failed.push({
        name: testName,
        error: error.message,
      });
    }
  }

  await browser.close();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 Test Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed:  ${results.passed.length}`);
  console.log(`❌ Failed:  ${results.failed.length}`);
  console.log(`⚠️  Skipped: ${results.skipped.length}`);
  console.log(`📁 Total:   ${fixtures.length}`);

  if (results.failed.length > 0) {
    console.log('\n❌ Failed tests:');
    results.failed.forEach(result => {
      if (result.mismatchPercent) {
        console.log(`   ${result.name} (${result.mismatchPercent.toFixed(2)}% different)`);
      } else {
        console.log(`   ${result.name} (${result.error})`);
      }
    });
  }

  if (results.skipped.length > 0) {
    console.log('\n⚠️  Skipped tests (missing reference images):');
    results.skipped.forEach(name => {
      console.log(`   ${name}`);
    });
    console.log('\nTo create reference images, run:');
    console.log('  npm run test:update-refs');
  }

  console.log();

  // Exit with error code if any tests failed
  process.exit(results.failed.length > 0 ? 1 : 0);
}

// Run tests
runTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
