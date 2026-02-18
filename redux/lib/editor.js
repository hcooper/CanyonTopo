// Canyon Topo Interactive Editor
// Clean-sheet rewrite with canvas-first approach

class TopoEditor extends TopoRenderer {
  constructor(containerId) {
    super(containerId); // sets container, width, height, gridSize, features, zoom/pan state

    // Editor-specific state
    this.selectedFeature = null;
    this.nextId = 0;
    this.snapToGrid = true; // Snap-to-grid enabled by default
    this.drawingLine = false;
    this.lineStartPoint = null;
    this.drawingPool = false;
    this.poolStartPoint = null;
    this.previewPool = null;
    this.pendingTool = null; // 'line', 'rappel', or 'pool' — waiting for first canvas click
    this.snapRadius = 15; // Radius for snapping to connection points
    this.hoveredConnectionPoint = null;

    // Undo/redo state
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;

    this.init();
  }

  init() {
    super.init(); // createCanvas(), drawGrid(), attachEventListeners()
    this.createToolbar();
    this.createControls();
    this.updatePropertiesPanel(null); // Initialize empty properties panel
    this.renderFeatureList(); // Initialize empty feature list
    this.saveState(); // Save initial empty state
  }

  createCanvas() {
    super.createCanvas(); // creates svg, gridLayer, featureLayer, appends to container
    this.svg.style.cursor = 'none'; // hide OS cursor; editor uses its own crosshair

    // Add cursor layer on top of featureLayer (editor-only)
    this.cursorLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.cursorLayer.id = 'cursor-layer';
    this.cursorLayer.style.pointerEvents = 'none'; // Don't interfere with clicks
    this.svg.appendChild(this.cursorLayer);

    // Create cursor indicator elements
    this.createCursor();
  }

  createCursor() {
    // Crosshair cursor
    const cursorSize = 8;

    // Vertical line
    this.cursorVLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.cursorVLine.setAttribute('stroke', '#ff4444');
    this.cursorVLine.setAttribute('stroke-width', '1.5');
    this.cursorVLine.setAttribute('opacity', '0.7');

    // Horizontal line
    this.cursorHLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.cursorHLine.setAttribute('stroke', '#ff4444');
    this.cursorHLine.setAttribute('stroke-width', '1.5');
    this.cursorHLine.setAttribute('opacity', '0.7');

    // Center circle
    this.cursorCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    this.cursorCircle.setAttribute('r', '3');
    this.cursorCircle.setAttribute('fill', 'none');
    this.cursorCircle.setAttribute('stroke', '#ff4444');
    this.cursorCircle.setAttribute('stroke-width', '2');
    this.cursorCircle.setAttribute('opacity', '0.7');

    this.cursorLayer.appendChild(this.cursorVLine);
    this.cursorLayer.appendChild(this.cursorHLine);
    this.cursorLayer.appendChild(this.cursorCircle);

    // Hide cursor initially
    this.cursorLayer.style.display = 'none';
  }

