// Canyon Topo Interactive Editor
// Clean-sheet rewrite with canvas-first approach

class TopoEditor {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.width = 1240;
    this.height = 1240;
    this.gridSize = 10;
    this.features = [];
    this.selectedFeature = null;
    this.nextId = 0;
    this.snapToGrid = true; // Snap-to-grid enabled by default
    this.drawingLine = false;
    this.lineStartPoint = null;
    this.snapRadius = 15; // Radius for snapping to connection points
    this.hoveredConnectionPoint = null;

    // Undo/redo state
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 50;

    this.init();
  }

  init() {
    this.createCanvas();
    this.createControls();
    this.drawGrid();
    this.attachEventListeners();
    this.updatePropertiesPanel(null); // Initialize empty properties panel
    this.saveState(); // Save initial empty state
  }

  createCanvas() {
    // Create SVG element
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', this.width);
    this.svg.setAttribute('height', this.height);
    this.svg.style.border = '2px solid #333';
    this.svg.style.backgroundColor = '#ffffff';
    this.svg.style.cursor = 'none';

    // Create layers
    this.gridLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.gridLayer.id = 'grid-layer';

    this.featureLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.featureLayer.id = 'feature-layer';

    this.cursorLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.cursorLayer.id = 'cursor-layer';
    this.cursorLayer.style.pointerEvents = 'none'; // Don't interfere with clicks

    this.svg.appendChild(this.gridLayer);
    this.svg.appendChild(this.featureLayer);
    this.svg.appendChild(this.cursorLayer);

    // Create cursor indicator
    this.createCursor();

    this.container.appendChild(this.svg);
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

  createControls() {
    // Create controls panel
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'canvas-controls';
    controlsDiv.style.marginTop = '10px';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.gap = '15px';
    controlsDiv.style.alignItems = 'center';

    // Snap to grid checkbox
    const snapLabel = document.createElement('label');
    snapLabel.style.display = 'flex';
    snapLabel.style.alignItems = 'center';
    snapLabel.style.gap = '5px';
    snapLabel.style.cursor = 'pointer';

    const snapCheckbox = document.createElement('input');
    snapCheckbox.type = 'checkbox';
    snapCheckbox.checked = this.snapToGrid;
    snapCheckbox.id = 'snap-to-grid';
    snapCheckbox.addEventListener('change', (e) => {
      this.snapToGrid = e.target.checked;
    });

    const snapText = document.createElement('span');
    snapText.textContent = 'Snap to Grid';

    snapLabel.appendChild(snapCheckbox);
    snapLabel.appendChild(snapText);

    // Grid size selector
    const gridSizeLabel = document.createElement('label');
    gridSizeLabel.style.display = 'flex';
    gridSizeLabel.style.alignItems = 'center';
    gridSizeLabel.style.gap = '5px';

    const gridSizeText = document.createElement('span');
    gridSizeText.textContent = 'Grid Size:';

    const gridSizeSelect = document.createElement('select');
    gridSizeSelect.id = 'grid-size';
    [5, 10, 15, 20, 25, 50].forEach(size => {
      const option = document.createElement('option');
      option.value = size;
      option.textContent = `${size}px`;
      if (size === this.gridSize) option.selected = true;
      gridSizeSelect.appendChild(option);
    });

    gridSizeSelect.addEventListener('change', (e) => {
      this.gridSize = parseInt(e.target.value);
      this.drawGrid();
    });

    gridSizeLabel.appendChild(gridSizeText);
    gridSizeLabel.appendChild(gridSizeSelect);

    // Undo button
    const undoBtn = document.createElement('button');
    undoBtn.id = 'undo-btn';
    undoBtn.textContent = '↶';
    undoBtn.title = 'Undo (Ctrl+Z)';
    undoBtn.style.fontSize = '20px';
    undoBtn.addEventListener('click', () => this.undo());

    // Redo button
    const redoBtn = document.createElement('button');
    redoBtn.id = 'redo-btn';
    redoBtn.textContent = '↷';
    redoBtn.title = 'Redo (Ctrl+Shift+Z)';
    redoBtn.style.fontSize = '20px';
    redoBtn.addEventListener('click', () => this.redo());

    // Export SVG button
    const exportSvgBtn = document.createElement('button');
    exportSvgBtn.textContent = 'Export SVG';
    exportSvgBtn.addEventListener('click', () => this.exportSVG());

    // Export PNG button
    const exportPngBtn = document.createElement('button');
    exportPngBtn.textContent = 'Export PNG';
    exportPngBtn.addEventListener('click', () => this.exportPNG());

    // Export Data button
    const exportDataBtn = document.createElement('button');
    exportDataBtn.textContent = 'Export Data';
    exportDataBtn.addEventListener('click', () => this.exportData());

    // Import Data button
    const importDataBtn = document.createElement('button');
    importDataBtn.textContent = 'Import Data';
    importDataBtn.addEventListener('click', () => this.importData());

    controlsDiv.appendChild(snapLabel);
    controlsDiv.appendChild(gridSizeLabel);
    controlsDiv.appendChild(undoBtn);
    controlsDiv.appendChild(redoBtn);
    controlsDiv.appendChild(exportSvgBtn);
    controlsDiv.appendChild(exportPngBtn);
    controlsDiv.appendChild(exportDataBtn);
    controlsDiv.appendChild(importDataBtn);

    this.container.appendChild(controlsDiv);

    // Update button states initially
    this.updateUndoRedoButtons();
  }

  drawGrid() {
    // Clear existing grid
    this.gridLayer.innerHTML = '';

    // Vertical lines
    for (let x = 0; x <= this.width; x += this.gridSize) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', 0);
      line.setAttribute('x2', x);
      line.setAttribute('y2', this.height);
      line.setAttribute('stroke', '#e0e0e0');
      line.setAttribute('stroke-width', x % 50 === 0 ? '1' : '0.5');
      this.gridLayer.appendChild(line);
    }

    // Horizontal lines
    for (let y = 0; y <= this.height; y += this.gridSize) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', 0);
      line.setAttribute('y1', y);
      line.setAttribute('x2', this.width);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', '#e0e0e0');
      line.setAttribute('stroke-width', y % 50 === 0 ? '1' : '0.5');
      this.gridLayer.appendChild(line);
    }
  }

  attachEventListeners() {
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

    // Left click for line drawing and deselecting
    this.svg.addEventListener('click', (e) => {
      if (this.drawingLine) {
        const rect = this.svg.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        if (this.snapToGrid) {
          x = Math.round(x / this.gridSize) * this.gridSize;
          y = Math.round(y / this.gridSize) * this.gridSize;
        }

        this.finishLine(x, y);
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
    });
  }

  updateCursor(e) {
    const rect = this.svg.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

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

    // Update preview line if drawing
    if (this.drawingLine && this.previewLine) {
      this.previewLine.setAttribute('x2', x);
      this.previewLine.setAttribute('y2', y);
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

  showContextMenu(e) {
    const rect = this.svg.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    // Check for nearby connection points first
    const nearbyPoint = this.findNearbyConnectionPoint(x, y);

    if (nearbyPoint) {
      x = nearbyPoint.x;
      y = nearbyPoint.y;
    } else if (this.snapToGrid) {
      // Snap to grid if enabled
      x = Math.round(x / this.gridSize) * this.gridSize;
      y = Math.round(y / this.gridSize) * this.gridSize;
    }

    // Remove existing menu
    this.hideContextMenu();

    // Create context menu
    const menu = document.createElement('div');
    menu.id = 'context-menu';
    menu.style.position = 'absolute';
    menu.style.left = `${e.clientX}px`;
    menu.style.top = `${e.clientY}px`;
    menu.style.backgroundColor = 'white';
    menu.style.border = '2px solid #333';
    menu.style.borderRadius = '5px';
    menu.style.padding = '5px 0';
    menu.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    menu.style.zIndex = '1000';
    menu.style.minWidth = '150px';

    // Menu items
    const items = [
      { label: 'Add Pool', action: () => this.addPool(x, y) },
      { label: 'Start Line', action: () => this.startLine(x, y) },
      { label: 'Add Anchor', action: () => this.addAnchor(x, y) },
      { label: 'Add Rappel', action: () => this.addRappel(x, y) },
      { label: 'Add Hazard', action: () => this.addHazard(x, y) },
      { label: 'Add Exit', action: () => this.addExit(x, y) }
    ];

    items.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.textContent = item.label;
      menuItem.style.padding = '8px 16px';
      menuItem.style.cursor = 'pointer';
      menuItem.style.transition = 'background-color 0.2s';

      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = '#52ab98';
        menuItem.style.color = 'white';
      });

      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = 'transparent';
        menuItem.style.color = 'black';
      });

      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        item.action();
        this.hideContextMenu();
      });

      menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);
  }

  hideContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) {
      menu.remove();
    }
  }

  addPool(x, y) {
    const width = 50;
    const pool = {
      id: this.nextId++,
      type: 'pool',
      x: x + width / 2,  // Offset center so left connection point is at click location
      y: y,
      width: width,
      depth: 30
    };

    this.features.push(pool);
    this.renderPool(pool);
    this.saveState();
    console.log('Added pool:', pool);
  }

  addAnchor(x, y) {
    const size = 15;        // Size of the X
    const count = 2;        // Default count
    const spacing = size + 3; // Spacing between X marks

    // Position anchor so bottom left corner of leftmost X is at click point
    // Leftmost X (i=0) has offsetX = 0 (no centering, just left-to-right)
    // - Left edge at: anchor.x - size/2 = x → anchor.x = x + size/2
    // - Bottom edge at: anchor.y + size/2 = y → anchor.y = y - size/2
    const anchorX = x + size / 2;
    const anchorY = y - size / 2;

    // Connection point at the click location (bottom left)
    const connectionX = x;
    const connectionY = y;

    const anchor = {
      id: this.nextId++,
      type: 'anchor',
      x: anchorX,
      y: anchorY,
      size: size,
      connectionX: connectionX,
      connectionY: connectionY,
      anchorType: 'bolt',  // bolt, natural, piton, etc.
      count: count,
      name: ''
    };

    this.features.push(anchor);
    this.renderAnchor(anchor);
    this.saveState();
    console.log('Added anchor:', anchor);
  }

  addRappel(x, y) {
    const length = 100;  // Default length
    const slope = 90;    // Default slope (straight down)

    const rappel = {
      id: this.nextId++,
      type: 'rappel',
      x: x,
      y: y,
      length: length,
      slope: slope,
      curveOffset: -15,  // Default curve offset to the right
      curvePosition: 0.5  // Position along the line (0=start, 1=end, 0.5=middle)
    };

    this.features.push(rappel);
    this.renderRappel(rappel);
    this.saveState();
    console.log('Added rappel:', rappel);
  }

  addHazard(x, y) {
    const size = 30;  // Size of the triangle

    const hazard = {
      id: this.nextId++,
      type: 'hazard',
      x: x,
      y: y,
      size: size,
      text: '!'  // Default warning text
    };

    this.features.push(hazard);
    this.renderHazard(hazard);
    this.saveState();
    console.log('Added hazard:', hazard);
  }

  addExit(x, y) {
    const length = 60;  // Length of the exit arrow (diagonal distance)

    const exit = {
      id: this.nextId++,
      type: 'exit',
      x: x,
      y: y,
      length: length
    };

    this.features.push(exit);
    this.renderExit(exit);
    this.saveState();
    console.log('Added exit:', exit);
  }

  renderExit(exit) {
    // Create exit group
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', exit.id);
    group.setAttribute('data-type', 'exit');
    group.style.cursor = 'move';

    const x1 = exit.x;
    const y1 = exit.y;

    // Exit arrow goes diagonally up-right at 45 degrees
    // Calculate end point
    const angle45 = -Math.PI / 4; // -45 degrees (up and right)
    const x2 = x1 + exit.length * Math.cos(angle45);
    const y2 = y1 + exit.length * Math.sin(angle45);

    // Create the line
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', '#000');
    line.setAttribute('stroke-width', '3');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('class', 'exit-line');
    group.appendChild(line);

    // Create arrowhead at the end
    const arrowSize = 10;
    const arrowWidth = 6;

    // Direction vector (normalized) - 45 degrees up-right
    const dx = Math.cos(angle45);
    const dy = Math.sin(angle45);

    // Perpendicular vector
    const perpX = -dy;
    const perpY = dx;

    const tipX = x2;
    const tipY = y2;
    const base1X = tipX - dx * arrowSize + perpX * arrowWidth;
    const base1Y = tipY - dy * arrowSize + perpY * arrowWidth;
    const base2X = tipX - dx * arrowSize - perpX * arrowWidth;
    const base2Y = tipY - dy * arrowSize - perpY * arrowWidth;

    const arrowhead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrowhead.setAttribute('points', `${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}`);
    arrowhead.setAttribute('fill', '#000');
    arrowhead.setAttribute('stroke', '#000');
    arrowhead.setAttribute('stroke-width', '1');
    arrowhead.setAttribute('class', 'exit-arrowhead');
    group.appendChild(arrowhead);

    // Add connection point at the start (for line snapping)
    const startPoint = this.createConnectionPoint(x1, y1, exit.id, 'start');
    group.appendChild(startPoint);

    // Add interactivity
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFeature(exit.id);
    });

    // Make draggable
    this.makeExitDraggable(group, exit);

    this.featureLayer.appendChild(group);
  }

  makeExitDraggable(element, exit) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point
      if (e.target.classList.contains('connection-point')) return;

      isDragging = true;
      const rect = this.svg.getBoundingClientRect();
      startX = e.clientX - rect.left - exit.x;
      startY = e.clientY - rect.top - exit.y;
      element.style.cursor = 'grabbing';
      e.stopPropagation();
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const rect = this.svg.getBoundingClientRect();
      let newX = e.clientX - rect.left - startX;
      let newY = e.clientY - rect.top - startY;

      // Snap to grid if enabled
      if (this.snapToGrid) {
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newY = Math.round(newY / this.gridSize) * this.gridSize;
      }

      exit.x = newX;
      exit.y = newY;

      this.updateExit(exit);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
        this.saveState();
      }
    });
  }

  updateExit(exit) {
    const element = this.featureLayer.querySelector(`[data-id="${exit.id}"]`);
    if (!element) return;

    const x1 = exit.x;
    const y1 = exit.y;

    const angle45 = -Math.PI / 4;
    const x2 = x1 + exit.length * Math.cos(angle45);
    const y2 = y1 + exit.length * Math.sin(angle45);

    // Update line
    const line = element.querySelector('.exit-line');
    if (line) {
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
    }

    // Update arrowhead
    const arrowSize = 10;
    const arrowWidth = 6;

    const dx = Math.cos(angle45);
    const dy = Math.sin(angle45);
    const perpX = -dy;
    const perpY = dx;

    const tipX = x2;
    const tipY = y2;
    const base1X = tipX - dx * arrowSize + perpX * arrowWidth;
    const base1Y = tipY - dy * arrowSize + perpY * arrowWidth;
    const base2X = tipX - dx * arrowSize - perpX * arrowWidth;
    const base2Y = tipY - dy * arrowSize - perpY * arrowWidth;

    const arrowhead = element.querySelector('.exit-arrowhead');
    if (arrowhead) {
      arrowhead.setAttribute('points', `${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}`);
    }

    // Update connection point
    const connectionPoint = element.querySelector('.connection-point');
    if (connectionPoint) {
      connectionPoint.setAttribute('cx', x1);
      connectionPoint.setAttribute('cy', y1);
    }
  }

  renderAnchor(anchor) {
    // Create anchor group
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', anchor.id);
    group.setAttribute('data-type', 'anchor');
    group.style.cursor = 'move';

    const size = anchor.size;
    const cx = anchor.x;
    const cy = anchor.y;
    const count = anchor.count || 1;
    const spacing = size + 3; // Horizontal spacing between X marks (size + small gap)
    const visualOffsetX = 10;  // Visual shift right to avoid overlap with connection point
    const visualOffsetY = -10; // Visual shift up to avoid overlap with connection point

    // Create multiple X marks based on count (left-to-right, not centered)
    for (let i = 0; i < count; i++) {
      // Calculate offset for this X mark (left-to-right from anchor.x)
      const offsetX = i * spacing;

      // Create X shape with two diagonal lines (with visual offset applied)
      // Line from top-left to bottom-right
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', cx + offsetX - size / 2 + visualOffsetX);
      line1.setAttribute('y1', cy - size / 2 + visualOffsetY);
      line1.setAttribute('x2', cx + offsetX + size / 2 + visualOffsetX);
      line1.setAttribute('y2', cy + size / 2 + visualOffsetY);
      line1.setAttribute('stroke', '#000');
      line1.setAttribute('stroke-width', '3');
      line1.setAttribute('stroke-linecap', 'round');
      line1.setAttribute('class', 'anchor-line');

      // Line from top-right to bottom-left
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', cx + offsetX + size / 2 + visualOffsetX);
      line2.setAttribute('y1', cy - size / 2 + visualOffsetY);
      line2.setAttribute('x2', cx + offsetX - size / 2 + visualOffsetX);
      line2.setAttribute('y2', cy + size / 2 + visualOffsetY);
      line2.setAttribute('stroke', '#000');
      line2.setAttribute('stroke-width', '3');
      line2.setAttribute('stroke-linecap', 'round');
      line2.setAttribute('class', 'anchor-line');

      group.appendChild(line1);
      group.appendChild(line2);
    }

    // Add connection point at the bottom
    const connectionPoint = this.createConnectionPoint(
      anchor.connectionX,
      anchor.connectionY,
      anchor.id,
      'connection'
    );

    group.appendChild(connectionPoint);

    // Add interactivity
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFeature(anchor.id);
    });

    // Make draggable
    this.makeAnchorDraggable(group, anchor);

    this.featureLayer.appendChild(group);
  }

  makeAnchorDraggable(element, anchor) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point
      if (e.target.classList.contains('connection-point')) return;

      isDragging = true;
      const rect = this.svg.getBoundingClientRect();
      startX = e.clientX - rect.left - anchor.x;
      startY = e.clientY - rect.top - anchor.y;
      element.style.cursor = 'grabbing';
      e.stopPropagation();
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const rect = this.svg.getBoundingClientRect();
      let newX = e.clientX - rect.left - startX;
      let newY = e.clientY - rect.top - startY;

      // Snap to grid if enabled
      if (this.snapToGrid) {
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newY = Math.round(newY / this.gridSize) * this.gridSize;
      }

      // Only move the anchor symbols, keep connection point fixed
      anchor.x = newX;
      anchor.y = newY;
      // connectionX and connectionY remain unchanged

      this.updateAnchor(anchor);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
        this.saveState();
      }
    });
  }

  updateAnchor(anchor) {
    const element = this.featureLayer.querySelector(`[data-id="${anchor.id}"]`);
    if (!element) return;

    const size = anchor.size;
    const cx = anchor.x;
    const cy = anchor.y;
    const count = anchor.count || 1;
    const spacing = size + 3; // Horizontal spacing between X marks (size + small gap)
    const visualOffsetX = 10;  // Visual shift right to avoid overlap with connection point
    const visualOffsetY = -10; // Visual shift up to avoid overlap with connection point

    // Connection point position is stored in anchor.connectionX/Y and doesn't change
    // (it was set when the anchor was created)

    const lines = element.querySelectorAll('.anchor-line');

    // Check if anchor is selected
    const isSelected = this.selectedFeature === anchor.id;
    const strokeColor = isSelected ? '#ff4444' : '#333';
    const strokeWidth = isSelected ? '4' : '3';

    // Remove old lines
    lines.forEach(line => line.remove());

    // Create new X marks based on current count (left-to-right, not centered)
    for (let i = 0; i < count; i++) {
      // Calculate offset for this X mark (left-to-right from anchor.x)
      const offsetX = i * spacing;

      // Create X shape with two diagonal lines (with visual offset applied)
      // Line from top-left to bottom-right
      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', cx + offsetX - size / 2 + visualOffsetX);
      line1.setAttribute('y1', cy - size / 2 + visualOffsetY);
      line1.setAttribute('x2', cx + offsetX + size / 2 + visualOffsetX);
      line1.setAttribute('y2', cy + size / 2 + visualOffsetY);
      line1.setAttribute('stroke', strokeColor);
      line1.setAttribute('stroke-width', strokeWidth);
      line1.setAttribute('stroke-linecap', 'round');
      line1.setAttribute('class', 'anchor-line');

      // Line from top-right to bottom-left
      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', cx + offsetX + size / 2 + visualOffsetX);
      line2.setAttribute('y1', cy - size / 2 + visualOffsetY);
      line2.setAttribute('x2', cx + offsetX - size / 2 + visualOffsetX);
      line2.setAttribute('y2', cy + size / 2 + visualOffsetY);
      line2.setAttribute('stroke', strokeColor);
      line2.setAttribute('stroke-width', strokeWidth);
      line2.setAttribute('stroke-linecap', 'round');
      line2.setAttribute('class', 'anchor-line');

      // Insert before connection point
      const connectionPoint = element.querySelector('.connection-point');
      element.insertBefore(line1, connectionPoint);
      element.insertBefore(line2, connectionPoint);
    }

    // Update connection point
    const connectionPoint = element.querySelector('.connection-point');
    if (connectionPoint) {
      connectionPoint.setAttribute('cx', anchor.connectionX);
      connectionPoint.setAttribute('cy', anchor.connectionY);
    }
  }

  renderPool(pool) {
    // Create pool group
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', pool.id);
    group.setAttribute('data-type', 'pool');
    group.style.cursor = 'move';

    // Create bezier curve semicircle (bottom half)
    // Using cubic bezier to approximate a semicircle
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

    const width = pool.width;
    const depth = pool.depth;
    const cx = pool.x;
    const cy = pool.y;

    // Start point at left (270° = 9 o'clock)
    const startX = cx - width / 2;
    const startY = cy;

    // End point at right (90° = 3 o'clock)
    const endX = cx + width / 2;
    const endY = cy;

    // Control points for bezier curve to create semicircle
    // For a semicircle, the control point distance is approximately 0.552 * radius
    const controlOffset = depth * 0.552;

    const cp1X = startX;
    const cp1Y = cy + controlOffset;

    const cp2X = endX;
    const cp2Y = cy + controlOffset;

    // Create path: M (start) C (cubic bezier) (end)
    const pathData = `M ${startX},${startY} C ${cp1X},${cp1Y} ${cp2X},${cp2Y} ${endX},${endY}`;

    path.setAttribute('d', pathData);
    path.setAttribute('fill', '#4a90e2');
    path.setAttribute('stroke', '#000000');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('class', 'pool-shape');

    group.appendChild(path);

    // Add connection points
    // Left connection point (270° = 9 o'clock)
    const leftPoint = this.createConnectionPoint(
      cx - width / 2,
      cy,
      pool.id,
      'start'
    );

    // Right connection point (90° = 3 o'clock)
    const rightPoint = this.createConnectionPoint(
      cx + width / 2,
      cy,
      pool.id,
      'end'
    );

    group.appendChild(leftPoint);
    group.appendChild(rightPoint);

    // Add interactivity
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFeature(pool.id);
    });

    // Make draggable
    this.makePoolDraggable(group, pool);

    this.featureLayer.appendChild(group);
  }

  makePoolDraggable(element, pool) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point
      if (e.target.classList.contains('connection-point')) return;

      isDragging = true;
      const rect = this.svg.getBoundingClientRect();
      startX = e.clientX - rect.left - pool.x;
      startY = e.clientY - rect.top - pool.y;
      element.style.cursor = 'grabbing';
      e.stopPropagation();
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const rect = this.svg.getBoundingClientRect();
      let newX = e.clientX - rect.left - startX;
      let newY = e.clientY - rect.top - startY;

      // Snap to grid if enabled
      if (this.snapToGrid) {
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newY = Math.round(newY / this.gridSize) * this.gridSize;
      }

      pool.x = newX;
      pool.y = newY;

      this.updatePool(pool);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
        this.saveState();
      }
    });
  }

  updatePool(pool) {
    const element = this.featureLayer.querySelector(`[data-id="${pool.id}"]`);
    if (!element) return;

    const path = element.querySelector('.pool-shape');

    const width = pool.width;
    const depth = pool.depth;
    const cx = pool.x;
    const cy = pool.y;

    const startX = cx - width / 2;
    const startY = cy;
    const endX = cx + width / 2;
    const endY = cy;

    const controlOffset = depth * 0.552;
    const cp1X = startX;
    const cp1Y = cy + controlOffset;
    const cp2X = endX;
    const cp2Y = cy + controlOffset;

    const pathData = `M ${startX},${startY} C ${cp1X},${cp1Y} ${cp2X},${cp2Y} ${endX},${endY}`;
    path.setAttribute('d', pathData);

    // Update connection points
    const points = element.querySelectorAll('.connection-point');
    points.forEach(point => {
      const pointType = point.getAttribute('data-point-type');
      if (pointType === 'start') {
        point.setAttribute('cx', cx - width / 2);
        point.setAttribute('cy', cy);
      } else if (pointType === 'end') {
        point.setAttribute('cx', cx + width / 2);
        point.setAttribute('cy', cy);
      }
    });
  }

  renderRappel(rappel) {
    // Create rappel group
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', rappel.id);
    group.setAttribute('data-type', 'rappel');
    group.style.cursor = 'move';

    const x1 = rappel.x;
    const y1 = rappel.y;
    const length = rappel.length;
    const slope = rappel.slope;

    // Convert slope to radians
    const slopeRadians = (slope * Math.PI) / 180;

    // Calculate end point (connection point)
    const x2 = x1 + length * Math.cos(slopeRadians);
    const y2 = y1 + length * Math.sin(slopeRadians);

    // Calculate perpendicular direction (to the right)
    const perpAngle = slopeRadians + Math.PI / 2;
    const perpX = Math.cos(perpAngle);
    const perpY = Math.sin(perpAngle);

    // Offset amount to the right
    const endpointOffset = -10;  // Offset for start and end points
    const curveOffset = rappel.curveOffset || -15;  // Get from rappel object
    const curvePosition = rappel.curvePosition !== undefined ? rappel.curvePosition : 0.5;  // Position along line (0-1)

    // Calculate actual start and end points (offset from connection points)
    const startX = x1 + perpX * endpointOffset;
    const startY = y1 + perpY * endpointOffset;
    const endX = x2 + perpX * endpointOffset;
    const endY = y2 + perpY * endpointOffset;

    // Calculate control point at the specified position along the line, with perpendicular offset
    const lineX = startX + (endX - startX) * curvePosition;
    const lineY = startY + (endY - startY) * curvePosition;
    const controlX = lineX + perpX * (curveOffset - endpointOffset);
    const controlY = lineY + perpY * (curveOffset - endpointOffset);

    // Create curved path with quadratic bezier
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const pathData = `M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`;
    path.setAttribute('d', pathData);
    path.setAttribute('stroke', '#000');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('fill', 'none');
    path.setAttribute('class', 'rappel-curve');
    group.appendChild(path);

    // Add draggable curve control point (midpoint on the curve)
    const curveMidpoint = this.createCurveMidpoint(controlX, controlY, rappel.id);
    group.appendChild(curveMidpoint);

    // Add arrowhead at the end
    // Calculate direction at the end of the curve (tangent to the curve)
    const dx = endX - controlX;
    const dy = endY - controlY;
    const tangentLength = Math.sqrt(dx * dx + dy * dy);
    const tangentX = dx / tangentLength;
    const tangentY = dy / tangentLength;

    const arrowheadLength = 10;
    const arrowWidth = 6;

    // Arrow tip at actual end point
    const arrowTipX = endX;
    const arrowTipY = endY;

    // Perpendicular to tangent for arrow width
    const arrowPerpX = -tangentY;
    const arrowPerpY = tangentX;

    // Arrow base points
    const base1X = arrowTipX - tangentX * arrowheadLength + arrowPerpX * arrowWidth;
    const base1Y = arrowTipY - tangentY * arrowheadLength + arrowPerpY * arrowWidth;
    const base2X = arrowTipX - tangentX * arrowheadLength - arrowPerpX * arrowWidth;
    const base2Y = arrowTipY - tangentY * arrowheadLength - arrowPerpY * arrowWidth;

    const arrowhead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrowhead.setAttribute('points', `${arrowTipX},${arrowTipY} ${base1X},${base1Y} ${base2X},${base2Y}`);
    arrowhead.setAttribute('fill', '#000');
    arrowhead.setAttribute('stroke', '#000');
    arrowhead.setAttribute('stroke-width', '1');
    arrowhead.setAttribute('class', 'rappel-arrowhead');
    group.appendChild(arrowhead);

    // Add connection points
    const startPoint = this.createConnectionPoint(x1, y1, rappel.id, 'start');
    const endPoint = this.createConnectionPoint(x2, y2, rappel.id, 'end');

    group.appendChild(startPoint);
    group.appendChild(endPoint);

    // Add interactivity
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFeature(rappel.id);
    });

    // Make draggable
    this.makeRappelDraggable(group, rappel);

    this.featureLayer.appendChild(group);
  }

  makeRappelDraggable(element, rappel) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point
      if (e.target.classList.contains('connection-point')) return;

      isDragging = true;
      const rect = this.svg.getBoundingClientRect();
      startX = e.clientX - rect.left - rappel.x;
      startY = e.clientY - rect.top - rappel.y;
      element.style.cursor = 'grabbing';
      e.stopPropagation();
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const rect = this.svg.getBoundingClientRect();
      let newX = e.clientX - rect.left - startX;
      let newY = e.clientY - rect.top - startY;

      // Snap to grid if enabled
      if (this.snapToGrid) {
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newY = Math.round(newY / this.gridSize) * this.gridSize;
      }

      rappel.x = newX;
      rappel.y = newY;

      this.updateRappel(rappel);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
        this.saveState();
      }
    });
  }

  updateRappel(rappel) {
    const element = this.featureLayer.querySelector(`[data-id="${rappel.id}"]`);
    if (!element) return;

    const x1 = rappel.x;
    const y1 = rappel.y;
    const length = rappel.length;
    const slope = rappel.slope;

    // Convert slope to radians
    const slopeRadians = (slope * Math.PI) / 180;

    // Calculate end point (connection point)
    const x2 = x1 + length * Math.cos(slopeRadians);
    const y2 = y1 + length * Math.sin(slopeRadians);

    // Calculate perpendicular direction (to the right)
    const perpAngle = slopeRadians + Math.PI / 2;
    const perpX = Math.cos(perpAngle);
    const perpY = Math.sin(perpAngle);

    // Offset amount to the right
    const endpointOffset = -10;  // Offset for start and end points
    const curveOffset = rappel.curveOffset || -15;  // Get from rappel object
    const curvePosition = rappel.curvePosition !== undefined ? rappel.curvePosition : 0.5;  // Position along line (0-1)

    // Calculate actual start and end points (offset from connection points)
    const startX = x1 + perpX * endpointOffset;
    const startY = y1 + perpY * endpointOffset;
    const endX = x2 + perpX * endpointOffset;
    const endY = y2 + perpY * endpointOffset;

    // Calculate control point at the specified position along the line, with perpendicular offset
    const lineX = startX + (endX - startX) * curvePosition;
    const lineY = startY + (endY - startY) * curvePosition;
    const controlX = lineX + perpX * (curveOffset - endpointOffset);
    const controlY = lineY + perpY * (curveOffset - endpointOffset);

    // Update curved path
    const path = element.querySelector('.rappel-curve');
    if (path) {
      const pathData = `M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`;
      path.setAttribute('d', pathData);
    }

    // Update curve midpoint position
    const curveMidpoint = element.querySelector('.curve-midpoint');
    if (curveMidpoint) {
      curveMidpoint.setAttribute('cx', controlX);
      curveMidpoint.setAttribute('cy', controlY);
    }

    // Calculate direction at the end of the curve (tangent)
    const dx = endX - controlX;
    const dy = endY - controlY;
    const tangentLength = Math.sqrt(dx * dx + dy * dy);
    const tangentX = dx / tangentLength;
    const tangentY = dy / tangentLength;

    const arrowheadLength = 10;
    const arrowWidth = 6;

    // Arrow tip at actual end point
    const arrowTipX = endX;
    const arrowTipY = endY;

    // Perpendicular to tangent for arrow width
    const arrowPerpX = -tangentY;
    const arrowPerpY = tangentX;

    // Arrow base points
    const base1X = arrowTipX - tangentX * arrowheadLength + arrowPerpX * arrowWidth;
    const base1Y = arrowTipY - tangentY * arrowheadLength + arrowPerpY * arrowWidth;
    const base2X = arrowTipX - tangentX * arrowheadLength - arrowPerpX * arrowWidth;
    const base2Y = arrowTipY - tangentY * arrowheadLength - arrowPerpY * arrowWidth;

    // Update arrowhead
    const arrowhead = element.querySelector('.rappel-arrowhead');
    if (arrowhead) {
      arrowhead.setAttribute('points', `${arrowTipX},${arrowTipY} ${base1X},${base1Y} ${base2X},${base2Y}`);
    }

    // Update connection points
    const points = element.querySelectorAll('.connection-point');
    points.forEach(point => {
      const pointType = point.getAttribute('data-point-type');
      if (pointType === 'start') {
        point.setAttribute('cx', x1);
        point.setAttribute('cy', y1);
      } else if (pointType === 'end') {
        point.setAttribute('cx', x2);
        point.setAttribute('cy', y2);
      }
    });
  }

  renderHazard(hazard) {
    // Create hazard group
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', hazard.id);
    group.setAttribute('data-type', 'hazard');
    group.style.cursor = 'move';

    const cx = hazard.x;
    const cy = hazard.y;
    const size = hazard.size;

    // Create equilateral triangle pointing up
    // Top point
    const topX = cx;
    const topY = cy - (size * Math.sqrt(3) / 3);

    // Bottom left point
    const leftX = cx - size / 2;
    const leftY = cy + (size * Math.sqrt(3) / 6);

    // Bottom right point
    const rightX = cx + size / 2;
    const rightY = cy + (size * Math.sqrt(3) / 6);

    // Create triangle
    const triangle = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    triangle.setAttribute('points', `${topX},${topY} ${leftX},${leftY} ${rightX},${rightY}`);
    triangle.setAttribute('fill', '#FFD700');  // Gold/yellow warning color
    triangle.setAttribute('stroke', '#000');
    triangle.setAttribute('stroke-width', '3');
    triangle.setAttribute('class', 'hazard-triangle');
    group.appendChild(triangle);

    // Add text in the center of the triangle
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', cx);
    text.setAttribute('y', cy + 5);  // Slight offset for better centering
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('font-family', 'Arial, sans-serif');
    text.setAttribute('font-size', size * 0.6);
    text.setAttribute('font-weight', 'bold');
    text.setAttribute('fill', '#333');
    text.setAttribute('class', 'hazard-text');
    text.textContent = hazard.text;
    group.appendChild(text);

    // Add interactivity
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFeature(hazard.id);
    });

    // Make draggable
    this.makeHazardDraggable(group, hazard);

    this.featureLayer.appendChild(group);
  }

  makeHazardDraggable(element, hazard) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click

      isDragging = true;
      const rect = this.svg.getBoundingClientRect();
      startX = e.clientX - rect.left - hazard.x;
      startY = e.clientY - rect.top - hazard.y;
      element.style.cursor = 'grabbing';
      e.stopPropagation();
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const rect = this.svg.getBoundingClientRect();
      let newX = e.clientX - rect.left - startX;
      let newY = e.clientY - rect.top - startY;

      // Snap to grid if enabled
      if (this.snapToGrid) {
        newX = Math.round(newX / this.gridSize) * this.gridSize;
        newY = Math.round(newY / this.gridSize) * this.gridSize;
      }

      hazard.x = newX;
      hazard.y = newY;

      this.updateHazard(hazard);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
        this.saveState();
      }
    });
  }

  updateHazard(hazard) {
    const element = this.featureLayer.querySelector(`[data-id="${hazard.id}"]`);
    if (!element) return;

    const cx = hazard.x;
    const cy = hazard.y;
    const size = hazard.size;

    // Calculate triangle points
    const topX = cx;
    const topY = cy - (size * Math.sqrt(3) / 3);
    const leftX = cx - size / 2;
    const leftY = cy + (size * Math.sqrt(3) / 6);
    const rightX = cx + size / 2;
    const rightY = cy + (size * Math.sqrt(3) / 6);

    // Update triangle
    const triangle = element.querySelector('.hazard-triangle');
    if (triangle) {
      triangle.setAttribute('points', `${topX},${topY} ${leftX},${leftY} ${rightX},${rightY}`);
    }

    // Update text
    const text = element.querySelector('.hazard-text');
    if (text) {
      text.setAttribute('x', cx);
      text.setAttribute('y', cy + 5);
      text.setAttribute('font-size', size * 0.6);
      text.textContent = hazard.text;
    }
  }

  startLine(x, y) {
    this.drawingLine = true;

    // Store connection info if snapped to a connection point
    let connectedTo = null;
    let connectionPoint = null;

    if (this.hoveredConnectionPoint) {
      connectedTo = parseInt(this.hoveredConnectionPoint.featureId);
      connectionPoint = this.hoveredConnectionPoint.pointType;
    }

    this.lineStartPoint = {
      x,
      y,
      connectedTo,
      connectionPoint
    };

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

    // Check if end point is connected to something
    let endConnectedTo = null;
    let endConnectionPoint = null;

    if (this.hoveredConnectionPoint) {
      endConnectedTo = parseInt(this.hoveredConnectionPoint.featureId);
      endConnectionPoint = this.hoveredConnectionPoint.pointType;
    }

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
      arrow: false,
      // Connection information
      startConnectedTo: this.lineStartPoint.connectedTo,
      startConnectionPoint: this.lineStartPoint.connectionPoint,
      endConnectedTo: endConnectedTo,
      endConnectionPoint: endConnectionPoint
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
            line.setAttribute('stroke-width', '3');
          });
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
            line.setAttribute('stroke-width', '4');
          });
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
  }

  updatePropertiesPanel(feature) {
    const panel = document.getElementById('properties-panel');
    if (!panel) return;

    if (!feature) {
      panel.innerHTML = '<p class="empty-state">Select a feature to edit properties</p>';
      return;
    }

    if (feature.type === 'anchor') {
      panel.innerHTML = `
        <h3>Anchor</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label for="anchor-type" style="display: block; margin-bottom: 4px; font-weight: 500;">Type:</label>
            <select id="anchor-type" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
              <option value="bolt" ${feature.anchorType === 'bolt' ? 'selected' : ''}>Bolt</option>
              <option value="natural" ${feature.anchorType === 'natural' ? 'selected' : ''}>Natural</option>
              <option value="piton" ${feature.anchorType === 'piton' ? 'selected' : ''}>Piton</option>
              <option value="tree" ${feature.anchorType === 'tree' ? 'selected' : ''}>Tree</option>
              <option value="rock" ${feature.anchorType === 'rock' ? 'selected' : ''}>Rock</option>
            </select>
          </div>
          <div>
            <label for="anchor-count" style="display: block; margin-bottom: 4px; font-weight: 500;">Count:</label>
            <input type="number" id="anchor-count" value="${feature.count}" min="1" max="10"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <div>
            <label for="anchor-name" style="display: block; margin-bottom: 4px; font-weight: 500;">Name:</label>
            <input type="text" id="anchor-name" value="${feature.name}" placeholder="Optional label"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <button id="delete-anchor" style="background-color: #e74c3c; margin-top: 8px;">Delete Anchor</button>
        </div>
      `;

      // Add event listeners
      const typeSelect = document.getElementById('anchor-type');
      const countInput = document.getElementById('anchor-count');
      const nameInput = document.getElementById('anchor-name');
      const deleteBtn = document.getElementById('delete-anchor');

      typeSelect.addEventListener('change', (e) => {
        feature.anchorType = e.target.value;
        this.saveState();
        console.log('Updated anchor type:', feature.anchorType);
      });

      countInput.addEventListener('input', (e) => {
        feature.count = parseInt(e.target.value) || 1;
        this.updateAnchor(feature);
        this.saveState();
        console.log('Updated anchor count:', feature.count);
      });

      nameInput.addEventListener('input', (e) => {
        feature.name = e.target.value;
        console.log('Updated anchor name:', feature.name);
      });

      nameInput.addEventListener('blur', (e) => {
        // Save state when user finishes editing name
        this.saveState();
      });

      deleteBtn.addEventListener('click', () => {
        this.deleteFeature(feature.id);
      });
    } else if (feature.type === 'line') {
      panel.innerHTML = `
        <h3>Line</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="line-shorten" ${feature.shorten ? 'checked' : ''}
                   style="width: 18px; height: 18px; cursor: pointer;">
            <label for="line-shorten" style="cursor: pointer; font-weight: 500;">Shorten</label>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="line-traverse" ${feature.traverse ? 'checked' : ''}
                   style="width: 18px; height: 18px; cursor: pointer;">
            <label for="line-traverse" style="cursor: pointer; font-weight: 500;">Traverse</label>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <input type="checkbox" id="line-arrow" ${feature.arrow ? 'checked' : ''}
                   style="width: 18px; height: 18px; cursor: pointer;">
            <label for="line-arrow" style="cursor: pointer; font-weight: 500;">Arrow</label>
          </div>
          <button id="delete-line" style="background-color: #e74c3c; margin-top: 8px;">Delete Line</button>
        </div>
      `;

      // Add event listeners
      const shortenCheckbox = document.getElementById('line-shorten');
      const traverseCheckbox = document.getElementById('line-traverse');
      const arrowCheckbox = document.getElementById('line-arrow');
      const deleteBtn = document.getElementById('delete-line');

      shortenCheckbox.addEventListener('change', (e) => {
        feature.shorten = e.target.checked;
        this.updateLine(feature);
        this.saveState();
        console.log('Updated line shorten:', feature.shorten);
      });

      traverseCheckbox.addEventListener('change', (e) => {
        feature.traverse = e.target.checked;
        this.updateLine(feature);
        this.saveState();
        console.log('Updated line traverse:', feature.traverse);
      });

      arrowCheckbox.addEventListener('change', (e) => {
        feature.arrow = e.target.checked;
        this.updateLine(feature);
        this.saveState();
        console.log('Updated line arrow:', feature.arrow);
      });

      deleteBtn.addEventListener('click', () => {
        this.deleteFeature(feature.id);
      });
    } else if (feature.type === 'pool') {
      panel.innerHTML = `
        <h3>Pool</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label for="pool-width" style="display: block; margin-bottom: 4px; font-weight: 500;">Width:</label>
            <input type="number" id="pool-width" value="${feature.width}" min="10" max="200"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <div>
            <label for="pool-depth" style="display: block; margin-bottom: 4px; font-weight: 500;">Depth:</label>
            <input type="number" id="pool-depth" value="${feature.depth}" min="10" max="100"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <button id="delete-pool" style="background-color: #e74c3c; margin-top: 8px;">Delete Pool</button>
        </div>
      `;

      // Add event listeners
      const widthInput = document.getElementById('pool-width');
      const depthInput = document.getElementById('pool-depth');
      const deleteBtn = document.getElementById('delete-pool');

      widthInput.addEventListener('input', (e) => {
        feature.width = parseInt(e.target.value) || 50;
        this.updatePool(feature);
        this.saveState();
        console.log('Updated pool width:', feature.width);
      });

      depthInput.addEventListener('input', (e) => {
        feature.depth = parseInt(e.target.value) || 30;
        this.updatePool(feature);
        this.saveState();
        console.log('Updated pool depth:', feature.depth);
      });

      deleteBtn.addEventListener('click', () => {
        this.deleteFeature(feature.id);
      });
    } else if (feature.type === 'rappel') {
      panel.innerHTML = `
        <h3>Rappel</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label for="rappel-length" style="display: block; margin-bottom: 4px; font-weight: 500;">Length:</label>
            <input type="number" id="rappel-length" value="${feature.length}" min="10" max="500"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <div>
            <label for="rappel-slope" style="display: block; margin-bottom: 4px; font-weight: 500;">Slope (degrees):</label>
            <input type="number" id="rappel-slope" value="${feature.slope}" min="0" max="360"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <button id="delete-rappel" style="background-color: #e74c3c; margin-top: 8px;">Delete Rappel</button>
        </div>
      `;

      // Add event listeners
      const lengthInput = document.getElementById('rappel-length');
      const slopeInput = document.getElementById('rappel-slope');
      const deleteBtn = document.getElementById('delete-rappel');

      lengthInput.addEventListener('input', (e) => {
        feature.length = parseInt(e.target.value) || 100;
        this.updateRappel(feature);
        this.saveState();
        console.log('Updated rappel length:', feature.length);
      });

      slopeInput.addEventListener('input', (e) => {
        feature.slope = parseInt(e.target.value) || 90;
        this.updateRappel(feature);
        this.saveState();
        console.log('Updated rappel slope:', feature.slope);
      });

      deleteBtn.addEventListener('click', () => {
        this.deleteFeature(feature.id);
      });
    } else if (feature.type === 'hazard') {
      panel.innerHTML = `
        <h3>Hazard</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label for="hazard-text" style="display: block; margin-bottom: 4px; font-weight: 500;">Text:</label>
            <input type="text" id="hazard-text" value="${feature.text}" maxlength="20"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <div>
            <label for="hazard-size" style="display: block; margin-bottom: 4px; font-weight: 500;">Size:</label>
            <input type="number" id="hazard-size" value="${feature.size}" min="15" max="60"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <button id="delete-hazard" style="background-color: #e74c3c; margin-top: 8px;">Delete Hazard</button>
        </div>
      `;

      // Add event listeners
      const textInput = document.getElementById('hazard-text');
      const sizeInput = document.getElementById('hazard-size');
      const deleteBtn = document.getElementById('delete-hazard');

      textInput.addEventListener('input', (e) => {
        feature.text = e.target.value;
        this.updateHazard(feature);
        console.log('Updated hazard text:', feature.text);
      });

      textInput.addEventListener('blur', (e) => {
        // Save state when user finishes editing text
        this.saveState();
      });

      sizeInput.addEventListener('input', (e) => {
        feature.size = parseInt(e.target.value) || 30;
        this.updateHazard(feature);
        this.saveState();
        console.log('Updated hazard size:', feature.size);
      });

      deleteBtn.addEventListener('click', () => {
        this.deleteFeature(feature.id);
      });
    } else if (feature.type === 'exit') {
      panel.innerHTML = `
        <h3>Exit</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label for="exit-length" style="display: block; margin-bottom: 4px; font-weight: 500;">Length:</label>
            <input type="number" id="exit-length" value="${feature.length}" min="20" max="200"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <button id="delete-exit" style="background-color: #e74c3c; margin-top: 8px;">Delete Exit</button>
        </div>
      `;

      // Add event listeners
      const lengthInput = document.getElementById('exit-length');
      const deleteBtn = document.getElementById('delete-exit');

      lengthInput.addEventListener('input', (e) => {
        feature.length = parseInt(e.target.value) || 60;
        this.updateExit(feature);
        this.saveState();
        console.log('Updated exit length:', feature.length);
      });

      deleteBtn.addEventListener('click', () => {
        this.deleteFeature(feature.id);
      });
    } else {
      // Other feature types can be added later
      panel.innerHTML = `
        <h3>${feature.type.charAt(0).toUpperCase() + feature.type.slice(1)}</h3>
        <p style="color: #666; font-size: 14px;">Properties for this feature type are not yet implemented.</p>
      `;
    }
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

  renderLine(line) {
    // Create line group
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', line.id);
    group.setAttribute('data-type', 'line');
    group.style.cursor = 'move';

    const x1 = line.x1;
    const y1 = line.y1;
    const x2 = line.x2;
    const y2 = line.y2;

    // Always render the base straight line
    const lineElem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    lineElem.setAttribute('x1', x1);
    lineElem.setAttribute('y1', y1);
    lineElem.setAttribute('x2', x2);
    lineElem.setAttribute('y2', y2);
    lineElem.setAttribute('stroke', '#000');
    lineElem.setAttribute('stroke-width', '3');
    lineElem.setAttribute('stroke-linecap', 'round');
    lineElem.setAttribute('class', 'line-shape');
    group.appendChild(lineElem);

    // Add traverse curve on top if enabled
    if (line.traverse) {
      const traverseHeight = 10;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const dip = midY - traverseHeight / 2;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const pathData = `M ${x1},${y1 - traverseHeight} Q ${midX},${dip} ${x2},${y2 - traverseHeight}`;
      path.setAttribute('d', pathData);
      path.setAttribute('stroke', '#000');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('class', 'traverse-path');

      group.appendChild(path);
    }

    // Add shorten slashes if enabled
    if (line.shorten) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      // Calculate perpendicular direction
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      // Perpendicular unit vector
      const perpX = -dy / length;
      const perpY = dx / length;

      const slashLength = 8;
      const slashSpacing = 4;

      // First slash
      const slash1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      slash1.setAttribute('x1', midX - slashSpacing - perpX * slashLength);
      slash1.setAttribute('y1', midY - slashSpacing - perpY * slashLength);
      slash1.setAttribute('x2', midX - slashSpacing + perpX * slashLength);
      slash1.setAttribute('y2', midY - slashSpacing + perpY * slashLength);
      slash1.setAttribute('stroke', '#000');
      slash1.setAttribute('stroke-width', '3');
      slash1.setAttribute('stroke-linecap', 'round');
      slash1.setAttribute('class', 'shorten-slash');

      // Second slash
      const slash2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      slash2.setAttribute('x1', midX + slashSpacing - perpX * slashLength);
      slash2.setAttribute('y1', midY + slashSpacing - perpY * slashLength);
      slash2.setAttribute('x2', midX + slashSpacing + perpX * slashLength);
      slash2.setAttribute('y2', midY + slashSpacing + perpY * slashLength);
      slash2.setAttribute('stroke', '#000');
      slash2.setAttribute('stroke-width', '3');
      slash2.setAttribute('stroke-linecap', 'round');
      slash2.setAttribute('class', 'shorten-slash');

      group.appendChild(slash1);
      group.appendChild(slash2);
    }

    // Add arrowhead if enabled
    if (line.arrow) {
      // Calculate direction vector
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      // Unit vector in direction of line
      const ux = dx / length;
      const uy = dy / length;

      // Perpendicular unit vector
      const perpX = -uy;
      const perpY = ux;

      const arrowSize = 10;
      const arrowWidth = 6;

      // Arrowhead tip at the end point
      const tipX = x2;
      const tipY = y2;

      // Two base points of the arrow triangle
      const base1X = tipX - ux * arrowSize + perpX * arrowWidth;
      const base1Y = tipY - uy * arrowSize + perpY * arrowWidth;
      const base2X = tipX - ux * arrowSize - perpX * arrowWidth;
      const base2Y = tipY - uy * arrowSize - perpY * arrowWidth;

      // Create arrow polygon
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      arrow.setAttribute('points', `${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}`);
      arrow.setAttribute('fill', '#000');
      arrow.setAttribute('stroke', '#000');
      arrow.setAttribute('stroke-width', '1');
      arrow.setAttribute('class', 'arrow-head');

      group.appendChild(arrow);
    }

    // Add connection points (endpoints)
    const startPoint = this.createConnectionPoint(line.x1, line.y1, line.id, 'start');
    const endPoint = this.createConnectionPoint(line.x2, line.y2, line.id, 'end');

    group.appendChild(startPoint);
    group.appendChild(endPoint);

    // Add midpoint for splitting
    const midX = (line.x1 + line.x2) / 2;
    const midY = (line.y1 + line.y2) / 2;
    const midPoint = this.createMidpoint(midX, midY, line.id);
    group.appendChild(midPoint);

    // Add interactivity
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFeature(line.id);
    });

    // Make draggable (moves the whole line)
    this.makeLineDraggable(group, line);

    this.featureLayer.appendChild(group);
  }

  createConnectionPoint(x, y, featureId, pointType) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '4');
    circle.setAttribute('fill', '#52ab98');
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('class', 'connection-point');
    circle.setAttribute('data-feature-id', featureId);
    circle.setAttribute('data-point-type', pointType);
    circle.style.cursor = 'grab';

    // Make connection point draggable
    this.makeConnectionPointDraggable(circle, featureId, pointType);

    return circle;
  }

  createMidpoint(x, y, featureId) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', '#9b59b6');  // Purple color to distinguish from connection points
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('opacity', '0.4');  // Fainter appearance
    circle.setAttribute('class', 'midpoint');
    circle.setAttribute('data-feature-id', featureId);
    circle.style.cursor = 'move';

    // Make midpoint draggable (splits line)
    this.makeMidpointDraggable(circle, featureId);

    return circle;
  }

  createCurveMidpoint(x, y, featureId) {
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', x);
    circle.setAttribute('cy', y);
    circle.setAttribute('r', '5');
    circle.setAttribute('fill', '#e67e22');  // Orange color for curve control
    circle.setAttribute('stroke', 'white');
    circle.setAttribute('stroke-width', '2');
    circle.setAttribute('opacity', '0.6');
    circle.setAttribute('class', 'curve-midpoint');
    circle.setAttribute('data-feature-id', featureId);
    circle.style.cursor = 'move';

    // Make curve midpoint draggable (adjusts curve offset)
    this.makeCurveMidpointDraggable(circle, featureId);

    return circle;
  }

  makeCurveMidpointDraggable(circle, featureId) {
    let isDragging = false;

    circle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      e.stopPropagation();
      isDragging = true;
      circle.style.cursor = 'grabbing';
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const rappel = this.features.find(f => f.id === featureId);
      if (!rappel || rappel.type !== 'rappel') return;

      const rect = this.svg.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Calculate direction vectors
      const slopeRadians = (rappel.slope * Math.PI) / 180;
      const lineX = Math.cos(slopeRadians);
      const lineY = Math.sin(slopeRadians);
      const perpX = Math.cos(slopeRadians + Math.PI / 2);
      const perpY = Math.sin(slopeRadians + Math.PI / 2);

      // Calculate connection points
      const x1 = rappel.x;
      const y1 = rappel.y;
      const x2 = x1 + rappel.length * lineX;
      const y2 = y1 + rappel.length * lineY;

      // Calculate actual start/end with endpoint offset
      const endpointOffset = -10;
      const startX = x1 + perpX * endpointOffset;
      const startY = y1 + perpY * endpointOffset;
      const endX = x2 + perpX * endpointOffset;
      const endY = y2 + perpY * endpointOffset;

      // Vector from start to mouse
      const toMouseX = mouseX - startX;
      const toMouseY = mouseY - startY;

      // Vector from start to end
      const lineVecX = endX - startX;
      const lineVecY = endY - startY;
      const lineLength = Math.sqrt(lineVecX * lineVecX + lineVecY * lineVecY);

      // Project mouse position onto the line to get position (0-1)
      const dotProduct = (toMouseX * lineVecX + toMouseY * lineVecY) / (lineLength * lineLength);
      const position = Math.max(0, Math.min(1, dotProduct));  // Clamp to 0-1

      // Calculate perpendicular offset from the line
      const pointOnLineX = startX + lineVecX * position;
      const pointOnLineY = startY + lineVecY * position;
      const offsetX = mouseX - pointOnLineX;
      const offsetY = mouseY - pointOnLineY;
      const offset = (offsetX * perpX + offsetY * perpY) + endpointOffset;

      // Update both properties
      rappel.curvePosition = position;
      rappel.curveOffset = offset;

      // Update the rappel visualization
      this.updateRappel(rappel);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        circle.style.cursor = 'move';
        this.saveState();
      }
    });
  }

  makeMidpointDraggable(circle, featureId) {
    let isDragging = false;
    let dragStartX, dragStartY;
    let previewLine1, previewLine2;

    circle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      e.stopPropagation();
      isDragging = true;

      const rect = this.svg.getBoundingClientRect();
      dragStartX = e.clientX - rect.left;
      dragStartY = e.clientY - rect.top;

      circle.style.cursor = 'grabbing';
      circle.setAttribute('r', '7'); // Make it bigger while dragging

      // Create preview lines
      const line = this.features.find(f => f.id === featureId);
      if (line) {
        const element = this.featureLayer.querySelector(`[data-id="${featureId}"]`);
        const lineElem = element.querySelector('line');
        lineElem.style.display = 'none'; // Hide original line

        // Create two preview line segments
        previewLine1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        previewLine1.setAttribute('x1', line.x1);
        previewLine1.setAttribute('y1', line.y1);
        previewLine1.setAttribute('x2', dragStartX);
        previewLine1.setAttribute('y2', dragStartY);
        previewLine1.setAttribute('stroke', '#52ab98');
        previewLine1.setAttribute('stroke-width', '3');
        previewLine1.setAttribute('stroke-dasharray', '5,5');
        previewLine1.setAttribute('stroke-linecap', 'round');
        previewLine1.setAttribute('opacity', '0.7');

        previewLine2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        previewLine2.setAttribute('x1', dragStartX);
        previewLine2.setAttribute('y1', dragStartY);
        previewLine2.setAttribute('x2', line.x2);
        previewLine2.setAttribute('y2', line.y2);
        previewLine2.setAttribute('stroke', '#52ab98');
        previewLine2.setAttribute('stroke-width', '3');
        previewLine2.setAttribute('stroke-dasharray', '5,5');
        previewLine2.setAttribute('stroke-linecap', 'round');
        previewLine2.setAttribute('opacity', '0.7');

        this.featureLayer.appendChild(previewLine1);
        this.featureLayer.appendChild(previewLine2);
      }
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const rect = this.svg.getBoundingClientRect();
      let x = e.clientX - rect.left;
      let y = e.clientY - rect.top;

      // Snap to grid if enabled
      if (this.snapToGrid) {
        x = Math.round(x / this.gridSize) * this.gridSize;
        y = Math.round(y / this.gridSize) * this.gridSize;
      }

      // Update preview lines
      if (previewLine1) {
        previewLine1.setAttribute('x2', x);
        previewLine1.setAttribute('y2', y);
      }
      if (previewLine2) {
        previewLine2.setAttribute('x1', x);
        previewLine2.setAttribute('y1', y);
      }

      // Update midpoint circle position
      circle.setAttribute('cx', x);
      circle.setAttribute('cy', y);
    });

    document.addEventListener('mouseup', (e) => {
      if (isDragging) {
        isDragging = false;
        circle.style.cursor = 'move';
        circle.setAttribute('r', '5'); // Back to normal size

        const rect = this.svg.getBoundingClientRect();
        let x = e.clientX - rect.left;
        let y = e.clientY - rect.top;

        // Snap to grid if enabled
        if (this.snapToGrid) {
          x = Math.round(x / this.gridSize) * this.gridSize;
          y = Math.round(y / this.gridSize) * this.gridSize;
        }

        // Remove preview lines
        if (previewLine1) previewLine1.remove();
        if (previewLine2) previewLine2.remove();

        // Get original line
        const originalLine = this.features.find(f => f.id === featureId);
        if (!originalLine) return;

        // Create first line (from start to midpoint)
        const dx1 = x - originalLine.x1;
        const dy1 = y - originalLine.y1;
        const line1 = {
          id: this.nextId++,
          type: 'line',
          x1: originalLine.x1,
          y1: originalLine.y1,
          x2: x,
          y2: y,
          length: Math.round(Math.sqrt(dx1 * dx1 + dy1 * dy1)),
          slope: Math.round(Math.atan2(dy1, dx1) * 180 / Math.PI),
          shorten: false,
          traverse: false,
          arrow: false
        };

        // Create second line (from midpoint to end)
        const dx2 = originalLine.x2 - x;
        const dy2 = originalLine.y2 - y;
        const line2 = {
          id: this.nextId++,
          type: 'line',
          x1: x,
          y1: y,
          x2: originalLine.x2,
          y2: originalLine.y2,
          length: Math.round(Math.sqrt(dx2 * dx2 + dy2 * dy2)),
          slope: Math.round(Math.atan2(dy2, dx2) * 180 / Math.PI),
          shorten: false,
          traverse: false,
          arrow: false
        };

        // Remove original line
        const index = this.features.findIndex(f => f.id === featureId);
        if (index !== -1) {
          this.features.splice(index, 1);
        }

        // Add new lines
        this.features.push(line1);
        this.features.push(line2);

        // Re-render everything (this will add midpoints to the new lines)
        this.render();

        this.saveState();
        console.log('Split line into two:', line1, line2);
      }
    });
  }

  makeConnectionPointDraggable(circle, featureId, pointType) {
    let isDragging = false;
    let connectedPoints = []; // Store all connection points at this location

    circle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      e.stopPropagation();
      isDragging = true;
      circle.style.cursor = 'grabbing';
      circle.setAttribute('r', '6'); // Make it bigger while dragging

      // Find all connection points at this exact location
      const cx = parseFloat(circle.getAttribute('cx'));
      const cy = parseFloat(circle.getAttribute('cy'));

      connectedPoints = [];

      // Find all features that have a point at this location
      this.features.forEach(feature => {
        if (feature.type === 'line') {
          if (feature.x1 === cx && feature.y1 === cy) {
            connectedPoints.push({ featureId: feature.id, pointType: 'start' });
          }
          if (feature.x2 === cx && feature.y2 === cy) {
            connectedPoints.push({ featureId: feature.id, pointType: 'end' });
          }
        } else if (feature.type === 'pool') {
          const leftX = feature.x - feature.width / 2;
          const rightX = feature.x + feature.width / 2;
          if (leftX === cx && feature.y === cy) {
            connectedPoints.push({ featureId: feature.id, pointType: 'start' });
          }
          if (rightX === cx && feature.y === cy) {
            connectedPoints.push({ featureId: feature.id, pointType: 'end' });
          }
        } else if (feature.type === 'anchor') {
          if (feature.connectionX === cx && feature.connectionY === cy) {
            connectedPoints.push({ featureId: feature.id, pointType: 'connection' });
          }
        } else if (feature.type === 'rappel') {
          // Calculate rappel endpoints
          const slopeRadians = (feature.slope * Math.PI) / 180;
          const x2 = feature.x + feature.length * Math.cos(slopeRadians);
          const y2 = feature.y + feature.length * Math.sin(slopeRadians);

          if (feature.x === cx && feature.y === cy) {
            connectedPoints.push({ featureId: feature.id, pointType: 'start' });
          }
          if (Math.abs(x2 - cx) < 0.1 && Math.abs(y2 - cy) < 0.1) {
            connectedPoints.push({ featureId: feature.id, pointType: 'end' });
          }
        }
      });

      console.log('Found connection points at this location:', connectedPoints);
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const rect = this.svg.getBoundingClientRect();
      let x = e.clientX - rect.left;
      let y = e.clientY - rect.top;

      // Snap to grid if enabled
      if (this.snapToGrid) {
        x = Math.round(x / this.gridSize) * this.gridSize;
        y = Math.round(y / this.gridSize) * this.gridSize;
      }

      // Update ALL connection points that were at this location
      connectedPoints.forEach(point => {
        const feature = this.features.find(f => f.id === point.featureId);
        if (feature) {
          if (feature.type === 'line') {
            if (point.pointType === 'start') {
              feature.x1 = x;
              feature.y1 = y;
            } else if (point.pointType === 'end') {
              feature.x2 = x;
              feature.y2 = y;
            }

            // Recalculate length and slope
            const dx = feature.x2 - feature.x1;
            const dy = feature.y2 - feature.y1;
            feature.length = Math.round(Math.sqrt(dx * dx + dy * dy));
            feature.slope = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);

            // Update visual
            this.updateLine(feature);
          } else if (feature.type === 'pool') {
            // For pools, we need to move the entire pool
            // Calculate offset from pool center
            const offsetX = x - (point.pointType === 'start' ?
              (feature.x - feature.width / 2) :
              (feature.x + feature.width / 2));
            const offsetY = y - feature.y;

            feature.x += offsetX;
            feature.y += offsetY;

            // Update visual
            this.updatePool(feature);
          } else if (feature.type === 'anchor') {
            // For anchors, move the entire anchor
            const offsetX = x - feature.connectionX;
            const offsetY = y - feature.connectionY;

            feature.x += offsetX;
            feature.y += offsetY;
            feature.connectionX = x;
            feature.connectionY = y;

            // Update visual
            this.updateAnchor(feature);
          } else if (feature.type === 'rappel') {
            // For rappels, update start or calculate new length/slope
            if (point.pointType === 'start') {
              feature.x = x;
              feature.y = y;
            } else if (point.pointType === 'end') {
              // Recalculate length and slope based on new end point
              const dx = x - feature.x;
              const dy = y - feature.y;
              feature.length = Math.round(Math.sqrt(dx * dx + dy * dy));
              feature.slope = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
            }

            // Update visual
            this.updateRappel(feature);
          }
        }
      });
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        circle.style.cursor = 'grab';
        circle.setAttribute('r', '4'); // Back to normal size
        this.saveState();
      }
    });
  }

  makeLineDraggable(element, line) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point or midpoint
      if (e.target.classList.contains('connection-point') || e.target.classList.contains('midpoint')) return;

      isDragging = true;
      const rect = this.svg.getBoundingClientRect();
      startX = e.clientX - rect.left;
      startY = e.clientY - rect.top;
      element.style.cursor = 'grabbing';
      e.stopPropagation();
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const rect = this.svg.getBoundingClientRect();
      let newX = e.clientX - rect.left;
      let newY = e.clientY - rect.top;

      const dx = newX - startX;
      const dy = newY - startY;

      let newX1 = line.x1 + dx;
      let newY1 = line.y1 + dy;
      let newX2 = line.x2 + dx;
      let newY2 = line.y2 + dy;

      // Snap to grid if enabled
      if (this.snapToGrid) {
        newX1 = Math.round(newX1 / this.gridSize) * this.gridSize;
        newY1 = Math.round(newY1 / this.gridSize) * this.gridSize;
        newX2 = Math.round(newX2 / this.gridSize) * this.gridSize;
        newY2 = Math.round(newY2 / this.gridSize) * this.gridSize;
      }

      line.x1 = newX1;
      line.y1 = newY1;
      line.x2 = newX2;
      line.y2 = newY2;

      startX = newX;
      startY = newY;

      this.updateLine(line);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
        this.saveState();
      }
    });
  }

  updateLine(line) {
    const element = this.featureLayer.querySelector(`[data-id="${line.id}"]`);
    if (!element) return;

    const x1 = line.x1;
    const y1 = line.y1;
    const x2 = line.x2;
    const y2 = line.y2;

    // Update the base straight line
    const lineElem = element.querySelector('.line-shape');
    if (lineElem) {
      lineElem.setAttribute('x1', x1);
      lineElem.setAttribute('y1', y1);
      lineElem.setAttribute('x2', x2);
      lineElem.setAttribute('y2', y2);
    }

    // Remove old traverse path if exists
    const oldTraverse = element.querySelector('.traverse-path');
    if (oldTraverse) {
      oldTraverse.remove();
    }

    // Add traverse curve on top if enabled
    if (line.traverse) {
      const traverseHeight = 10;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const dip = midY - traverseHeight / 2;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      const pathData = `M ${x1},${y1 - traverseHeight} Q ${midX},${dip} ${x2},${y2 - traverseHeight}`;
      path.setAttribute('d', pathData);
      path.setAttribute('stroke', '#000');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('class', 'traverse-path');

      // Insert after line-shape
      const baseLineElem = element.querySelector('.line-shape');
      if (baseLineElem && baseLineElem.nextSibling) {
        element.insertBefore(path, baseLineElem.nextSibling);
      } else {
        element.appendChild(path);
      }
    }

    // Remove old shorten slashes if exist
    const oldSlashes = element.querySelectorAll('.shorten-slash');
    oldSlashes.forEach(slash => slash.remove());

    // Add shorten slashes if enabled
    if (line.shorten) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      // Calculate perpendicular direction
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      // Perpendicular unit vector
      const perpX = -dy / length;
      const perpY = dx / length;

      const slashLength = 8;
      const slashSpacing = 4;

      // First slash
      const slash1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      slash1.setAttribute('x1', midX - slashSpacing - perpX * slashLength);
      slash1.setAttribute('y1', midY - slashSpacing - perpY * slashLength);
      slash1.setAttribute('x2', midX - slashSpacing + perpX * slashLength);
      slash1.setAttribute('y2', midY - slashSpacing + perpY * slashLength);
      slash1.setAttribute('stroke', '#000');
      slash1.setAttribute('stroke-width', '3');
      slash1.setAttribute('stroke-linecap', 'round');
      slash1.setAttribute('class', 'shorten-slash');

      // Second slash
      const slash2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      slash2.setAttribute('x1', midX + slashSpacing - perpX * slashLength);
      slash2.setAttribute('y1', midY + slashSpacing - perpY * slashLength);
      slash2.setAttribute('x2', midX + slashSpacing + perpX * slashLength);
      slash2.setAttribute('y2', midY + slashSpacing + perpY * slashLength);
      slash2.setAttribute('stroke', '#000');
      slash2.setAttribute('stroke-width', '3');
      slash2.setAttribute('stroke-linecap', 'round');
      slash2.setAttribute('class', 'shorten-slash');

      // Insert after traverse path or line shape
      const traversePath = element.querySelector('.traverse-path');
      const insertAfter = traversePath || element.querySelector('.line-shape');
      if (insertAfter && insertAfter.nextSibling) {
        element.insertBefore(slash1, insertAfter.nextSibling);
        element.insertBefore(slash2, insertAfter.nextSibling);
      } else {
        element.appendChild(slash1);
        element.appendChild(slash2);
      }
    }

    // Remove old arrowhead if exists
    const oldArrow = element.querySelector('.arrow-head');
    if (oldArrow) {
      oldArrow.remove();
    }

    // Add arrowhead if enabled
    if (line.arrow) {
      // Calculate direction vector
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);

      // Unit vector in direction of line
      const ux = dx / length;
      const uy = dy / length;

      // Perpendicular unit vector
      const perpX = -uy;
      const perpY = ux;

      const arrowSize = 10;
      const arrowWidth = 6;

      // Arrowhead tip at the end point
      const tipX = x2;
      const tipY = y2;

      // Two base points of the arrow triangle
      const base1X = tipX - ux * arrowSize + perpX * arrowWidth;
      const base1Y = tipY - uy * arrowSize + perpY * arrowWidth;
      const base2X = tipX - ux * arrowSize - perpX * arrowWidth;
      const base2Y = tipY - uy * arrowSize - perpY * arrowWidth;

      // Create arrow polygon
      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      arrow.setAttribute('points', `${tipX},${tipY} ${base1X},${base1Y} ${base2X},${base2Y}`);
      arrow.setAttribute('fill', '#000');
      arrow.setAttribute('stroke', '#000');
      arrow.setAttribute('stroke-width', '1');
      arrow.setAttribute('class', 'arrow-head');

      element.appendChild(arrow);
    }

    // Update connection points
    const points = element.querySelectorAll('.connection-point');
    points.forEach(point => {
      const pointType = point.getAttribute('data-point-type');
      if (pointType === 'start') {
        point.setAttribute('cx', line.x1);
        point.setAttribute('cy', line.y1);
      } else if (pointType === 'end') {
        point.setAttribute('cx', line.x2);
        point.setAttribute('cy', line.y2);
      }
    });

    // Update midpoint
    const midpoint = element.querySelector('.midpoint');
    if (midpoint) {
      const midX = (line.x1 + line.x2) / 2;
      const midY = (line.y1 + line.y2) / 2;
      midpoint.setAttribute('cx', midX);
      midpoint.setAttribute('cy', midY);
    }
  }

  render() {
    // Clear and re-render all features
    this.featureLayer.innerHTML = '';
    this.features.forEach(feature => {
      if (feature.type === 'line') {
        this.renderLine(feature);
      } else if (feature.type === 'pool') {
        this.renderPool(feature);
      } else if (feature.type === 'anchor') {
        this.renderAnchor(feature);
      } else if (feature.type === 'rappel') {
        this.renderRappel(feature);
      } else if (feature.type === 'hazard') {
        this.renderHazard(feature);
      } else if (feature.type === 'exit') {
        this.renderExit(feature);
      }
    });
  }

  saveState() {
    // Create a deep copy of the current state
    const state = {
      features: JSON.parse(JSON.stringify(this.features)),
      nextId: this.nextId
    };

    // Remove any future history if we're not at the end
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    // Add new state to history
    this.history.push(state);

    // Limit history size
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    } else {
      this.historyIndex++;
    }

    this.updateUndoRedoButtons();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreState(this.history[this.historyIndex]);
      this.updateUndoRedoButtons();
      console.log('Undo - restored to history index:', this.historyIndex);
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreState(this.history[this.historyIndex]);
      this.updateUndoRedoButtons();
      console.log('Redo - restored to history index:', this.historyIndex);
    }
  }

  restoreState(state) {
    // Restore features and nextId
    this.features = JSON.parse(JSON.stringify(state.features));
    this.nextId = state.nextId;

    // Re-render everything
    this.render();
    this.selectFeature(null);
  }

  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    if (undoBtn) {
      undoBtn.disabled = this.historyIndex <= 0;
    }
    if (redoBtn) {
      redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }
  }

  exportSVG() {
    // Clone the SVG to avoid modifying the original
    const svgClone = this.svg.cloneNode(true);

    // Remove the cursor layer from the clone (we don't want it in the export)
    const cursorLayer = svgClone.querySelector('#cursor-layer');
    if (cursorLayer) {
      cursorLayer.remove();
    }

    // Scale to 2x size
    const scale = 2;
    svgClone.setAttribute('width', this.width * scale);
    svgClone.setAttribute('height', this.height * scale);
    svgClone.setAttribute('viewBox', `0 0 ${this.width} ${this.height}`);

    // Serialize the SVG
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);

    // Add XML declaration and make it a proper SVG file
    const svgBlob = new Blob(
      ['<?xml version="1.0" encoding="UTF-8"?>\n' + svgString],
      { type: 'image/svg+xml;charset=utf-8' }
    );

    // Create download link
    const url = URL.createObjectURL(svgBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'topo-export.svg';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('SVG exported successfully at 2x size');
  }

  exportPNG() {
    // Clone the SVG to avoid modifying the original
    const svgClone = this.svg.cloneNode(true);

    // Remove the cursor layer
    const cursorLayer = svgClone.querySelector('#cursor-layer');
    if (cursorLayer) {
      cursorLayer.remove();
    }

    // Remove the grid layer
    const gridLayer = svgClone.querySelector('#grid-layer');
    if (gridLayer) {
      gridLayer.remove();
    }

    // Remove all connection points and midpoints
    const connectionPoints = svgClone.querySelectorAll('.connection-point');
    connectionPoints.forEach(point => point.remove());

    const midpoints = svgClone.querySelectorAll('.midpoint');
    midpoints.forEach(point => point.remove());

    // Remove curve midpoints
    const curveMidpoints = svgClone.querySelectorAll('.curve-midpoint');
    curveMidpoints.forEach(point => point.remove());

    // Set white background
    svgClone.style.backgroundColor = '#ffffff';

    // Serialize the SVG
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);

    // Create a canvas element at 2x size
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = this.width * scale;
    canvas.height = this.height * scale;
    const ctx = canvas.getContext('2d');

    // Create an image from the SVG
    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Draw white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Scale the context and draw the image
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);

      // Convert canvas to PNG and download
      canvas.toBlob((blob) => {
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'topo-export.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        URL.revokeObjectURL(url);
        console.log('PNG exported successfully at 2x size');
      }, 'image/png');
    };

    img.onerror = (error) => {
      console.error('Error loading SVG for PNG export:', error);
      alert('Failed to export PNG. Please try again.');
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }

  exportData() {
    // Export features along with canvas settings
    const exportObject = {
      version: '1.0',
      width: this.width,
      height: this.height,
      gridSize: this.gridSize,
      features: this.features,
      nextId: this.nextId
    };

    const jsonString = JSON.stringify(exportObject, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'topo-data.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    console.log('Data exported successfully:', exportObject);
  }

  importData() {
    // Create file input
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importObject = JSON.parse(event.target.result);

          // Validate the import
          if (!importObject.features || !Array.isArray(importObject.features)) {
            throw new Error('Invalid data format: missing features array');
          }

          // Apply imported data
          this.features = importObject.features;
          this.nextId = importObject.nextId || this.features.length;

          // Update canvas settings if available
          if (importObject.width) this.width = importObject.width;
          if (importObject.height) this.height = importObject.height;
          if (importObject.gridSize) this.gridSize = importObject.gridSize;

          // Update SVG size
          this.svg.setAttribute('width', this.width);
          this.svg.setAttribute('height', this.height);

          // Update grid size selector
          const gridSelect = document.getElementById('grid-size');
          if (gridSelect) {
            gridSelect.value = this.gridSize;
          }

          // Re-render everything
          this.drawGrid();
          this.render();
          this.selectFeature(null);

          // Save imported state
          this.saveState();

          console.log('Data imported successfully:', importObject);
          alert('Data imported successfully!');
        } catch (error) {
          console.error('Error importing data:', error);
          alert(`Failed to import data: ${error.message}`);
        }
      };

      reader.readAsText(file);
    });

    input.click();
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.topoEditor = new TopoEditor('canvas-container');
});
