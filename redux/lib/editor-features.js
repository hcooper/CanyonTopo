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
      depth: 30
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
  },

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
  },

  renderExit(exit) {
    const group = TopoRenderer.prototype.renderExit.call(this, exit); // creates visual elements, appends to featureLayer
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
  },

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
  },

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

    // Add interactivity
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFeature(anchor.id);
    });

    // Make draggable
    this.makeAnchorDraggable(group, anchor);
  },

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
  },

  renderPool(pool) {
    const group = TopoRenderer.prototype.renderPool.call(this, pool); // creates pool shape, appends to featureLayer
    group.style.cursor = 'move';

    const cx = pool.x;
    const cy = pool.y;
    const width = pool.width;

    // Add connection points
    const leftPoint = this.createConnectionPoint(cx - width / 2, cy, pool.id, 'start');
    const rightPoint = this.createConnectionPoint(cx + width / 2, cy, pool.id, 'end');
    group.appendChild(leftPoint);
    group.appendChild(rightPoint);

    // Add curve midpoint handle at the deepest point of the arc
    const controlOffset = pool.depth * 0.552;
    const midX = cx;
    const midY = cy + controlOffset * 0.75;
    const curveMid = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    curveMid.setAttribute('cx', midX);
    curveMid.setAttribute('cy', midY);
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
      // Midpoint Y = pool.y + depth * 0.552 * 0.75, so:
      const newDepth = (coords.y - pool.y) / (0.552 * 0.75);
      pool.depth = Math.max(5, newDepth);

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

    // Update curve midpoint handle
    const curveMid = element.querySelector('.curve-midpoint');
    if (curveMid) {
      curveMid.setAttribute('cx', cx);
      curveMid.setAttribute('cy', cy + controlOffset * 0.75);
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

    // Update description text
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
        descText.textContent = rappel.description;
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
        descText.textContent = rappel.description;
        element.appendChild(descText);
        this.makeRappelTextDraggable(descText, rappel);
      }
    } else if (descText) {
      // Remove text if description is empty
      descText.remove();
    }
  },

  renderHazard(hazard) {
    const group = TopoRenderer.prototype.renderHazard.call(this, hazard); // creates triangle and text, appends to featureLayer
    group.style.cursor = 'move';

    // Add interactivity
    group.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectFeature(hazard.id);
    });

    // Make draggable
    this.makeHazardDraggable(group, hazard);
  },

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
  },

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
              feature.length = Math.sqrt(dx * dx + dy * dy);
              feature.slope = Math.atan2(dy, dx) * 180 / Math.PI;
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

});
