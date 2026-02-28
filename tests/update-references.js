#!/usr/bin/env node

/**
 * Update reference images from current output
 *
 * This script copies all images from tests/output/ to tests/reference/
 * Use this when you've verified that visual changes are intentional
 * and want to update the baseline "golden" images.
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');
const REFERENCE_DIR = path.join(__dirname, 'reference');

// Ensure reference directory exists
if (!fs.existsSync(REFERENCE_DIR)) {
  fs.mkdirSync(REFERENCE_DIR, { recursive: true });
}

// Get all PNG files in output directory
const outputFiles = fs.readdirSync(OUTPUT_DIR)
  .filter(f => f.endsWith('.png'))
  .sort();

if (outputFiles.length === 0) {
  console.log('⚠️  No output images found in tests/output/');
  console.log('   Run tests first with: npm test');
  process.exit(0);
}

console.log('📸 Updating reference images...\n');

let updated = 0;
let created = 0;

outputFiles.forEach(file => {
  const outputPath = path.join(OUTPUT_DIR, file);
  const refPath = path.join(REFERENCE_DIR, file);
  const exists = fs.existsSync(refPath);

  fs.copyFileSync(outputPath, refPath);

  if (exists) {
    console.log(`  ✓ Updated: ${file}`);
    updated++;
  } else {
    console.log(`  + Created: ${file}`);
    created++;
  }
});

console.log();
console.log('='.repeat(50));
console.log(`✅ Updated ${updated} reference image(s)`);
console.log(`➕ Created ${created} new reference image(s)`);
console.log('='.repeat(50));
console.log();
console.log('Reference images are now up to date.');
console.log('Run tests again with: npm test');