  attachEventListeners() {
    super.attachEventListeners(); // mouse wheel zoom + middle mouse pan

    // Prevent default context menu
    this.svg.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this.showContextMenu(e);
    });

    // Close context menu on left click
    document.addEventListener('click', () => {
      this.hideContextMenu();
    });

    // Track mouse movement for cursor
    this.svg.addEventListener('mousemove', (e) => {
      this.updateCursor(e);
    });

    this.svg.addEventListener('mouseenter', () => {
      this.cursorLayer.style.display = 'block';
    });

    this.svg.addEventListener('mouseleave', () => {
      this.cursorLayer.style.display = 'none';
    });

    // Left click for line/rappel drawing and deselecting
    this.svg.addEventListener('click', (e) => {
      if (this.pendingTool) {
        const coords = this.screenToSVGCoords(e);
        let x = coords.x;
        let y = coords.y;
        if (this.snapToGrid) {
          x = Math.round(x / this.gridSize) * this.gridSize;
          y = Math.round(y / this.gridSize) * this.gridSize;
        }
        const tool = this.pendingTool;
        this.pendingTool = null;
        if (tool === 'line') this.startLine(x, y);
        else if (tool === 'rappel') this.startRappel(x, y);
        else if (tool === 'pool') this.startPool(x, y);
      } else if (this.drawingPool) {
        const coords = this.screenToSVGCoords(e);
        let x = coords.x;
        let y = coords.y;
        if (this.snapToGrid) {
          x = Math.round(x / this.gridSize) * this.gridSize;
          y = Math.round(y / this.gridSize) * this.gridSize;
        }
        this.finishPool(x, y);
      } else if (this.drawingLine) {
        const coords = this.screenToSVGCoords(e);
        let x = coords.x;
        let y = coords.y;

        if (this.snapToGrid) {
          x = Math.round(x / this.gridSize) * this.gridSize;
          y = Math.round(y / this.gridSize) * this.gridSize;
        }

        this.finishLine(x, y);
      } else if (this.drawingRappel) {
        const coords = this.screenToSVGCoords(e);
        let x = coords.x;
        let y = coords.y;

        if (this.snapToGrid) {
          x = Math.round(x / this.gridSize) * this.gridSize;
          y = Math.round(y / this.gridSize) * this.gridSize;
        }

        this.finishRappel(x, y);
      } else {
        // Deselect if clicking on canvas background
        if (e.target === this.svg || e.target.closest('#grid-layer')) {
          this.selectFeature(null);
        }
      }
    });

    // Keyboard shortcuts for undo/redo
    document.addEventListener('keydown', (e) => {
      // Ctrl+Z or Cmd+Z for undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        this.undo();
      }
      // Ctrl+Shift+Z or Cmd+Shift+Z or Ctrl+Y for redo
      else if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
               ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
        e.preventDefault();
        this.redo();
      }
      // Escape to cancel active drawing
      else if (e.key === 'Escape') {
        this.cancelDrawing();
      }
    });
  }

  updateCursor(e) {
    const coords = this.screenToSVGCoords(e);
    let x = coords.x;
    let y = coords.y;

    // Check for nearby connection points
    const nearbyPoint = this.findNearbyConnectionPoint(x, y);

    // Snap to connection point if nearby, otherwise snap to grid
    if (nearbyPoint) {
      x = nearbyPoint.x;
      y = nearbyPoint.y;
      this.hoveredConnectionPoint = nearbyPoint;
      // Highlight the connection point
      this.highlightConnectionPoint(nearbyPoint.element);
    } else {
      this.hoveredConnectionPoint = null;
      this.clearConnectionPointHighlights();

      // Snap to grid if enabled
      if (this.snapToGrid) {
        x = Math.round(x / this.gridSize) * this.gridSize;
        y = Math.round(y / this.gridSize) * this.gridSize;
      }
    }

    const cursorSize = 8;

    // Update crosshair position
    this.cursorVLine.setAttribute('x1', x);
    this.cursorVLine.setAttribute('y1', y - cursorSize);
    this.cursorVLine.setAttribute('x2', x);
    this.cursorVLine.setAttribute('y2', y + cursorSize);

    this.cursorHLine.setAttribute('x1', x - cursorSize);
    this.cursorHLine.setAttribute('y1', y);
    this.cursorHLine.setAttribute('x2', x + cursorSize);
    this.cursorHLine.setAttribute('y2', y);

    this.cursorCircle.setAttribute('cx', x);
    this.cursorCircle.setAttribute('cy', y);

    // Update preview line if drawing line or rappel
    if (this.drawingLine && this.previewLine) {
      this.previewLine.setAttribute('x2', x);
      this.previewLine.setAttribute('y2', y);
    } else if (this.drawingRappel && this.previewRappel) {
      this.previewRappel.setAttribute('x2', x);
      this.previewRappel.setAttribute('y2', y);
    } else if (this.drawingPool && this.previewPool) {
      const sx = this.poolStartPoint.x;
      const sy = this.poolStartPoint.y;
      const cx = (sx + x) / 2;
      const cy = (sy + y) / 2;
      const width = Math.abs(x - sx);
      const depth = Math.max(width * 0.4, 10);
      const controlOffset = depth * 0.552;
      this.previewPool.setAttribute('d',
        `M ${sx},${sy} C ${sx},${sy + controlOffset} ${x},${y + controlOffset} ${x},${y}`
      );
    }
  }

  findNearbyConnectionPoint(x, y) {
    const points = this.featureLayer.querySelectorAll('.connection-point');

    for (let point of points) {
      const cx = parseFloat(point.getAttribute('cx'));
      const cy = parseFloat(point.getAttribute('cy'));
      const distance = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

      if (distance <= this.snapRadius) {
        return {
          x: cx,
          y: cy,
          featureId: point.getAttribute('data-feature-id'),
          pointType: point.getAttribute('data-point-type'),
          element: point
        };
      }
    }

    return null;
  }

  highlightConnectionPoint(element) {
    // Clear previous highlights
    this.clearConnectionPointHighlights();

    if (element) {
      element.setAttribute('r', '6');
      element.setAttribute('fill', '#ff4444');
    }
  }

  clearConnectionPointHighlights() {
    const points = this.featureLayer.querySelectorAll('.connection-point');
    points.forEach(point => {
      point.setAttribute('r', '4');
      point.setAttribute('fill', '#52ab98');
    });
  }

  startLine(x, y) {
    this.drawingLine = true;
    this.lineStartPoint = { x, y };

    // Create preview line
    this.previewLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.previewLine.setAttribute('x1', x);
    this.previewLine.setAttribute('y1', y);
    this.previewLine.setAttribute('x2', x);
    this.previewLine.setAttribute('y2', y);
    this.previewLine.setAttribute('stroke', '#52ab98');
    this.previewLine.setAttribute('stroke-width', '3');
    this.previewLine.setAttribute('stroke-dasharray', '5,5');
    this.previewLine.setAttribute('stroke-linecap', 'round');
    this.previewLine.setAttribute('opacity', '0.7');
    this.cursorLayer.appendChild(this.previewLine);

    // Update instructions
    const instructions = document.querySelector('.instructions');
    if (instructions) {
      instructions.textContent = 'Click to place the end of the line';
    }
  }

  finishLine(x, y) {
    const dx = x - this.lineStartPoint.x;
    const dy = y - this.lineStartPoint.y;
    const length = Math.round(Math.sqrt(dx * dx + dy * dy));
    const slope = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);

    const line = {
      id: this.nextId++,
      type: 'line',
      x1: this.lineStartPoint.x,
      y1: this.lineStartPoint.y,
      x2: x,
      y2: y,
      length: length,
      slope: slope,
      shorten: false,
      traverse: false,
      arrow: false
    };

    this.features.push(line);
    this.renderLine(line);

    // Clean up
    if (this.previewLine) {
      this.previewLine.remove();
      this.previewLine = null;
    }
    this.drawingLine = false;
    this.lineStartPoint = null;
    this.clearConnectionPointHighlights();

    // Restore instructions
    const instructions = document.querySelector('.instructions');
    if (instructions) {
      instructions.textContent = 'Right-click on the canvas to add features';
    }

    this.saveState();
    console.log('Added line:', line);
  }

  cancelDrawing() {
    if (!this.drawingLine && !this.drawingRappel && !this.drawingPool && !this.pendingTool) return;

    this.pendingTool = null;

    if (this.previewLine) {
      this.previewLine.remove();
      this.previewLine = null;
    }
    if (this.previewRappel) {
      this.previewRappel.remove();
      this.previewRappel = null;
    }
    if (this.previewPool) {
      this.previewPool.remove();
      this.previewPool = null;
    }

    this.drawingLine = false;
    this.drawingRappel = false;
    this.drawingPool = false;
    this.lineStartPoint = null;
    this.poolStartPoint = null;
    this.clearConnectionPointHighlights();
    this.svg.style.cursor = 'none';

    const instructions = document.querySelector('.instructions');
    if (instructions) {
      instructions.textContent = 'Right-click on the canvas to add features';
    }
  }

  startRappel(x, y) {
    this.drawingRappel = true;
    this.rappelStartPoint = { x, y };

    // Create preview line
    this.previewRappel = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    this.previewRappel.setAttribute('x1', x);
    this.previewRappel.setAttribute('y1', y);
    this.previewRappel.setAttribute('x2', x);
    this.previewRappel.setAttribute('y2', y);
    this.previewRappel.setAttribute('stroke', '#52ab98');
    this.previewRappel.setAttribute('stroke-width', '3');
    this.previewRappel.setAttribute('stroke-dasharray', '5,5');
    this.previewRappel.setAttribute('stroke-linecap', 'round');
    this.previewRappel.setAttribute('opacity', '0.7');
    this.cursorLayer.appendChild(this.previewRappel);

    // Update instructions
    const instructions = document.querySelector('.instructions');
    if (instructions) {
      instructions.textContent = 'Click to place the end of the rappel';
    }
  }

  finishRappel(x, y) {
    const dx = x - this.rappelStartPoint.x;
    const dy = y - this.rappelStartPoint.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    const slope = Math.atan2(dy, dx) * 180 / Math.PI;

    const rappel = {
      id: this.nextId++,
      type: 'rappel',
      x: this.rappelStartPoint.x,
      y: this.rappelStartPoint.y,
      length: length,
      slope: slope,
      curveOffset: -15,  // Default curve offset to the right
      curvePosition: 0.5,  // Position along the line (0=start, 1=end, 0.5=middle)
      description: ''  // Description text to display next to the rappel
    };

    this.features.push(rappel);
    this.renderRappel(rappel);

    // Clean up
    if (this.previewRappel) {
      this.previewRappel.remove();
      this.previewRappel = null;
    }
    this.drawingRappel = false;
    this.rappelStartPoint = null;
    this.clearConnectionPointHighlights();

    // Restore instructions
    const instructions = document.querySelector('.instructions');
    if (instructions) {
      instructions.textContent = 'Right-click on the canvas to add features';
    }

    this.saveState();
    console.log('Added rappel:', rappel);
  }

  startPool(x, y) {
    this.drawingPool = true;
    this.poolStartPoint = { x, y };

    // Preview: dashed pool arc that updates on mousemove
    this.previewPool = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    this.previewPool.setAttribute('d', `M ${x},${y} C ${x},${y} ${x},${y} ${x},${y}`);
    this.previewPool.setAttribute('stroke', '#4a90e2');
    this.previewPool.setAttribute('stroke-width', '3');
    this.previewPool.setAttribute('stroke-dasharray', '5,5');
    this.previewPool.setAttribute('fill', 'rgba(74,144,226,0.15)');
    this.previewPool.setAttribute('opacity', '0.8');
    this.cursorLayer.appendChild(this.previewPool);

    const instructions = document.querySelector('.instructions');
    if (instructions) {
      instructions.textContent = 'Click to place the right edge of the pool';
    }
  }

  finishPool(x2, y2) {
    const x1 = this.poolStartPoint.x;
    const y1 = this.poolStartPoint.y;

    // Ensure left-to-right ordering
    const leftX  = Math.min(x1, x2);
    const rightX = Math.max(x1, x2);
    const width  = rightX - leftX;
    const y      = (y1 + y2) / 2;
    const depth  = Math.max(width * 0.4, 10);

    if (this.previewPool) {
      this.previewPool.remove();
      this.previewPool = null;
    }
    this.drawingPool = false;
    this.poolStartPoint = null;

    if (width < 5) return; // Too small to bother

    const pool = {
      id: this.nextId++,
      type: 'pool',
      x: leftX + width / 2,
      y,
      width,
      depth
    };

    this.features.push(pool);
    this.renderPool(pool);
    this.saveState();

    const instructions = document.querySelector('.instructions');
    if (instructions) {
      instructions.textContent = 'Right-click on the canvas to add features';
    }
  }

  selectFeature(id) {
    // Deselect previous
    if (this.selectedFeature !== null) {
      const prevElement = this.featureLayer.querySelector(`[data-id="${this.selectedFeature}"]`);
      if (prevElement) {
        const prevFeature = this.features.find(f => f.id === this.selectedFeature);
        if (prevFeature && prevFeature.type === 'anchor') {
          const anchorLines = prevElement.querySelectorAll('.anchor-line');
          anchorLines.forEach(line => {
            line.setAttribute('stroke', '#000');
            line.setAttribute('stroke-width', '2');
          });
        } else if (prevFeature && prevFeature.type === 'rappel') {
          const curve = prevElement.querySelector('.rappel-curve');
          if (curve) {
            curve.setAttribute('stroke', '#666');
            curve.setAttribute('stroke-width', '2');
          }
          const arrowhead = prevElement.querySelector('.rappel-arrowhead');
          if (arrowhead) {
            arrowhead.setAttribute('fill', '#666');
            arrowhead.setAttribute('stroke', '#666');
          }
        } else {
          const shape = prevElement.querySelector('line, path');
          if (shape) {
            shape.setAttribute('stroke', '#000');
            shape.setAttribute('stroke-width', '3');
          }
        }
      }
    }

    // Select new (or deselect if id is null)
    this.selectedFeature = id;

    if (id !== null) {
      const element = this.featureLayer.querySelector(`[data-id="${id}"]`);
      if (element) {
        const feature = this.features.find(f => f.id === id);
        if (feature && feature.type === 'anchor') {
          const anchorLines = element.querySelectorAll('.anchor-line');
          anchorLines.forEach(line => {
            line.setAttribute('stroke', '#ff4444');
            line.setAttribute('stroke-width', '3');
          });
        } else if (feature && feature.type === 'rappel') {
          const curve = element.querySelector('.rappel-curve');
          if (curve) {
            curve.setAttribute('stroke', '#ff4444');
            curve.setAttribute('stroke-width', '3');
          }
          const arrowhead = element.querySelector('.rappel-arrowhead');
          if (arrowhead) {
            arrowhead.setAttribute('fill', '#ff4444');
            arrowhead.setAttribute('stroke', '#ff4444');
          }
        } else {
          const shape = element.querySelector('line, path');
          if (shape) {
            shape.setAttribute('stroke', '#ff4444');
            shape.setAttribute('stroke-width', '4');
          }
        }
      }
    }

    const feature = id !== null ? this.features.find(f => f.id === id) : null;
    console.log('Selected feature:', feature);

    // Update properties panel
    this.updatePropertiesPanel(feature);

    // Update feature list highlighting
    this.renderFeatureList();
  }

  deleteFeature(id) {
    const index = this.features.findIndex(f => f.id === id);
    if (index !== -1) {
      this.features.splice(index, 1);
      this.selectedFeature = null;
      this.render();
      this.updatePropertiesPanel(null);
      this.saveState();
      console.log('Deleted feature:', id);
    }
  }

  render() {
    super.render(); // clears featureLayer, calls each renderXxx
    // Update feature list in sidebar
    this.renderFeatureList();
  }

}

