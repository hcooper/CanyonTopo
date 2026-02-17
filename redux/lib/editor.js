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

  createControls() {
    // Create controls panel
    const controlsDiv = document.createElement('div');
    controlsDiv.id = 'canvas-controls';
    controlsDiv.style.marginTop = '10px';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.flexWrap = 'wrap';
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

    // Zoom In button
    const zoomInBtn = document.createElement('button');
    zoomInBtn.textContent = '+';
    zoomInBtn.title = 'Zoom In';
    zoomInBtn.style.fontSize = '20px';
    zoomInBtn.addEventListener('click', () => this.zoomIn());

    // Zoom Out button
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.textContent = '−';
    zoomOutBtn.title = 'Zoom Out';
    zoomOutBtn.style.fontSize = '20px';
    zoomOutBtn.addEventListener('click', () => this.zoomOut());

    // Zoom Reset button
    const zoomResetBtn = document.createElement('button');
    zoomResetBtn.textContent = '1:1';
    zoomResetBtn.title = 'Reset Zoom & Pan';
    zoomResetBtn.addEventListener('click', () => this.resetView());

    // Zoom level display
    const zoomDisplay = document.createElement('span');
    zoomDisplay.id = 'zoom-display';
    zoomDisplay.style.padding = '0 10px';
    zoomDisplay.style.fontSize = '14px';
    zoomDisplay.textContent = '100%';

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

    // Save to Wiki button
    const saveWikiBtn = document.createElement('button');
    saveWikiBtn.id = 'save-wiki-btn';
    saveWikiBtn.textContent = 'Save to Wiki';
    saveWikiBtn.addEventListener('click', () => this.saveToWiki());

    controlsDiv.appendChild(snapLabel);
    controlsDiv.appendChild(gridSizeLabel);
    controlsDiv.appendChild(undoBtn);
    controlsDiv.appendChild(redoBtn);
    controlsDiv.appendChild(zoomOutBtn);
    controlsDiv.appendChild(zoomResetBtn);
    controlsDiv.appendChild(zoomInBtn);
    controlsDiv.appendChild(zoomDisplay);
    const rowBreak = document.createElement('div');
    rowBreak.style.width = '100%';
    rowBreak.style.height = '0';
    controlsDiv.appendChild(rowBreak);
    controlsDiv.appendChild(exportSvgBtn);
    controlsDiv.appendChild(exportPngBtn);
    controlsDiv.appendChild(exportDataBtn);
    controlsDiv.appendChild(importDataBtn);
    controlsDiv.appendChild(saveWikiBtn);

    this.container.appendChild(controlsDiv);

    // Update button states initially
    this.updateUndoRedoButtons();
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
      if (this.drawingLine) {
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
    const coords = this.screenToSVGCoords(e);
    let x = coords.x;
    let y = coords.y;

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
    menu.style.left = `${e.pageX}px`;
    menu.style.top = `${e.pageY}px`;
    menu.style.backgroundColor = 'white';
    menu.style.border = '2px solid #333';
    menu.style.borderRadius = '5px';
    menu.style.padding = '5px 0';
    menu.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
    menu.style.zIndex = '1000';
    menu.style.minWidth = '150px';

    // Menu structure with sub-menus
    const menuStructure = [
      {
        label: 'Add',
        submenu: [
          { label: 'Pool', action: () => this.addPool(x, y) },
          { label: 'Anchor', action: () => this.addAnchor(x, y) },
          { label: 'Hazard', action: () => this.addHazard(x, y) },
          { label: 'Exit', action: () => this.addExit(x, y) }
        ]
      },
      {
        label: 'Draw',
        submenu: [
          { label: 'Line', action: () => this.startLine(x, y) },
          { label: 'Rappel', action: () => this.startRappel(x, y) }
        ]
      }
    ];

    let activeSubmenu = null;

    menuStructure.forEach(item => {
      const menuItem = document.createElement('div');
      menuItem.style.padding = '8px 16px';
      menuItem.style.cursor = 'pointer';
      menuItem.style.transition = 'background-color 0.2s';
      menuItem.style.position = 'relative';
      menuItem.style.display = 'flex';
      menuItem.style.justifyContent = 'space-between';
      menuItem.style.alignItems = 'center';

      const label = document.createElement('span');
      label.textContent = item.label;
      menuItem.appendChild(label);

      if (item.submenu) {
        // Add arrow indicator for submenu
        const arrow = document.createElement('span');
        arrow.textContent = '▶';
        arrow.style.marginLeft = '10px';
        arrow.style.fontSize = '10px';
        menuItem.appendChild(arrow);
      }

      menuItem.addEventListener('mouseenter', () => {
        menuItem.style.backgroundColor = '#52ab98';
        menuItem.style.color = 'white';

        // Remove any existing submenu
        if (activeSubmenu) {
          activeSubmenu.remove();
          activeSubmenu = null;
        }

        // Show submenu if present
        if (item.submenu) {
          const submenu = document.createElement('div');
          submenu.style.position = 'absolute';
          submenu.style.left = '100%';
          submenu.style.top = '0';
          submenu.style.backgroundColor = 'white';
          submenu.style.border = '2px solid #333';
          submenu.style.borderRadius = '5px';
          submenu.style.padding = '5px 0';
          submenu.style.boxShadow = '0 4px 8px rgba(0,0,0,0.2)';
          submenu.style.minWidth = '130px';
          submenu.style.zIndex = '1001';

          item.submenu.forEach(subitem => {
            const subMenuItem = document.createElement('div');
            subMenuItem.textContent = subitem.label;
            subMenuItem.style.padding = '8px 16px';
            subMenuItem.style.cursor = 'pointer';
            subMenuItem.style.transition = 'background-color 0.2s';
            subMenuItem.style.color = 'black';

            subMenuItem.addEventListener('mouseenter', () => {
              subMenuItem.style.backgroundColor = '#52ab98';
              subMenuItem.style.color = 'white';
            });

            subMenuItem.addEventListener('mouseleave', () => {
              subMenuItem.style.backgroundColor = 'transparent';
              subMenuItem.style.color = 'black';
            });

            subMenuItem.addEventListener('click', (e) => {
              e.stopPropagation();
              subitem.action();
              this.hideContextMenu();
            });

            submenu.appendChild(subMenuItem);
          });

          menuItem.appendChild(submenu);
          activeSubmenu = submenu;
        }
      });

      menuItem.addEventListener('mouseleave', () => {
        menuItem.style.backgroundColor = 'transparent';
        menuItem.style.color = 'black';
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
    const size = 10;        // Size of the X
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
      curvePosition: 0.5,  // Position along the line (0=start, 1=end, 0.5=middle)
      description: ''  // Description text to display next to the rappel
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
    const group = super.renderExit(exit); // creates visual elements, appends to featureLayer
    group.style.cursor = 'move';

    // Add connection point at the start (for line snapping)
    const x1 = exit.x;
    const y1 = exit.y;
    const startPoint = this.createConnectionPoint(x1, y1, exit.id, 'start');
    group.appendChild(startPoint);

    // Add interactivity
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFeature(exit.id);
    });

    // Make draggable
    this.makeExitDraggable(group, exit);
  }

  makeExitDraggable(element, exit) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point
      if (e.target.classList.contains('connection-point')) return;

      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x - exit.x;
      startY = coords.y - exit.y;
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
    const group = super.renderAnchor(anchor); // creates X mark visuals, appends to featureLayer
    group.style.cursor = 'move';

    // Add connection point at the anchor's connection location
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
  }

  makeAnchorDraggable(element, anchor) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point
      if (e.target.classList.contains('connection-point')) return;

      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x - anchor.x;
      startY = coords.y - anchor.y;
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

    const size = 7;  // Matches the hardcoded size used in renderAnchor (base class)
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
    const strokeColor = isSelected ? '#ff4444' : '#000';
    const strokeWidth = isSelected ? '3' : '2';

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

    // Update name text (rendered by base class renderAnchor)
    let nameText = element.querySelector('.anchor-name');
    if (anchor.name) {
      if (nameText) {
        nameText.setAttribute('x', cx + visualOffsetX + (count - 1) * spacing + size);
        nameText.setAttribute('y', cy + visualOffsetY);
        nameText.textContent = anchor.name;
      } else {
        // Create new text element if it didn't exist before
        nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameText.setAttribute('x', cx + visualOffsetX + (count - 1) * spacing + size);
        nameText.setAttribute('y', cy + visualOffsetY);
        nameText.setAttribute('font-size', '12');
        nameText.setAttribute('font-family', 'Arial, sans-serif');
        nameText.setAttribute('fill', '#333');
        nameText.setAttribute('class', 'anchor-name');
        nameText.textContent = anchor.name;
        element.appendChild(nameText);
      }
    } else if (nameText) {
      nameText.remove();
    }
  }

  renderPool(pool) {
    const group = super.renderPool(pool); // creates pool shape, appends to featureLayer
    group.style.cursor = 'move';

    const cx = pool.x;
    const cy = pool.y;
    const width = pool.width;

    // Add connection points
    const leftPoint = this.createConnectionPoint(cx - width / 2, cy, pool.id, 'start');
    const rightPoint = this.createConnectionPoint(cx + width / 2, cy, pool.id, 'end');
    group.appendChild(leftPoint);
    group.appendChild(rightPoint);

    // Add interactivity
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFeature(pool.id);
    });

    // Make draggable
    this.makePoolDraggable(group, pool);
  }

  makePoolDraggable(element, pool) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point
      if (e.target.classList.contains('connection-point')) return;

      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x - pool.x;
      startY = coords.y - pool.y;
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
    const group = super.renderRappel(rappel); // creates curve, arrowhead, description; appends to featureLayer
    group.style.cursor = 'move';

    // Recompute the control point to position the curve midpoint handle.
    // This mirrors the calculation in the base class.
    const slopeRadians = (rappel.slope * Math.PI) / 180;
    const x1 = rappel.x;
    const y1 = rappel.y;
    const x2 = x1 + rappel.length * Math.cos(slopeRadians);
    const y2 = y1 + rappel.length * Math.sin(slopeRadians);
    const perpAngle = slopeRadians + Math.PI / 2;
    const perpX = Math.cos(perpAngle);
    const perpY = Math.sin(perpAngle);
    const lineDirectionX = Math.cos(slopeRadians);
    const lineDirectionY = Math.sin(slopeRadians);
    const perpOffset = -10;
    const lengthShorten = 8;
    const curveOffset = rappel.curveOffset || -15;
    const curvePosition = rappel.curvePosition !== undefined ? rappel.curvePosition : 0.5;
    const startX = x1 + perpX * perpOffset + lineDirectionX * lengthShorten;
    const startY = y1 + perpY * perpOffset + lineDirectionY * lengthShorten;
    const endX = x2 + perpX * perpOffset - lineDirectionX * lengthShorten;
    const endY = y2 + perpY * perpOffset - lineDirectionY * lengthShorten;
    const lineX = startX + (endX - startX) * curvePosition;
    const lineY = startY + (endY - startY) * curvePosition;
    const controlX = lineX + perpX * (curveOffset - perpOffset);
    const controlY = lineY + perpY * (curveOffset - perpOffset);

    // Add draggable curve control point handle
    const curveMidpoint = this.createCurveMidpoint(controlX, controlY, rappel.id);
    group.appendChild(curveMidpoint);

    // Add connection points at the true start/end (before visual offset)
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
  }

  makeRappelDraggable(element, rappel) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point
      if (e.target.classList.contains('connection-point')) return;

      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x - rappel.x;
      startY = coords.y - rappel.y;
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

    // Calculate direction along the line
    const lineDirectionX = Math.cos(slopeRadians);
    const lineDirectionY = Math.sin(slopeRadians);

    // Offset amounts
    const perpOffset = -10;  // Offset perpendicular to the line (to the side)
    const lengthShorten = 8;  // Shorten the line at both ends
    const curveOffset = rappel.curveOffset || -15;  // Get from rappel object
    const curvePosition = rappel.curvePosition !== undefined ? rappel.curvePosition : 0.5;  // Position along line (0-1)

    // Calculate actual start and end points (offset from connection points)
    // Shorten from both ends along the line direction, and offset perpendicular
    const startX = x1 + perpX * perpOffset + lineDirectionX * lengthShorten;
    const startY = y1 + perpY * perpOffset + lineDirectionY * lengthShorten;
    const endX = x2 + perpX * perpOffset - lineDirectionX * lengthShorten;
    const endY = y2 + perpY * perpOffset - lineDirectionY * lengthShorten;

    // Calculate control point at the specified position along the line, with perpendicular offset
    const lineX = startX + (endX - startX) * curvePosition;
    const lineY = startY + (endY - startY) * curvePosition;
    const controlX = lineX + perpX * (curveOffset - perpOffset);
    const controlY = lineY + perpY * (curveOffset - perpOffset);

    // Update curved path
    const path = element.querySelector('.rappel-curve');
    if (path) {
      const pathData = `M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`;
      path.setAttribute('d', pathData);
      path.setAttribute('stroke', '#666');
      path.setAttribute('stroke-width', '2');
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
    const arrowForwardOffset = 5;  // Move arrow forward

    // Arrow tip extended forward from end point
    const arrowTipX = endX + tangentX * arrowForwardOffset;
    const arrowTipY = endY + tangentY * arrowForwardOffset;

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
      arrowhead.setAttribute('fill', '#666');
      arrowhead.setAttribute('stroke', '#666');
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

    // Update description text
    let descText = element.querySelector('.rappel-description');
    if (rappel.description) {
      const textX = controlX + perpX * 15;
      const textY = controlY + perpY * 15 - 20;  // Offset upward

      if (descText) {
        // Update existing text
        descText.setAttribute('x', textX);
        descText.setAttribute('y', textY);
        descText.textContent = rappel.description;
      } else {
        // Create new text element
        descText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        descText.setAttribute('x', textX);
        descText.setAttribute('y', textY);
        descText.setAttribute('font-size', '14');
        descText.setAttribute('font-family', 'Arial, sans-serif');
        descText.setAttribute('fill', '#666');
        descText.setAttribute('class', 'rappel-description');
        descText.textContent = rappel.description;
        element.appendChild(descText);
      }
    } else if (descText) {
      // Remove text if description is empty
      descText.remove();
    }
  }

  renderHazard(hazard) {
    const group = super.renderHazard(hazard); // creates triangle and text, appends to featureLayer
    group.style.cursor = 'move';

    // Add interactivity
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFeature(hazard.id);
    });

    // Make draggable
    this.makeHazardDraggable(group, hazard);
  }

  makeHazardDraggable(element, hazard) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click

      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x - hazard.x;
      startY = coords.y - hazard.y;
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

  startRappel(x, y) {
    this.drawingRappel = true;

    // Store connection info if snapped to a connection point
    let connectedTo = null;
    let connectionPoint = null;

    if (this.hoveredConnectionPoint) {
      connectedTo = parseInt(this.hoveredConnectionPoint.featureId);
      connectionPoint = this.hoveredConnectionPoint.pointType;
    }

    this.rappelStartPoint = {
      x,
      y,
      connectedTo,
      connectionPoint
    };

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
    const length = Math.round(Math.sqrt(dx * dx + dy * dy));
    const slope = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);

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
        this.renderFeatureList();
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
          <div>
            <label for="rappel-description" style="display: block; margin-bottom: 4px; font-weight: 500;">Description:</label>
            <input type="text" id="rappel-description" value="${feature.description || ''}" placeholder="e.g., 150', DBL"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <button id="delete-rappel" style="background-color: #e74c3c; margin-top: 8px;">Delete Rappel</button>
        </div>
      `;

      // Add event listeners
      const lengthInput = document.getElementById('rappel-length');
      const slopeInput = document.getElementById('rappel-slope');
      const descriptionInput = document.getElementById('rappel-description');
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

      descriptionInput.addEventListener('input', (e) => {
        feature.description = e.target.value;
        this.updateRappel(feature);
        this.renderFeatureList();
        console.log('Updated rappel description:', feature.description);
      });

      descriptionInput.addEventListener('blur', (e) => {
        // Save state when user finishes editing description
        this.saveState();
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
    const group = super.renderLine(line); // creates line, traverse, shorten, arrow; appends to featureLayer
    group.style.cursor = 'move';

    // Add connection points at endpoints
    const startPoint = this.createConnectionPoint(line.x1, line.y1, line.id, 'start');
    const endPoint = this.createConnectionPoint(line.x2, line.y2, line.id, 'end');
    group.appendChild(startPoint);
    group.appendChild(endPoint);

    // Add midpoint handle for splitting the line
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

      const coords = this.screenToSVGCoords(e);
      const mouseX = coords.x;
      const mouseY = coords.y;

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

      // Calculate actual start/end with offsets
      const perpOffset = -10;
      const lengthShorten = 8;
      const startX = x1 + perpX * perpOffset + lineX * lengthShorten;
      const startY = y1 + perpY * perpOffset + lineY * lengthShorten;
      const endX = x2 + perpX * perpOffset - lineX * lengthShorten;
      const endY = y2 + perpY * perpOffset - lineY * lengthShorten;

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
      const offset = (offsetX * perpX + offsetY * perpY) + perpOffset;

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

      const coords = this.screenToSVGCoords(e);
      dragStartX = coords.x;
      dragStartY = coords.y;

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

      const coords = this.screenToSVGCoords(e);
      let x = coords.x;
      let y = coords.y;

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

        const coords = this.screenToSVGCoords(e);
        let x = coords.x;
        let y = coords.y;

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

      const coords = this.screenToSVGCoords(e);
      let x = coords.x;
      let y = coords.y;

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
      const coords = this.screenToSVGCoords(e);
      startX = coords.x;
      startY = coords.y;
      element.style.cursor = 'grabbing';
      e.stopPropagation();
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const coords = this.screenToSVGCoords(e);
      let newX = coords.x;
      let newY = coords.y;

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
    super.render(); // clears featureLayer, calls each renderXxx
    // Update feature list in sidebar
    this.renderFeatureList();
  }

  getSortedFeatures() {
    // Helper function to get a representative position for a feature
    const getFeaturePosition = (feature) => {
      switch (feature.type) {
        case 'line':
          // Use start point
          return { x: feature.x1, y: feature.y1 };
        case 'rappel':
          // Use start point
          return { x: feature.x, y: feature.y };
        case 'pool':
          // Use center point
          return { x: feature.x, y: feature.y };
        case 'anchor':
          // Use connection point
          return { x: feature.connectionX, y: feature.connectionY };
        case 'hazard':
          return { x: feature.x, y: feature.y };
        case 'exit':
          return { x: feature.x, y: feature.y };
        default:
          return { x: 0, y: 0 };
      }
    };

    // Build a graph of connections between features
    const connections = new Map();
    this.features.forEach(f => connections.set(f.id, new Set()));

    // Find all connection points and group features that share them
    const connectionPoints = new Map(); // Map from "x,y" to feature IDs

    this.features.forEach(feature => {
      const addPoint = (x, y, featureId) => {
        const key = `${Math.round(x)},${Math.round(y)}`;
        if (!connectionPoints.has(key)) {
          connectionPoints.set(key, new Set());
        }
        connectionPoints.get(key).add(featureId);
      };

      if (feature.type === 'line') {
        addPoint(feature.x1, feature.y1, feature.id);
        addPoint(feature.x2, feature.y2, feature.id);
      } else if (feature.type === 'rappel') {
        const slopeRadians = (feature.slope * Math.PI) / 180;
        const x2 = feature.x + feature.length * Math.cos(slopeRadians);
        const y2 = feature.y + feature.length * Math.sin(slopeRadians);
        addPoint(feature.x, feature.y, feature.id);
        addPoint(x2, y2, feature.id);
      } else if (feature.type === 'pool') {
        const leftX = feature.x - feature.width / 2;
        const rightX = feature.x + feature.width / 2;
        addPoint(leftX, feature.y, feature.id);
        addPoint(rightX, feature.y, feature.id);
      } else if (feature.type === 'anchor') {
        addPoint(feature.connectionX, feature.connectionY, feature.id);
      }
    });

    // Build connection graph
    connectionPoints.forEach((featureIds) => {
      const ids = Array.from(featureIds);
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          connections.get(ids[i]).add(ids[j]);
          connections.get(ids[j]).add(ids[i]);
        }
      }
    });

    // Sort features by Y position first (top to bottom), then X position (left to right)
    const sorted = [...this.features].sort((a, b) => {
      const posA = getFeaturePosition(a);
      const posB = getFeaturePosition(b);

      // Primary sort by Y coordinate (top to bottom)
      if (Math.abs(posA.y - posB.y) > 50) { // Group features within 50 units vertically
        return posA.y - posB.y;
      }

      // Secondary sort by X coordinate (left to right)
      return posA.x - posB.x;
    });

    return sorted;
  }

  renderFeatureList() {
    const featureListDiv = document.getElementById('feature-list');
    if (!featureListDiv) return;

    if (this.features.length === 0) {
      featureListDiv.innerHTML = '<p class="empty-state">No features yet</p>';
      return;
    }

    // Sort features by position (top to bottom, left to right)
    const sortedFeatures = this.getSortedFeatures();

    // Create a list of features
    const list = document.createElement('ul');
    list.style.listStyle = 'none';
    list.style.padding = '0';
    list.style.margin = '0';

    sortedFeatures.forEach(feature => {
      const listItem = document.createElement('li');
      listItem.style.padding = '8px 12px';
      listItem.style.marginBottom = '4px';
      listItem.style.backgroundColor = this.selectedFeature === feature.id ? '#e8f4f8' : '#f9f9f9';
      listItem.style.border = '1px solid #ddd';
      listItem.style.borderRadius = '3px';
      listItem.style.cursor = 'pointer';
      listItem.style.transition = 'background-color 0.2s';
      listItem.style.fontSize = '13px';

      // Create feature label
      let label = '';
      switch (feature.type) {
        case 'line':
          label = `Line (${feature.length}m, ${feature.slope}°)`;
          break;
        case 'pool':
          label = `Pool (${feature.width}×${feature.height})`;
          break;
        case 'anchor':
          label = `Anchor (${feature.anchorType})`;
          if (feature.name) label += ` - ${feature.name}`;
          break;
        case 'rappel':
          label = `Rappel (${feature.length}m)`;
          if (feature.description) label += ` - ${feature.description}`;
          break;
        case 'hazard':
          label = `Hazard`;
          break;
        case 'exit':
          label = `Exit`;
          break;
      }

      listItem.textContent = label;

      // Hover effect
      listItem.addEventListener('mouseenter', () => {
        if (this.selectedFeature !== feature.id) {
          listItem.style.backgroundColor = '#f0f0f0';
        }
      });

      listItem.addEventListener('mouseleave', () => {
        if (this.selectedFeature !== feature.id) {
          listItem.style.backgroundColor = '#f9f9f9';
        }
      });

      // Click to select feature
      listItem.addEventListener('click', () => {
        this.selectFeature(feature.id);
      });

      list.appendChild(listItem);
    });

    featureListDiv.innerHTML = '';
    featureListDiv.appendChild(list);
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

  toYAML() {
    const exportObject = {
      version: '1.0',
      width: this.width,
      height: this.height,
      gridSize: this.gridSize,
      features: this.features,
      nextId: this.nextId
    };
    return jsyaml.dump(exportObject);
  }

  exportData() {
    const yamlString = this.toYAML();
    const blob = new Blob([yamlString], { type: 'application/x-yaml' });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'topo-data.yaml';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ---------------------------------------------------------------------------
  // MediaWiki save
  // ---------------------------------------------------------------------------

  isEditMode() {
    return typeof mw !== 'undefined' && mw.config.get('wgAction') === 'edit-topo';
  }

  wikiPageName() {
    return typeof mw !== 'undefined' ? mw.config.get('wgPageName') : null;
  }

  saveToWiki() {
    const pageName = this.wikiPageName();
    if (!pageName) {
      alert('No wiki page name available (mw.config.get("wgPageName") returned null)');
      return;
    }

    if (typeof mw === 'undefined' || !mw.Api) {
      alert('MediaWiki API (mw.Api) is not available');
      return;
    }

    const saveBtn = document.getElementById('save-wiki-btn');
    saveBtn.textContent = 'Saving…';
    saveBtn.disabled = true;

    const api = new mw.Api();
    api.postWithToken('csrf', {
      action: 'edit',
      title: pageName,
      text: this.toYAML(),
      format: 'json'
    })
      .then(data => {
        if (data.edit && data.edit.result === 'Success') {
          saveBtn.textContent = 'Saved!';
          setTimeout(() => {
            saveBtn.textContent = 'Save to Wiki';
            saveBtn.disabled = false;
          }, 2000);
        } else if (data.error) {
          throw new Error(data.error.info || data.error.code || 'Unknown API error');
        } else {
          throw new Error('Unexpected response from wiki API');
        }
      })
      .catch(err => {
        console.error('Wiki save failed:', err);
        alert(`Save failed: ${err.message}`);
        saveBtn.textContent = 'Save Failed';
        setTimeout(() => {
          saveBtn.textContent = 'Save to Wiki';
          saveBtn.disabled = false;
        }, 2000);
      });
  }

  loadFromYAML(yamlString) {
    const importObject = jsyaml.load(yamlString);

    if (!importObject.features || !Array.isArray(importObject.features)) {
      throw new Error('Invalid data format: missing features array');
    }

    this.features = importObject.features;
    this.nextId = importObject.nextId || this.features.length;

    if (importObject.width) this.width = importObject.width;
    if (importObject.height) this.height = importObject.height;
    if (importObject.gridSize) this.gridSize = importObject.gridSize;

    this.svg.setAttribute('width', this.width);
    this.svg.setAttribute('height', this.height);

    const gridSelect = document.getElementById('grid-size');
    if (gridSelect) gridSelect.value = this.gridSize;

    this.drawGrid();
    this.render();
    this.fitToContent();
    this.selectFeature(null);
    this.saveState();
  }

  importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          this.loadFromYAML(event.target.result);
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

function loadPage() {

  // Main container
  const mainContainer = document.createElement('div');
  mainContainer.className = 'main-container';

  // Canvas section
  const canvasSection = document.createElement('div');
  canvasSection.className = 'canvas-section';

  const canvasContainer = document.createElement('div');
  canvasContainer.id = 'canvas-container';

  canvasSection.appendChild(canvasContainer);

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
