// Canyon Topo Editor — Feature render/drag/update methods
// Loaded after editor.js; extends TopoEditor.prototype

Object.assign(TopoEditor.prototype, {

  addPool(x, y) {
    const width = 50;
    const pool = {
      id: this.nextId++,
      type: 'pool',
      x: x + width / 2,  // Offset center so left connection point is at click location
      y: y,
      width: width,
      leftDepth: 30,
      rightDepth: 30
    };

    this.features.push(pool);
    this.renderPool(pool);
    this.saveState();
  },

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
  },

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
  },

  addNote(x, y) {
    const size = 30;

    const note = {
      id: this.nextId++,
      type: 'note',
      x: x,
      y: y,
      size: size,
      iconType: 'warning',
      text: ''
    };

    this.features.push(note);
    this.renderNote(note);
    this.selectFeature(note.id);
    this.saveState();
    console.log('Added note:', note);
  },

  addAccess(x, y) {
    const access = {
      id: this.nextId++,
      type: 'access',
      accessType: 'exit',  // 'exit' (black, arrow at far end) or 'entrance' (green, arrow at near end)
      x: x,
      y: y,
      length: 30
    };

    this.features.push(access);
    this.renderAccess(access);
    this.saveState();
  },

  addMetadata(x, y) {
    // Get canyon name from MediaWiki page name if available, otherwise use placeholder
    let defaultTitle = '<name>';
    if (typeof mw !== 'undefined' && mw.config) {
      const pageName = mw.config.get('wgPageName');
      if (pageName) {
        defaultTitle = pageName.replace(/_/g, ' ').replace(/^Topo:/, '');
      }
    }

    const metadata = {
      id: this.nextId++,
      type: 'metadata',
      x: x,
      y: y,
      title: defaultTitle,
      grade: '<grade>',
      timestamp: new Date().toISOString()
    };

    this.features.push(metadata);
    this.renderMetadata(metadata);
    this.saveState();
  },

  renderAccess(access) {
    const group = TopoRenderer.prototype.renderAccess.call(this, access); // creates visual elements, appends to featureLayer
    group.style.cursor = 'move';

    // Add connection point at the origin (x,y)
    const startPoint = this.createConnectionPoint(access.x, access.y, access.id, 'start');
    group.appendChild(startPoint);

    // Make the text independently draggable
    if (access.text) {
      const textEl = group.querySelector('.access-text');
      if (textEl) {
        textEl.style.cursor = 'move';
        this.makeAccessTextDraggable(textEl, access);
      }
    }

    // Add interactivity
    group.addEventListener('click', (e) => {
      // Let click bubble up to canvas handler if drawing
      if (this.pendingTool || this.drawingLine || this.drawingRappel || this.drawingPool) return;
      e.stopPropagation();
      this.selectFeature(access.id);
    });

    // Make draggable
    this.makeAccessDraggable(group, access);
  },

  makeAccessTextDraggable(textEl, access) {
    let isDragging = false;
    let startX, startY, startOffsetX, startOffsetY;

    textEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x;
      startY = coords.y;
      startOffsetX = access.textOffsetX || 0;
      startOffsetY = access.textOffsetY || 0;
      textEl.style.cursor = 'grabbing';
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const coords = this.screenToSVGCoords(e);
      access.textOffsetX = startOffsetX + (coords.x - startX);
      access.textOffsetY = startOffsetY + (coords.y - startY);
      this.updateAccess(access);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        textEl.style.cursor = 'move';
        this.saveState();
      }
    });
  },

  makeAccessDraggable(element, access) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (e.target.classList.contains('connection-point')) return;

      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x - access.x;
      startY = coords.y - access.y;
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

      access.x = newX;
      access.y = newY;

      this.updateAccess(access);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
        this.saveState();
      }
    });
  },

  updateAccess(access) {
    const element = this.featureLayer.querySelector(`[data-id="${access.id}"]`);
    if (!element) return;

    const accessType = access.accessType || 'exit';
    const color = accessType === 'entrance' ? '#27ae60' : '#000';

    const x1 = access.x;
    const y1 = access.y;
    // Exit goes NE (-45°), entrance goes NW (-135°) so connection point is at SE end
    const angle = accessType === 'entrance' ? -3 * Math.PI / 4 : -Math.PI / 4;
    const x2 = x1 + access.length * Math.cos(angle);
    const y2 = y1 + access.length * Math.sin(angle);

    const shorten = 8;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const lineX1 = x1 + dx * shorten;
    const lineY1 = y1 + dy * shorten;

    const perpX = -dy;
    const perpY = dx;
    const arrowSize = 10;
    const arrowWidth = 6;

    // Update line (shortened at connection-point end)
    const line = element.querySelector('.access-line');
    if (line) {
      line.setAttribute('x1', lineX1);
      line.setAttribute('y1', lineY1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', color);
      line.setAttribute('stroke-width', '5');
    }

    // Update arrowhead (tip offset matches renderer)
    const arrowOffset = 5;
    let tipX, tipY, dirX, dirY;
    if (accessType === 'entrance') {
      tipX = x1 + dx * arrowOffset; tipY = y1 + dy * arrowOffset; dirX = -dx; dirY = -dy;
    } else {
      tipX = x2 + dx * arrowOffset; tipY = y2 + dy * arrowOffset; dirX = dx; dirY = dy;
    }

    const arrowhead = element.querySelector('.access-arrowhead');
    if (arrowhead) {
      arrowhead.setAttribute('points',
        `${tipX},${tipY} ` +
        `${tipX - dirX * arrowSize + perpX * arrowWidth},${tipY - dirY * arrowSize + perpY * arrowWidth} ` +
        `${tipX - dirX * arrowSize - perpX * arrowWidth},${tipY - dirY * arrowSize - perpY * arrowWidth}`
      );
      arrowhead.setAttribute('fill', color);
      arrowhead.setAttribute('stroke', color);
    }

    // Update connection point
    const connectionPoint = element.querySelector('.connection-point');
    if (connectionPoint) {
      connectionPoint.setAttribute('cx', x1);
      connectionPoint.setAttribute('cy', y1);
    }

    // Update text label if present
    const textOffsetX = access.textOffsetX || 0;
    const textOffsetY = access.textOffsetY || 0;
    const midX = (x1 + x2) / 2;
    const midY = (y1 + y2) / 2;

    let textEl = element.querySelector('.access-text');
    if (access.text) {
      if (textEl) {
        textEl.setAttribute('x', midX + textOffsetX);
        textEl.setAttribute('y', midY + textOffsetY);
        textEl.setAttribute('fill', color);
        // Clear existing tspans and rebuild for multiline support
        textEl.innerHTML = '';
        const lines = access.text.split('\n');
        const lineHeight = 14;
        lines.forEach((line, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', midX + textOffsetX);
          tspan.setAttribute('dy', i === 0 ? '0' : lineHeight);
          tspan.textContent = line;
          textEl.appendChild(tspan);
        });
      } else {
        // Create new text element if it didn't exist before and make it draggable
        textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('x', midX + textOffsetX);
        textEl.setAttribute('y', midY + textOffsetY);
        textEl.setAttribute('font-size', '12');
        textEl.setAttribute('font-family', 'Arial, sans-serif');
        textEl.setAttribute('fill', color);
        textEl.setAttribute('class', 'access-text');
        textEl.style.cursor = 'move';

        // Split on newlines and create a tspan for each line
        const lines = access.text.split('\n');
        const lineHeight = 14;
        lines.forEach((line, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', midX + textOffsetX);
          tspan.setAttribute('dy', i === 0 ? '0' : lineHeight);
          tspan.textContent = line;
          textEl.appendChild(tspan);
        });

        element.appendChild(textEl);
        this.makeAccessTextDraggable(textEl, access);
      }
    } else if (textEl) {
      textEl.remove();
    }
  },

  renderMetadata(metadata) {
    const group = TopoRenderer.prototype.renderMetadata.call(this, metadata);
    group.style.cursor = 'move';

    group.addEventListener('click', (e) => {
      // Let click bubble up to canvas handler if drawing
      if (this.pendingTool || this.drawingLine || this.drawingRappel || this.drawingPool) return;
      e.stopPropagation();
      this.selectFeature(metadata.id);
    });

    this.makeMetadataDraggable(group, metadata);
  },

  makeMetadataDraggable(element, metadata) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x - metadata.x;
      startY = coords.y - metadata.y;
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

      metadata.x = newX;
      metadata.y = newY;
      this.updateMetadata(metadata);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        element.style.cursor = 'move';
        this.saveState();
      }
    });
  },

  updateMetadata(metadata) {
    const element = this.featureLayer.querySelector(`[data-id="${metadata.id}"]`);
    if (!element) return;

    // Remove all existing text elements
    element.innerHTML = '';

    const x = metadata.x;
    let y = metadata.y;

    // Re-render title if present
    if (metadata.title) {
      const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      titleText.setAttribute('x', x);
      titleText.setAttribute('y', y);
      titleText.setAttribute('text-anchor', 'end');
      titleText.setAttribute('font-size', '20');
      titleText.setAttribute('font-weight', 'bold');
      titleText.setAttribute('font-family', 'Arial, sans-serif');
      titleText.setAttribute('fill', '#222');
      titleText.setAttribute('class', 'metadata-title');
      titleText.textContent = metadata.title;
      element.appendChild(titleText);
      y += 22;
    }

    // Re-render grade if present
    if (metadata.grade) {
      const gradeText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      gradeText.setAttribute('x', x);
      gradeText.setAttribute('y', y);
      gradeText.setAttribute('text-anchor', 'end');
      gradeText.setAttribute('font-size', '16');
      gradeText.setAttribute('font-family', 'Arial, sans-serif');
      gradeText.setAttribute('fill', '#444');
      gradeText.setAttribute('class', 'metadata-grade');
      gradeText.textContent = metadata.grade;
      element.appendChild(gradeText);
      y += 18;
    }

    // Re-render date if timestamp present
    if (metadata.timestamp) {
      const dateText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      dateText.setAttribute('x', x);
      dateText.setAttribute('y', y);
      dateText.setAttribute('text-anchor', 'end');
      dateText.setAttribute('font-size', '10');
      dateText.setAttribute('font-family', 'Arial, sans-serif');
      dateText.setAttribute('fill', '#666');
      dateText.setAttribute('class', 'metadata-date');

      // Format timestamp in UTC (24-hour clock)
      const d = new Date(metadata.timestamp);
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const minutes = String(d.getUTCMinutes()).padStart(2, '0');
      const displayText = `${year}-${month}-${day} ${hours}:${minutes} UTC`;

      dateText.textContent = displayText;
      element.appendChild(dateText);
    }
  },

  renderAnchor(anchor) {
    const group = TopoRenderer.prototype.renderAnchor.call(this, anchor); // creates X mark visuals, appends to featureLayer
    group.style.cursor = 'move';

    // Add connection point at the anchor's connection location
    const connectionPoint = this.createConnectionPoint(
      anchor.connectionX,
      anchor.connectionY,
      anchor.id,
      'connection'
    );
    group.appendChild(connectionPoint);

    // Make the name text independently draggable
    if (anchor.name) {
      const nameText = group.querySelector('.anchor-name');
      if (nameText) {
        nameText.style.cursor = 'move';
        this.makeAnchorNameDraggable(nameText, anchor);
      }
    }

    // Add interactivity
    group.addEventListener('click', (e) => {
      // Let click bubble up to canvas handler if drawing
      if (this.pendingTool || this.drawingLine || this.drawingRappel || this.drawingPool) return;
      e.stopPropagation();
      this.selectFeature(anchor.id);
    });

    // Make draggable
    this.makeAnchorDraggable(group, anchor);
  },

  makeAnchorNameDraggable(textEl, anchor) {
    let isDragging = false;
    let startX, startY, startOffsetX, startOffsetY;

    textEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x;
      startY = coords.y;
      startOffsetX = anchor.nameOffsetX || 0;
      startOffsetY = anchor.nameOffsetY || 0;
      textEl.style.cursor = 'grabbing';
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const coords = this.screenToSVGCoords(e);
      anchor.nameOffsetX = startOffsetX + (coords.x - startX);
      anchor.nameOffsetY = startOffsetY + (coords.y - startY);
      this.updateAnchor(anchor);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        textEl.style.cursor = 'move';
        this.saveState();
      }
    });
  },

  makeAnchorDraggable(element, anchor) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point or name text
      if (e.target.classList.contains('connection-point')) return;
      if (e.target.classList.contains('anchor-name')) return;

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
  },

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
    const anchorType = anchor.anchorType || 'bolt';

    // Connection point position is stored in anchor.connectionX/Y and doesn't change
    // (it was set when the anchor was created)

    const lines = element.querySelectorAll('.anchor-line');

    // Check if anchor is selected
    const isSelected = this.selectedFeature === anchor.id;
    const strokeColor = isSelected ? '#ff4444' : '#000';
    const strokeWidth = isSelected ? '3' : '2';

    // Remove old marks
    lines.forEach(line => line.remove());

    // Create new marks based on current count and type (left-to-right, not centered)
    for (let i = 0; i < count; i++) {
      // Calculate offset for this mark (left-to-right from anchor.x)
      const offsetX = i * spacing;

      const connectionPoint = element.querySelector('.connection-point');

      if (anchorType === 'natural') {
        // Render "N" for natural anchors
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', cx + offsetX + visualOffsetX);
        text.setAttribute('y', cy + visualOffsetY + size * 0.3);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', size * 1.8);
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('fill', strokeColor);
        text.setAttribute('class', 'anchor-line');
        text.textContent = 'N';
        element.insertBefore(text, connectionPoint);
      } else {
        // Render X for bolt anchors
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
        element.insertBefore(line1, connectionPoint);
        element.insertBefore(line2, connectionPoint);
      }
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
      const nameOffsetX = anchor.nameOffsetX || 0;
      const nameOffsetY = anchor.nameOffsetY || 0;
      const textX = cx + visualOffsetX + (count - 1) * spacing + size + nameOffsetX;
      const textY = cy + visualOffsetY + nameOffsetY;

      if (nameText) {
        nameText.setAttribute('x', textX);
        nameText.setAttribute('y', textY);
        nameText.textContent = anchor.name;
      } else {
        // Create new text element if it didn't exist before and make it draggable
        nameText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        nameText.setAttribute('x', textX);
        nameText.setAttribute('y', textY);
        nameText.setAttribute('font-size', '12');
        nameText.setAttribute('font-family', 'Arial, sans-serif');
        nameText.setAttribute('fill', '#333');
        nameText.setAttribute('class', 'anchor-name');
        nameText.style.cursor = 'move';
        nameText.textContent = anchor.name;
        element.appendChild(nameText);
        this.makeAnchorNameDraggable(nameText, anchor);
      }
    } else if (nameText) {
      nameText.remove();
    }
  },

  renderPool(pool) {
    const group = TopoRenderer.prototype.renderPool.call(this, pool); // creates pool shape, appends to featureLayer
    group.style.cursor = 'move';

    const cx = pool.x;
    const cy = pool.y;
    const width = pool.width;

    // Support both old (depth) and new (leftDepth/rightDepth) formats
    const leftDepth = pool.leftDepth !== undefined ? pool.leftDepth : (pool.depth || 30);
    const rightDepth = pool.rightDepth !== undefined ? pool.rightDepth : (pool.depth || 30);

    // Add connection points
    const leftPoint = this.createConnectionPoint(cx - width / 2, cy, pool.id, 'start');
    const rightPoint = this.createConnectionPoint(cx + width / 2, cy, pool.id, 'end');
    group.appendChild(leftPoint);
    group.appendChild(rightPoint);

    // Add single curve control handle
    // Position it at the average depth, horizontally offset based on asymmetry
    const avgDepth = (leftDepth + rightDepth) / 2;
    const depthDiff = rightDepth - leftDepth;
    // Horizontal position: center + offset proportional to depth difference
    const handleX = cx + (depthDiff / avgDepth) * (width / 4);
    const handleY = cy + avgDepth * 0.552 * 0.75;

    const curveMid = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    curveMid.setAttribute('cx', handleX);
    curveMid.setAttribute('cy', handleY);
    curveMid.setAttribute('r', '5');
    curveMid.setAttribute('fill', '#e67e22');
    curveMid.setAttribute('stroke', 'white');
    curveMid.setAttribute('stroke-width', '2');
    curveMid.setAttribute('opacity', '0.6');
    curveMid.setAttribute('class', 'curve-midpoint');
    curveMid.setAttribute('data-feature-id', pool.id);
    curveMid.style.cursor = 'move';
    group.appendChild(curveMid);
    this.makePoolCurveMidpointDraggable(curveMid, pool.id);

    // Add interactivity
    group.addEventListener('click', (e) => {
      // Let click bubble up to canvas handler if drawing
      if (this.pendingTool || this.drawingLine || this.drawingRappel || this.drawingPool) return;
      e.stopPropagation();
      this.selectFeature(pool.id);
    });

    // Make draggable
    this.makePoolDraggable(group, pool);
  },

  makePoolDraggable(element, pool) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point or curve midpoint
      if (e.target.classList.contains('connection-point')) return;
      if (e.target.classList.contains('curve-midpoint')) return;

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

      // Snap the left connection point to grid (not the center)
      if (this.snapToGrid) {
        const snappedLeft = Math.round((newX - pool.width / 2) / this.gridSize) * this.gridSize;
        newX = snappedLeft + pool.width / 2;
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
  },

  makePoolCurveMidpointDraggable(circle, poolId) {
    let isDragging = false;

    circle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      isDragging = true;
      circle.style.cursor = 'grabbing';
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;

      const pool = this.features.find(f => f.id === poolId);
      if (!pool || pool.type !== 'pool') return;

      const coords = this.screenToSVGCoords(e);
      const cx = pool.x;
      const cy = pool.y;
      const width = pool.width;

      // Vertical position determines depth at handle location
      const handleDepth = Math.max(5, (coords.y - cy) / (0.552 * 0.75));

      // Horizontal position determines asymmetry
      // Offset from center as fraction of half-width (-1 to +1)
      const offsetX = coords.x - cx;
      const normalizedOffset = Math.max(-1, Math.min(1, offsetX / (width / 2)));

      // Calculate left and right depths based on handle position
      // When handle is centered: both equal to handleDepth
      // When handle is to the right: right is deeper, left is shallower
      // When handle is to the left: left is deeper, right is shallower
      if (normalizedOffset >= 0) {
        // Handle is at center or right
        pool.rightDepth = handleDepth;
        pool.leftDepth = handleDepth * (1 - normalizedOffset);
      } else {
        // Handle is left of center
        pool.leftDepth = handleDepth;
        pool.rightDepth = handleDepth * (1 + normalizedOffset);
      }

      this.updatePool(pool);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        circle.style.cursor = 'move';
        this.saveState();
      }
    });
  },

  updatePool(pool) {
    const element = this.featureLayer.querySelector(`[data-id="${pool.id}"]`);
    if (!element) return;

    const path = element.querySelector('.pool-shape');

    const width = pool.width;
    const cx = pool.x;
    const cy = pool.y;

    // Support both old (depth) and new (leftDepth/rightDepth) formats
    const leftDepth = pool.leftDepth !== undefined ? pool.leftDepth : (pool.depth || 30);
    const rightDepth = pool.rightDepth !== undefined ? pool.rightDepth : (pool.depth || 30);

    const startX = cx - width / 2;
    const startY = cy;
    const endX = cx + width / 2;
    const endY = cy;

    const leftControlOffset = leftDepth * 0.552;
    const rightControlOffset = rightDepth * 0.552;

    const pathData = `M ${startX},${startY} C ${startX},${cy + leftControlOffset} ${endX},${cy + rightControlOffset} ${endX},${endY}`;
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

    // Update single curve midpoint handle
    const curveMid = element.querySelector('.curve-midpoint');
    if (curveMid) {
      const avgDepth = (leftDepth + rightDepth) / 2;
      const depthDiff = rightDepth - leftDepth;
      const handleX = cx + (depthDiff / avgDepth) * (width / 4);
      const handleY = cy + avgDepth * 0.552 * 0.75;
      curveMid.setAttribute('cx', handleX);
      curveMid.setAttribute('cy', handleY);
    }
  },

  renderRappel(rappel) {
    const group = TopoRenderer.prototype.renderRappel.call(this, rappel); // creates curve, arrowhead, description; appends to featureLayer
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

    // Make the description text independently draggable
    if (rappel.description) {
      const descText = group.querySelector('.rappel-description');
      if (descText) {
        descText.style.cursor = 'move';
        this.makeRappelTextDraggable(descText, rappel);
      }
    }

    // Add interactivity
    group.addEventListener('click', (e) => {
      // Let click bubble up to canvas handler if drawing
      if (this.pendingTool || this.drawingLine || this.drawingRappel || this.drawingPool) return;
      e.stopPropagation();
      this.selectFeature(rappel.id);
    });

    // Make draggable
    this.makeRappelDraggable(group, rappel);
  },

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
  },

  makeRappelDraggable(element, rappel) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't drag if clicking on a connection point or description text
      if (e.target.classList.contains('connection-point')) return;
      if (e.target.classList.contains('rappel-description')) return;

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
  },

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

    // Update description text (supports multiline with \n)
    const textOffsetX = rappel.textOffsetX || 0;
    const textOffsetY = rappel.textOffsetY || 0;
    const textX = controlX + perpX * 15 + textOffsetX;
    const textY = controlY + perpY * 15 - 20 + textOffsetY;

    let descText = element.querySelector('.rappel-description');
    if (rappel.description) {
      if (descText) {
        // Update existing text
        descText.setAttribute('x', textX);
        descText.setAttribute('y', textY);
        // Clear existing tspans and rebuild
        descText.innerHTML = '';
        const lines = rappel.description.split('\n');
        const lineHeight = 16;
        lines.forEach((line, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', textX);
          tspan.setAttribute('dy', i === 0 ? '0' : lineHeight);
          tspan.textContent = line;
          descText.appendChild(tspan);
        });
      } else {
        // Create new text element and make it draggable
        descText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        descText.setAttribute('x', textX);
        descText.setAttribute('y', textY);
        descText.setAttribute('font-size', '14');
        descText.setAttribute('font-family', 'Arial, sans-serif');
        descText.setAttribute('fill', '#666');
        descText.setAttribute('class', 'rappel-description');
        descText.style.cursor = 'move';

        // Split on newlines and create a tspan for each line
        const lines = rappel.description.split('\n');
        const lineHeight = 16;
        lines.forEach((line, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', textX);
          tspan.setAttribute('dy', i === 0 ? '0' : lineHeight);
          tspan.textContent = line;
          descText.appendChild(tspan);
        });

        element.appendChild(descText);
        this.makeRappelTextDraggable(descText, rappel);
      }
    } else if (descText) {
      // Remove text if description is empty
      descText.remove();
    }
  },

  renderNote(note) {
    const group = TopoRenderer.prototype.renderNote.call(this, note); // creates icon + text, appends to featureLayer
    group.style.cursor = 'move';

    // Add connection point for info notes (which have no icon)
    if (note.iconType === 'info') {
      const connectionPoint = this.createConnectionPoint(note.x, note.y, note.id, 'center');
      group.appendChild(connectionPoint);
    }

    // Make the label text independently draggable
    if (note.text) {
      const textEl = group.querySelector('.note-text');
      if (textEl) {
        textEl.style.cursor = 'move';
        this.makeNoteTextDraggable(textEl, note);
      }
    }

    // Add interactivity
    group.addEventListener('click', (e) => {
      // Let click bubble up to canvas handler if drawing
      if (this.pendingTool || this.drawingLine || this.drawingRappel || this.drawingPool) return;
      e.stopPropagation();
      this.selectFeature(note.id);
    });

    // Make draggable
    this.makeNoteDraggable(group, note);
  },

  makeNoteTextDraggable(textEl, note) {
    let isDragging = false;
    let startX, startY, startOffsetX, startOffsetY;

    textEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      isDragging = true;
      const coords = this.screenToSVGCoords(e);
      startX = coords.x;
      startY = coords.y;
      startOffsetX = note.textOffsetX || 0;
      startOffsetY = note.textOffsetY || 0;
      textEl.style.cursor = 'grabbing';
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const coords = this.screenToSVGCoords(e);
      note.textOffsetX = startOffsetX + (coords.x - startX);
      note.textOffsetY = startOffsetY + (coords.y - startY);
      this.updateNote(note);
    });

    document.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        textEl.style.cursor = 'move';
        this.saveState();
      }
    });
  },

  makeNoteDraggable(element, note) {
    let isDragging = false;
    let startX, startY;

    element.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      if (e.target.classList.contains('note-text')) return;
      if (e.target.classList.contains('connection-point')) return;

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

      // Snap to grid if enabled
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
  },

  updateNote(note) {
    const element = this.featureLayer.querySelector(`[data-id="${note.id}"]`);
    if (!element) return;

    const cx = note.x;
    const cy = note.y;
    const size = note.size;

    // Redraw icon shapes (clears old ones internally)
    this.drawNoteIconElements(element, cx, cy, size, note.iconType);

    // Update connection point for info notes
    const connectionPoint = element.querySelector('.connection-point');
    if (note.iconType === 'info') {
      if (connectionPoint) {
        connectionPoint.setAttribute('cx', cx);
        connectionPoint.setAttribute('cy', cy);
      } else {
        // Add connection point if switching to info type
        const newConnectionPoint = this.createConnectionPoint(cx, cy, note.id, 'center');
        element.appendChild(newConnectionPoint);
      }
    } else if (connectionPoint) {
      // Remove connection point if switching away from info type
      connectionPoint.remove();
    }

    // Update label text
    const textOffsetX = note.textOffsetX || 0;
    const textOffsetY = note.textOffsetY || 0;
    const isName = note.iconType === 'name';
    const isInfo = note.iconType === 'info';
    const hasNoIcon = isName || isInfo;
    const textX = hasNoIcon ? cx + textOffsetX : cx + size * 0.65 + textOffsetX;
    const textY = cy + 5 + textOffsetY;

    let textEl = element.querySelector('.note-text');
    if (note.text) {
      if (textEl) {
        textEl.setAttribute('x', textX);
        textEl.setAttribute('y', textY);
        // Clear existing tspans and rebuild for multiline support
        textEl.innerHTML = '';
        const lines = note.text.split('\n');
        const lineHeight = 14;
        lines.forEach((line, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', textX);
          tspan.setAttribute('dy', i === 0 ? '0' : lineHeight);
          tspan.textContent = line;
          textEl.appendChild(tspan);
        });
        if (isName) {
          textEl.setAttribute('font-style', 'italic');
          textEl.setAttribute('text-anchor', 'middle');
        } else if (isInfo) {
          textEl.removeAttribute('font-style');
          textEl.setAttribute('text-anchor', 'middle');
        } else {
          textEl.removeAttribute('font-style');
          textEl.removeAttribute('text-anchor');
        }
      } else {
        textEl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        textEl.setAttribute('x', textX);
        textEl.setAttribute('y', textY);
        textEl.setAttribute('font-size', '12');
        textEl.setAttribute('font-family', 'Arial, sans-serif');
        textEl.setAttribute('fill', '#333');
        if (isName) {
          textEl.setAttribute('font-style', 'italic');
          textEl.setAttribute('text-anchor', 'middle');
        } else if (isInfo) {
          textEl.setAttribute('text-anchor', 'middle');
        }
        textEl.setAttribute('class', 'note-text');
        textEl.style.cursor = 'move';

        // Split on newlines and create a tspan for each line
        const lines = note.text.split('\n');
        const lineHeight = 14;
        lines.forEach((line, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', textX);
          tspan.setAttribute('dy', i === 0 ? '0' : lineHeight);
          tspan.textContent = line;
          textEl.appendChild(tspan);
        });

        element.appendChild(textEl);
        this.makeNoteTextDraggable(textEl, note);
      }

      // For 'name' type, add/update the rectangle box around the text
      if (isName) {
        // Ensure element is in DOM before measuring (it should be, since we're updating)
        const bbox = textEl.getBBox();
        const padding = 4;
        let rect = element.querySelector('rect.note-icon');
        if (!rect) {
          rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          rect.setAttribute('fill', 'none');
          rect.setAttribute('stroke', '#000');
          rect.setAttribute('stroke-width', '1');
          rect.setAttribute('class', 'note-icon');
          element.insertBefore(rect, textEl);
        }
        rect.setAttribute('x', bbox.x - padding);
        rect.setAttribute('y', bbox.y - padding);
        rect.setAttribute('width', bbox.width + padding * 2);
        rect.setAttribute('height', bbox.height + padding * 2);
      } else {
        // Remove box if switching away from 'name' type
        const rect = element.querySelector('rect.note-icon');
        if (rect) rect.remove();
      }
    } else if (textEl) {
      textEl.remove();
      const rect = element.querySelector('rect.note-icon');
      if (rect) rect.remove();
    }
  },

  renderLine(line) {
    const group = TopoRenderer.prototype.renderLine.call(this, line); // creates line, traverse, shorten, arrow; appends to featureLayer
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
      // Let click bubble up to canvas handler if drawing
      if (this.pendingTool || this.drawingLine || this.drawingRappel || this.drawingPool) return;
      e.stopPropagation();
      this.selectFeature(line.id);
    });

    // Make draggable (moves the whole line)
    this.makeLineDraggable(group, line);
  },

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
  },

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
  },

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
  },

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
  },

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
  },

  makeConnectionPointDraggable(circle, featureId, pointType) {
    let isDragging = false;
    let connectedPoints = []; // Store all connection points at this location

    circle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return; // Only left click
      // Don't intercept if we're starting or finishing a drawing operation
      if (this.pendingTool || this.drawingLine || this.drawingRappel || this.drawingPool) return;
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
        } else if (feature.type === 'note' && feature.iconType === 'info') {
          // Info notes have a connection point at their center
          if (feature.x === cx && feature.y === cy) {
            connectedPoints.push({ featureId: feature.id, pointType: 'center' });
          }
        } else if (feature.type === 'access') {
          // Access features have a connection point at their start
          if (feature.x === cx && feature.y === cy) {
            connectedPoints.push({ featureId: feature.id, pointType: 'start' });
          }
        }
      });
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
            // For pools, dragging connection points adjusts width
            const oldLeftX = feature.x - feature.width / 2;
            const oldRightX = feature.x + feature.width / 2;

            let newLeftX, newRightX;
            if (point.pointType === 'start') {
              // Dragging left point: adjust left edge, keep right edge fixed
              newLeftX = x;
              newRightX = oldRightX;
            } else {
              // Dragging right point: adjust right edge, keep left edge fixed
              newLeftX = oldLeftX;
              newRightX = x;
            }

            // Recalculate center and width
            feature.width = Math.max(10, newRightX - newLeftX); // Minimum width of 10
            feature.x = newLeftX + feature.width / 2;
            feature.y = y; // Allow vertical movement

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
              feature.length = Math.sqrt(dx * dx + dy * dy);
              feature.slope = Math.atan2(dy, dx) * 180 / Math.PI;
            }

            // Update visual
            this.updateRappel(feature);
          } else if (feature.type === 'note' && feature.iconType === 'info') {
            // For info notes, move the entire note
            feature.x = x;
            feature.y = y;

            // Update visual
            this.updateNote(feature);
          } else if (feature.type === 'access') {
            // For access features, move the entire feature
            feature.x = x;
            feature.y = y;

            // Update visual
            this.updateAccess(feature);
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
  },

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
  },

  updateLine(line) {
    const element = this.featureLayer.querySelector(`[data-id="${line.id}"]`);
    if (!element) return;

    const x1 = line.x1;
    const y1 = line.y1;
    const x2 = line.x2;
    const y2 = line.y2;

    // Calculate line direction and length for dashed segments
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / length;  // Unit vector x
    const uy = dy / length;  // Unit vector y

    // Dashed segment length
    const dashedLength = 30;

    // Calculate adjusted endpoints for solid middle segment
    let startX = x1;
    let startY = y1;
    let endX = x2;
    let endY = y2;

    if (line.dashedStart) {
      startX = x1 + ux * dashedLength;
      startY = y1 + uy * dashedLength;
    }

    if (line.dashedEnd) {
      endX = x2 - ux * dashedLength;
      endY = y2 - uy * dashedLength;
    }

    // Remove old dashed segments
    const oldDashedSegments = element.querySelectorAll('.dashed-segment-start, .dashed-segment-end');
    oldDashedSegments.forEach(seg => seg.remove());

    // Create dashed segment at start if enabled
    if (line.dashedStart) {
      const dashedStart = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      dashedStart.setAttribute('x1', x1);
      dashedStart.setAttribute('y1', y1);
      dashedStart.setAttribute('x2', startX);
      dashedStart.setAttribute('y2', startY);
      dashedStart.setAttribute('stroke', '#000');
      dashedStart.setAttribute('stroke-width', '3');
      dashedStart.setAttribute('stroke-dasharray', '5,5');
      dashedStart.setAttribute('stroke-linecap', 'butt');
      dashedStart.setAttribute('class', 'dashed-segment-start');

      // Insert at beginning
      const firstChild = element.querySelector('.line-shape');
      if (firstChild) {
        element.insertBefore(dashedStart, firstChild);
      } else {
        element.appendChild(dashedStart);
      }
    }

    // Update the solid middle segment
    const lineElem = element.querySelector('.line-shape');
    if (lineElem) {
      lineElem.setAttribute('x1', startX);
      lineElem.setAttribute('y1', startY);
      lineElem.setAttribute('x2', endX);
      lineElem.setAttribute('y2', endY);
    }

    // Create dashed segment at end if enabled
    if (line.dashedEnd) {
      const dashedEnd = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      dashedEnd.setAttribute('x1', endX);
      dashedEnd.setAttribute('y1', endY);
      dashedEnd.setAttribute('x2', x2);
      dashedEnd.setAttribute('y2', y2);
      dashedEnd.setAttribute('stroke', '#000');
      dashedEnd.setAttribute('stroke-width', '3');
      dashedEnd.setAttribute('stroke-dasharray', '5,5');
      dashedEnd.setAttribute('stroke-linecap', 'butt');
      dashedEnd.setAttribute('class', 'dashed-segment-end');

      // Insert after line-shape
      const middleSegment = element.querySelector('.line-shape');
      if (middleSegment && middleSegment.nextSibling) {
        element.insertBefore(dashedEnd, middleSegment.nextSibling);
      } else {
        element.appendChild(dashedEnd);
      }
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

      // Two parallel diagonal slashes (rotated 15° from vertical)
      const slashLength = 15;
      const slashSpacing = 6;  // Horizontal spacing between the two parallel slashes
      const angle = Math.PI / 2 + 15 * Math.PI / 180;  // 90° + 15° = 105°

      const dx = Math.cos(angle) * slashLength / 2;
      const dy = Math.sin(angle) * slashLength / 2;

      // First slash (left of midpoint)
      const slash1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      slash1.setAttribute('x1', midX - slashSpacing / 2 - dx);
      slash1.setAttribute('y1', midY - dy);
      slash1.setAttribute('x2', midX - slashSpacing / 2 + dx);
      slash1.setAttribute('y2', midY + dy);
      slash1.setAttribute('stroke', '#000');
      slash1.setAttribute('stroke-width', '3');
      slash1.setAttribute('stroke-linecap', 'round');
      slash1.setAttribute('class', 'shorten-slash');

      // Second slash (right of midpoint)
      const slash2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      slash2.setAttribute('x1', midX + slashSpacing / 2 - dx);
      slash2.setAttribute('y1', midY - dy);
      slash2.setAttribute('x2', midX + slashSpacing / 2 + dx);
      slash2.setAttribute('y2', midY + dy);
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

});