function loadPage() {

  // Main container
  const mainContainer = document.createElement('div');
  mainContainer.className = 'main-container';

  // Canvas section
  const canvasSection = document.createElement('div');
  canvasSection.className = 'canvas-section';

  const canvasRow = document.createElement('div');
  canvasRow.id = 'canvas-row';

  const canvasContainer = document.createElement('div');
  canvasContainer.id = 'canvas-container';

  canvasRow.appendChild(canvasContainer);
  canvasSection.appendChild(canvasRow);

  // Sidebar
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';

  const featuresDetails = document.createElement('details');

  const featuresSummary = document.createElement('summary');
  featuresSummary.textContent = 'Features';
  featuresSummary.style.cursor = 'pointer';
  featuresSummary.style.userSelect = 'none';
  featuresDetails.appendChild(featuresSummary);

  const featureList = document.createElement('div');
  featureList.id = 'feature-list';
  featuresDetails.appendChild(featureList);

  const propertiesHeading = document.createElement('h2');
  propertiesHeading.textContent = 'Properties';

  const propertiesPanel = document.createElement('div');
  propertiesPanel.id = 'properties-panel';

  const emptyState = document.createElement('p');
  emptyState.className = 'empty-state';
  emptyState.textContent = 'Select a feature to edit properties';
  propertiesPanel.appendChild(emptyState);

  sidebar.appendChild(featuresDetails);
  sidebar.appendChild(propertiesHeading);
  sidebar.appendChild(propertiesPanel);

  mainContainer.appendChild(canvasSection);
  mainContainer.appendChild(sidebar);

  container = document.getElementById("topo-container");

  container.appendChild(mainContainer);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  loadPage();
  window.topoEditor = new TopoEditor('canvas-container');
  if (typeof raw_yaml !== 'undefined' && raw_yaml) {
    window.topoEditor.loadFromYAML(raw_yaml);
  }
});
