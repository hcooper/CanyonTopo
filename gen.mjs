import yaml from 'js-yaml';
import fs from 'fs';
import Draw from 'draw.js';

// Load the YAML configuration
const FILE = 'big.yaml';
const config = yaml.load(fs.readFileSync(FILE, 'utf8'));

// Usage
const output = new Draw(config);
output.draw();
output.write('output.svg');
