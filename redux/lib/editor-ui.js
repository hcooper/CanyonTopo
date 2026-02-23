// Canyon Topo Editor — UI/controls methods
// Loaded after editor.js; extends TopoEditor.prototype

Object.assign(TopoEditor.prototype, {

  // Returns the SVG coordinates of the center of the current viewport.
  // Used by createToolbar() to place new features in the visible area.
  viewCenter() {
    return {
      x: this.panX + (this.width / this.zoomLevel) / 2,
      y: this.panY + (this.height / this.zoomLevel) / 2
    };
  },

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
    zoomInBtn.title = 'Zoom In (+)';
    zoomInBtn.style.fontSize = '20px';
    zoomInBtn.addEventListener('click', () => this.zoomIn());

    // Zoom Out button
    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.textContent = '−';
    zoomOutBtn.title = 'Zoom Out (-)';
    zoomOutBtn.style.fontSize = '20px';
    zoomOutBtn.addEventListener('click', () => this.zoomOut());

    // Zoom Reset button
    const zoomResetBtn = document.createElement('button');
    zoomResetBtn.textContent = '1:1';
    zoomResetBtn.title = 'Reset Zoom & Pan (0)';
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
    saveWikiBtn.style.minWidth = '110px'; // Prevent layout shift during save
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
  },

  createToolbar() {
    const toolbar = document.createElement('div');
    toolbar.id = 'toolbar';

    const tools = [
      {
        name: 'Cursor (V)',
        id: 'cursor-mode-btn',
        action: () => {
          this.pendingTool = null;
          this.cancelDrawing();
          if (this.selectMode) this.toggleSelectMode();
          this.updateToolbarStates();
        },
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path d="M 5,3 L 5,17 L 10,13 L 13,19 L 15,18 L 12,12 L 17,12 Z" fill="white" stroke="white" stroke-width="1" stroke-linejoin="round"/>
        </svg>`
      },
      {
        name: 'Select (S)',
        id: 'select-mode-btn',
        action: () => {
          this.toggleSelectMode();
          this.updateToolbarStates();
        },
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <rect x="3" y="3" width="18" height="18" rx="2" fill="rgba(255,255,255,0.12)" stroke="white" stroke-width="2" stroke-dasharray="4,3"/>
        </svg>`
      },
      {
        name: 'Line (L)',
        id: 'line-tool-btn',
        action: () => {
          if (this.selectMode) this.toggleSelectMode();
          this.pendingTool = 'line';
          this.updateToolbarStates();
        },
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <line x1="4" y1="4" x2="20" y2="20" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
        </svg>`
      },
      {
        name: 'Rappel (R)',
        id: 'rappel-tool-btn',
        action: () => {
          if (this.selectMode) this.toggleSelectMode();
          this.pendingTool = 'rappel';
          this.updateToolbarStates();
        },
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path d="M 6,4 Q 18,12 6,20" stroke="white" stroke-width="2.5" fill="none" stroke-linecap="round"/>
          <polygon points="6,20 2,13 10,13" fill="white"/>
        </svg>`
      },
      {
        name: 'Pool (P)',
        id: 'pool-tool-btn',
        action: () => {
          if (this.selectMode) this.toggleSelectMode();
          this.pendingTool = 'pool';
          this.updateToolbarStates();
        },
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <path d="M 4,12 C 4,20 20,20 20,12" stroke="white" stroke-width="2.5" fill="#4a90e2"/>
        </svg>`
      },
      {
        name: 'Anchor (A)',
        action: () => { const c = this.viewCenter(); this.addAnchor(c.x, c.y); },
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <line x1="5" y1="8" x2="11" y2="16" stroke="white" stroke-width="2" stroke-linecap="round"/>
          <line x1="11" y1="8" x2="5" y2="16" stroke="white" stroke-width="2" stroke-linecap="round"/>
          <line x1="13" y1="8" x2="19" y2="16" stroke="white" stroke-width="2" stroke-linecap="round"/>
          <line x1="19" y1="8" x2="13" y2="16" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>`
      },
      {
        name: 'Note (N)',
        action: () => { const c = this.viewCenter(); this.addNote(c.x, c.y); },
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <polygon points="12,3 22,21 2,21" stroke="white" stroke-width="2" fill="#FFD700"/>
          <text x="12" y="18" text-anchor="middle" font-size="9" font-weight="bold" fill="#333">!</text>
        </svg>`
      },
      {
        name: 'Access (X)',
        action: () => { const c = this.viewCenter(); this.addAccess(c.x, c.y); },
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <line x1="5" y1="19" x2="19" y2="5" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          <polygon points="19,5 13,5 19,11" fill="white"/>
        </svg>`
      },
      {
        name: 'Info (I)',
        action: () => { const c = this.viewCenter(); this.addMetadata(c.x, c.y); },
        icon: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
          <line x1="4" y1="6" x2="20" y2="6" stroke="white" stroke-width="2" stroke-linecap="round"/>
          <line x1="6" y1="12" x2="20" y2="12" stroke="white" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="8" y1="18" x2="20" y2="18" stroke="white" stroke-width="1" stroke-linecap="round"/>
        </svg>`
      }
    ];

    tools.forEach(tool => {
      const btn = document.createElement('button');
      btn.title = tool.name;
      if (tool.id) btn.id = tool.id;
      btn.innerHTML = tool.icon;
      btn.addEventListener('click', tool.action);
      toolbar.appendChild(btn);
    });

    // Insert into canvas-row before canvas-container so it appears to the left
    this.container.parentElement.insertBefore(toolbar, this.container);

    // Set initial state
    this.updateToolbarStates();
  },

  updateToolbarStates() {
    // Update cursor button
    const cursorBtn = document.getElementById('cursor-mode-btn');
    if (cursorBtn) {
      if (!this.pendingTool && !this.selectMode) {
        cursorBtn.style.backgroundColor = '#3a7ca5';
        cursorBtn.style.outline = '2px solid #52ab98';
      } else {
        cursorBtn.style.backgroundColor = '';
        cursorBtn.style.outline = '';
      }
    }

    // Update select button
    const selectBtn = document.getElementById('select-mode-btn');
    if (selectBtn) {
      if (this.selectMode) {
        selectBtn.style.backgroundColor = '#3a7ca5';
        selectBtn.style.outline = '2px solid #52ab98';
      } else {
        selectBtn.style.backgroundColor = '';
        selectBtn.style.outline = '';
      }
    }

    // Update drawing tool buttons
    const toolMap = {
      'line': 'line-tool-btn',
      'rappel': 'rappel-tool-btn',
      'pool': 'pool-tool-btn'
    };

    for (const [tool, btnId] of Object.entries(toolMap)) {
      const btn = document.getElementById(btnId);
      if (btn) {
        if (this.pendingTool === tool) {
          btn.style.backgroundColor = '#3a7ca5';
          btn.style.outline = '2px solid #52ab98';
        } else {
          btn.style.backgroundColor = '';
          btn.style.outline = '';
        }
      }
    }
  },

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
          { label: 'Note', action: () => this.addNote(x, y) },
          { label: 'Access', action: () => this.addAccess(x, y) }
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
  },

  hideContextMenu() {
    const menu = document.getElementById('context-menu');
    if (menu) {
      menu.remove();
    }
  },

  updatePropertiesPanel(feature) {
    const panel = document.getElementById('properties-panel');
    if (!panel) return;

    if (!feature) {
      panel.innerHTML = '<p class="empty-state">Select a feature to edit properties</p>';
      return;
    }

    if (feature.type === 'anchor') {
      const isBolt = (feature.anchorType === 'bolt');
      panel.innerHTML = `
        <h3>Anchor</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label for="anchor-type" style="display: block; margin-bottom: 4px; font-weight: 500;">Type:</label>
            <select id="anchor-type" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
              <option value="bolt" ${feature.anchorType === 'bolt' ? 'selected' : ''}>Bolt</option>
              <option value="natural" ${feature.anchorType === 'natural' ? 'selected' : ''}>Natural</option>
            </select>
          </div>
          ${isBolt ? `
          <div>
            <label for="anchor-count" style="display: block; margin-bottom: 4px; font-weight: 500;">Count:</label>
            <input type="number" id="anchor-count" value="${feature.count}" min="1" max="10"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          ` : ''}
          <div>
            <label for="anchor-name" style="display: block; margin-bottom: 4px; font-weight: 500;">Name:</label>
            <input type="text" id="anchor-name" value="${feature.name || ''}" placeholder="Optional label"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <div>
            <label for="anchor-location" style="display: block; margin-bottom: 4px; font-weight: 500;">Location:</label>
            <input type="text" id="anchor-location" value="${feature.location || ''}" placeholder="e.g., LDC, RDC, climber's left"
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
        // Set count to 1 when switching away from bolt
        if (e.target.value !== 'bolt') {
          feature.count = 1;
        }
        this.updateAnchor(feature);
        this.saveState();
        // Refresh panel to show/hide count field
        this.updatePropertiesPanel(feature);
        console.log('Updated anchor type:', feature.anchorType);
      });

      if (countInput) {
        countInput.addEventListener('input', (e) => {
          feature.count = parseInt(e.target.value) || 1;
          this.updateAnchor(feature);
          this.saveState();
          console.log('Updated anchor count:', feature.count);
        });
      }

      nameInput.addEventListener('input', (e) => {
        feature.name = e.target.value;
        this.updateAnchor(feature);
        this.renderFeatureList();
        console.log('Updated anchor name:', feature.name);
      });

      nameInput.addEventListener('blur', (e) => {
        // Save state when user finishes editing name
        this.saveState();
      });

      const locationInput = document.getElementById('anchor-location');
      locationInput.addEventListener('input', (e) => {
        feature.location = e.target.value;
        this.updateAnchor(feature);
        console.log('Updated anchor location:', feature.location);
      });

      locationInput.addEventListener('blur', (e) => {
        // Save state when user finishes editing location
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
            <textarea id="rappel-description" placeholder="e.g., 150', DBL" rows="3"
                      style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; resize: vertical; font-family: inherit; font-size: inherit;">${feature.description || ''}</textarea>
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
    } else if (feature.type === 'note') {
      const icons = [
        { value: 'info',      label: 'Info' },
        { value: 'warning',   label: 'Warning' },
        { value: 'water',     label: 'Water' },
        { value: 'hydraulic', label: 'Hydraulic' },
        { value: 'rockfall',  label: 'Rockfall' },
        { value: 'bridge',    label: 'Bridge' },
        { value: 'name',      label: 'Section Name' },
      ];

      const placeholder = (feature.iconType === 'info') ? 'Text' : 'Optional label (draggable)';
      const showSize = (feature.iconType !== 'info');

      panel.innerHTML = `
        <h3>Note</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">Icon Type:</label>
            <div id="note-icon-picker" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px;"></div>
          </div>
          <div>
            <label for="note-text" style="display: block; margin-bottom: 4px; font-weight: 500;">Label:</label>
            <textarea id="note-text" placeholder="${placeholder}" rows="3"
                      style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px; resize: vertical; font-family: inherit; font-size: inherit;">${feature.text || ''}</textarea>
          </div>
          ${showSize ? `
          <div>
            <label for="note-size" style="display: block; margin-bottom: 4px; font-weight: 500;">Icon Size:</label>
            <input type="number" id="note-size" value="${feature.size}" min="15" max="60"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          ` : ''}
          <button id="delete-note" style="background-color: #e74c3c; margin-top: 8px;">Delete Note</button>
        </div>
      `;

      // Create visual icon picker
      const iconPicker = document.getElementById('note-icon-picker');
      icons.forEach(icon => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.style.padding = '8px';
        btn.style.border = '2px solid #ddd';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.backgroundColor = 'white';
        btn.style.display = 'flex';
        btn.style.flexDirection = 'column';
        btn.style.alignItems = 'center';
        btn.style.gap = '4px';
        btn.title = icon.label;

        // Highlight selected icon
        if ((feature.iconType || 'warning') === icon.value) {
          btn.style.borderColor = '#52ab98';
          btn.style.backgroundColor = '#f0f9f8';
        }

        // Create SVG container for icon preview
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', '30');
        svg.setAttribute('height', '30');
        svg.setAttribute('viewBox', '0 0 60 60');

        // Special case for 'info': show bold "T"
        if (icon.value === 'info') {
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', '30');
          text.setAttribute('y', '40');
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('font-size', '24');
          text.setAttribute('font-weight', 'bold');
          text.setAttribute('font-family', 'Arial, sans-serif');
          text.setAttribute('fill', '#333');
          text.textContent = 'T';
          svg.appendChild(text);
        } else if (icon.value === 'name') {
          // Special case for 'name': show "Lower" in a box
          // Box around text
          const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('x', '8');
          rect.setAttribute('y', '22');
          rect.setAttribute('width', '44');
          rect.setAttribute('height', '16');
          rect.setAttribute('fill', 'none');
          rect.setAttribute('stroke', '#333');
          rect.setAttribute('stroke-width', '1');
          svg.appendChild(rect);

          // Text "Lower"
          const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          text.setAttribute('x', '30');
          text.setAttribute('y', '35');
          text.setAttribute('text-anchor', 'middle');
          text.setAttribute('font-size', '12');
          text.setAttribute('font-family', 'Arial, sans-serif');
          text.setAttribute('fill', '#333');
          text.textContent = 'Lower';
          svg.appendChild(text);
        } else {
          // Create temporary group to render icon
          const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
          g.setAttribute('data-id', 'preview');
          g.setAttribute('data-type', 'note');
          svg.appendChild(g);

          // Use the renderer's drawNoteIconElements method to draw the icon
          this.drawNoteIconElements(g, 30, 30, 25, icon.value);
        }

        btn.appendChild(svg);

        const label = document.createElement('div');
        label.textContent = icon.label;
        label.style.fontSize = '10px';
        label.style.color = '#666';
        btn.appendChild(label);

        btn.addEventListener('click', () => {
          feature.iconType = icon.value;
          this.updateNote(feature);
          this.saveState();
          // Update UI to show selected state
          this.updatePropertiesPanel(feature);
        });

        iconPicker.appendChild(btn);
      });

      // Add event listeners
      const textInput = document.getElementById('note-text');
      const sizeInput = document.getElementById('note-size');
      const deleteBtn = document.getElementById('delete-note');

      textInput.addEventListener('input', (e) => {
        feature.text = e.target.value;
        this.updateNote(feature);
      });

      textInput.addEventListener('blur', () => {
        this.saveState();
      });

      sizeInput.addEventListener('input', (e) => {
        feature.size = parseInt(e.target.value) || 30;
        this.updateNote(feature);
        this.saveState();
      });

      deleteBtn.addEventListener('click', () => {
        this.deleteFeature(feature.id);
      });
    } else if (feature.type === 'access') {
      const currentType = feature.accessType || 'exit';
      panel.innerHTML = `
        <h3>Access</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label for="access-type" style="display: block; margin-bottom: 4px; font-weight: 500;">Type:</label>
            <select id="access-type" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
              <option value="exit"     ${currentType === 'exit'     ? 'selected' : ''}>Exit (black, arrow out)</option>
              <option value="entrance" ${currentType === 'entrance' ? 'selected' : ''}>Entrance (green, arrow in)</option>
            </select>
          </div>
          <div>
            <label for="access-length" style="display: block; margin-bottom: 4px; font-weight: 500;">Length:</label>
            <input type="number" id="access-length" value="${feature.length}" min="10" max="200"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <div>
            <label for="access-text" style="display: block; margin-bottom: 4px; font-weight: 500;">Label:</label>
            <input type="text" id="access-text" value="${feature.text || ''}" maxlength="40" placeholder="Optional label (draggable)"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <button id="delete-access" style="background-color: #e74c3c; margin-top: 8px;">Delete Access</button>
        </div>
      `;

      const typeSelect = document.getElementById('access-type');
      const lengthInput = document.getElementById('access-length');
      const textInput = document.getElementById('access-text');
      const deleteBtn = document.getElementById('delete-access');

      typeSelect.addEventListener('change', (e) => {
        feature.accessType = e.target.value;
        this.updateAccess(feature);
        this.renderFeatureList();
        this.saveState();
      });

      lengthInput.addEventListener('input', (e) => {
        feature.length = parseInt(e.target.value) || 60;
        this.updateAccess(feature);
        this.saveState();
      });

      textInput.addEventListener('input', (e) => {
        feature.text = e.target.value;
        this.updateAccess(feature);
        this.renderFeatureList();
      });

      textInput.addEventListener('blur', () => {
        this.saveState();
      });

      deleteBtn.addEventListener('click', () => {
        this.deleteFeature(feature.id);
      });
    } else if (feature.type === 'metadata') {
      panel.innerHTML = `
        <h3>Info Box</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <div>
            <label for="metadata-title" style="display: block; margin-bottom: 4px; font-weight: 500;">Title:</label>
            <input type="text" id="metadata-title" value="${feature.title || ''}" placeholder="&lt;name&gt;"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <div>
            <label for="metadata-grade" style="display: block; margin-bottom: 4px; font-weight: 500;">Grade:</label>
            <input type="text" id="metadata-grade" value="${feature.grade || ''}" placeholder="&lt;grade&gt;"
                   style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 3px;">
          </div>
          <button id="delete-metadata" style="background-color: #e74c3c; margin-top: 8px;">Delete Info Box</button>
        </div>
      `;

      const titleInput = document.getElementById('metadata-title');
      const gradeInput = document.getElementById('metadata-grade');
      const deleteBtn = document.getElementById('delete-metadata');

      titleInput.addEventListener('input', (e) => {
        feature.title = e.target.value;
        this.updateMetadata(feature);
      });

      titleInput.addEventListener('blur', () => {
        this.saveState();
      });

      gradeInput.addEventListener('input', (e) => {
        feature.grade = e.target.value;
        this.updateMetadata(feature);
      });

      gradeInput.addEventListener('blur', () => {
        this.saveState();
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
  },

  // Stub — real implementation provided by editor-feature-list.js when loaded.
  // Kept here so init() works even if that file is absent.
  renderFeatureList() {},

});

