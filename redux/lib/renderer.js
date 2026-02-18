// TopoRenderer - shared base class for TopoEditor and TopoViewer
//
// Provides: canvas creation, grid drawing, all feature render methods (visual
// elements only), zoom/pan state and methods, and the pan+wheel event listeners.
//
// Design notes:
//  - The base constructor does NOT call this.init().  Each subclass calls
//    this.init() after establishing its own state.
//  - Each renderXxx() method creates the SVG group, appends it to
//    featureLayer, and returns the group so subclasses can attach interactive
//    elements without re-appending.
//  - attachEventListeners() installs only middle-mouse pan and mouse-wheel
//    zoom.  Subclasses call super.attachEventListeners() then add their own.
//  - applyViewTransform() calls this.drawGrid() so the viewer can override
//    drawGrid() to a no-op without needing to override applyViewTransform().

class TopoRenderer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    this.width = 800;
    this.height = 600;
    this.gridSize = 10;
    this.features = [];

    // Zoom and pan state
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.minZoom = 0.25;
    this.maxZoom = 4;
    this.isPanning = false;
    this.panStartX = 0;
    this.panStartY = 0;
  }

  // Called by each subclass after it has finished setting up its own state.
  init() {
    this.createCanvas();
    this.drawGrid();
    this.attachEventListeners();
  }

  // ---------------------------------------------------------------------------
  // Canvas creation
  // ---------------------------------------------------------------------------

  createCanvas() {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.svg.setAttribute('width', this.width);
    this.svg.setAttribute('height', this.height);
    this.svg.style.border = '2px solid #333';
    this.svg.style.backgroundColor = '#ffffff';
    this.svg.style.cursor = 'default';

    this.gridLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.gridLayer.id = 'grid-layer';

    this.featureLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.featureLayer.id = 'feature-layer';

    this.svg.appendChild(this.gridLayer);
    this.svg.appendChild(this.featureLayer);

    this.container.appendChild(this.svg);
  }

  // ---------------------------------------------------------------------------
  // Grid
  // ---------------------------------------------------------------------------

  drawGrid() {
    this.gridLayer.innerHTML = '';

    const viewWidth = this.width / this.zoomLevel;
    const viewHeight = this.height / this.zoomLevel;
    const startX = this.panX;
    const startY = this.panY;
    const endX = this.panX + viewWidth;
    const endY = this.panY + viewHeight;

    const padding = this.gridSize * 5;
    const gridStartX = Math.floor((startX - padding) / this.gridSize) * this.gridSize;
    const gridStartY = Math.floor((startY - padding) / this.gridSize) * this.gridSize;
    const gridEndX = Math.ceil((endX + padding) / this.gridSize) * this.gridSize;
    const gridEndY = Math.ceil((endY + padding) / this.gridSize) * this.gridSize;

    // Vertical lines
    for (let x = gridStartX; x <= gridEndX; x += this.gridSize) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x);
      line.setAttribute('y1', gridStartY);
      line.setAttribute('x2', x);
      line.setAttribute('y2', gridEndY);
      line.setAttribute('stroke', '#e0e0e0');
      line.setAttribute('stroke-width', x % 50 === 0 ? '1' : '0.5');
      this.gridLayer.appendChild(line);
    }

    // Horizontal lines
    for (let y = gridStartY; y <= gridEndY; y += this.gridSize) {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', gridStartX);
      line.setAttribute('y1', y);
      line.setAttribute('x2', gridEndX);
      line.setAttribute('y2', y);
      line.setAttribute('stroke', '#e0e0e0');
      line.setAttribute('stroke-width', y % 50 === 0 ? '1' : '0.5');
      this.gridLayer.appendChild(line);
    }
  }

  // ---------------------------------------------------------------------------
  // Render dispatch
  // ---------------------------------------------------------------------------

  render() {
    this.featureLayer.innerHTML = '';
    this.features.forEach(feature => {
      switch (feature.type) {
        case 'line':    this.renderLine(feature);    break;
        case 'pool':    this.renderPool(feature);    break;
        case 'anchor':  this.renderAnchor(feature);  break;
        case 'rappel':  this.renderRappel(feature);  break;
        case 'note':    this.renderNote(feature);    break;
        case 'access':  this.renderAccess(feature);  break;
        default:
          if (!(feature.type in TopoRenderer.FEATURE_SCHEMA)) {
            console.warn(`[topo] Unrecognized feature type "${feature.type}" (id=${feature.id}) — skipped`);
          }
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Feature render methods — visual elements only.
  // Each method appends the group to featureLayer and returns it so subclasses
  // can attach interactive elements.
  // ---------------------------------------------------------------------------

  renderLine(line) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', line.id);
    group.setAttribute('data-type', 'line');

    const x1 = line.x1;
    const y1 = line.y1;
    const x2 = line.x2;
    const y2 = line.y2;

    // Base straight line
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

    // Traverse curve on top if enabled
    if (line.traverse) {
      const traverseHeight = 10;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const dip = midY - traverseHeight / 2;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1},${y1 - traverseHeight} Q ${midX},${dip} ${x2},${y2 - traverseHeight}`);
      path.setAttribute('stroke', '#000');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('class', 'traverse-path');
      group.appendChild(path);
    }

    // Shorten slashes if enabled
    if (line.shorten) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const perpX = -dy / length;
      const perpY = dx / length;

      const slashLength = 8;
      const slashSpacing = 4;

      const slash1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      slash1.setAttribute('x1', midX - slashSpacing - perpX * slashLength);
      slash1.setAttribute('y1', midY - slashSpacing - perpY * slashLength);
      slash1.setAttribute('x2', midX - slashSpacing + perpX * slashLength);
      slash1.setAttribute('y2', midY - slashSpacing + perpY * slashLength);
      slash1.setAttribute('stroke', '#000');
      slash1.setAttribute('stroke-width', '3');
      slash1.setAttribute('stroke-linecap', 'round');
      slash1.setAttribute('class', 'shorten-slash');
      group.appendChild(slash1);

      const slash2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      slash2.setAttribute('x1', midX + slashSpacing - perpX * slashLength);
      slash2.setAttribute('y1', midY + slashSpacing - perpY * slashLength);
      slash2.setAttribute('x2', midX + slashSpacing + perpX * slashLength);
      slash2.setAttribute('y2', midY + slashSpacing + perpY * slashLength);
      slash2.setAttribute('stroke', '#000');
      slash2.setAttribute('stroke-width', '3');
      slash2.setAttribute('stroke-linecap', 'round');
      slash2.setAttribute('class', 'shorten-slash');
      group.appendChild(slash2);
    }

    // Arrowhead at end if enabled
    if (line.arrow) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const length = Math.sqrt(dx * dx + dy * dy);
      const ux = dx / length;
      const uy = dy / length;
      const perpX = -uy;
      const perpY = ux;
      const arrowSize = 10;
      const arrowWidth = 6;

      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      arrow.setAttribute('points',
        `${x2},${y2} ` +
        `${x2 - ux * arrowSize + perpX * arrowWidth},${y2 - uy * arrowSize + perpY * arrowWidth} ` +
        `${x2 - ux * arrowSize - perpX * arrowWidth},${y2 - uy * arrowSize - perpY * arrowWidth}`
      );
      arrow.setAttribute('fill', '#000');
      arrow.setAttribute('stroke', '#000');
      arrow.setAttribute('stroke-width', '1');
      arrow.setAttribute('class', 'arrow-head');
      group.appendChild(arrow);
    }

    this.featureLayer.appendChild(group);
    return group;
  }

  renderPool(pool) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', pool.id);
    group.setAttribute('data-type', 'pool');

    const cx = pool.x;
    const cy = pool.y;
    const width = pool.width;
    const depth = pool.depth;

    const startX = cx - width / 2;
    const endX = cx + width / 2;
    const controlOffset = depth * 0.552;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d',
      `M ${startX},${cy} C ${startX},${cy + controlOffset} ${endX},${cy + controlOffset} ${endX},${cy}`
    );
    path.setAttribute('fill', '#4a90e2');
    path.setAttribute('stroke', '#000000');
    path.setAttribute('stroke-width', '3');
    path.setAttribute('class', 'pool-shape');
    group.appendChild(path);

    this.featureLayer.appendChild(group);
    return group;
  }

  renderAnchor(anchor) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', anchor.id);
    group.setAttribute('data-type', 'anchor');

    const size = 7;
    const cx = anchor.x;
    const cy = anchor.y;
    const count = anchor.count || 1;
    const spacing = size + 3;
    const visualOffsetX = 10;
    const visualOffsetY = -10;

    for (let i = 0; i < count; i++) {
      const offsetX = i * spacing;

      const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line1.setAttribute('x1', cx + offsetX - size / 2 + visualOffsetX);
      line1.setAttribute('y1', cy - size / 2 + visualOffsetY);
      line1.setAttribute('x2', cx + offsetX + size / 2 + visualOffsetX);
      line1.setAttribute('y2', cy + size / 2 + visualOffsetY);
      line1.setAttribute('stroke', '#000');
      line1.setAttribute('stroke-width', '2');
      line1.setAttribute('stroke-linecap', 'round');
      line1.setAttribute('class', 'anchor-line');
      group.appendChild(line1);

      const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line2.setAttribute('x1', cx + offsetX + size / 2 + visualOffsetX);
      line2.setAttribute('y1', cy - size / 2 + visualOffsetY);
      line2.setAttribute('x2', cx + offsetX - size / 2 + visualOffsetX);
      line2.setAttribute('y2', cy + size / 2 + visualOffsetY);
      line2.setAttribute('stroke', '#000');
      line2.setAttribute('stroke-width', '2');
      line2.setAttribute('stroke-linecap', 'round');
      line2.setAttribute('class', 'anchor-line');
      group.appendChild(line2);
    }

    // Name label (displayed to the right of the last X mark)
    if (anchor.name) {
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', cx + visualOffsetX + (count - 1) * spacing + size);
      text.setAttribute('y', cy + visualOffsetY);
      text.setAttribute('font-size', '12');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('fill', '#333');
      text.setAttribute('class', 'anchor-name');
      text.textContent = anchor.name;
      group.appendChild(text);
    }

    this.featureLayer.appendChild(group);
    return group;
  }

  renderRappel(rappel) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', rappel.id);
    group.setAttribute('data-type', 'rappel');

    const x1 = rappel.x;
    const y1 = rappel.y;
    const length = rappel.length;
    const slope = rappel.slope;

    const slopeRadians = (slope * Math.PI) / 180;

    const x2 = x1 + length * Math.cos(slopeRadians);
    const y2 = y1 + length * Math.sin(slopeRadians);

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

    // Curved path
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${startX},${startY} Q ${controlX},${controlY} ${endX},${endY}`);
    path.setAttribute('stroke', '#666');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('fill', 'none');
    path.setAttribute('class', 'rappel-curve');
    group.appendChild(path);

    // Arrowhead at the end (tangent to the curve)
    const dx = endX - controlX;
    const dy = endY - controlY;
    const tangentLength = Math.sqrt(dx * dx + dy * dy);
    const tangentX = dx / tangentLength;
    const tangentY = dy / tangentLength;

    const arrowheadLength = 10;
    const arrowWidth = 6;
    const arrowForwardOffset = 5;

    const arrowTipX = endX + tangentX * arrowForwardOffset;
    const arrowTipY = endY + tangentY * arrowForwardOffset;
    const arrowPerpX = -tangentY;
    const arrowPerpY = tangentX;

    const base1X = arrowTipX - tangentX * arrowheadLength + arrowPerpX * arrowWidth;
    const base1Y = arrowTipY - tangentY * arrowheadLength + arrowPerpY * arrowWidth;
    const base2X = arrowTipX - tangentX * arrowheadLength - arrowPerpX * arrowWidth;
    const base2Y = arrowTipY - tangentY * arrowheadLength - arrowPerpY * arrowWidth;

    const arrowhead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrowhead.setAttribute('points', `${arrowTipX},${arrowTipY} ${base1X},${base1Y} ${base2X},${base2Y}`);
    arrowhead.setAttribute('fill', '#666');
    arrowhead.setAttribute('stroke', '#666');
    arrowhead.setAttribute('stroke-width', '1');
    arrowhead.setAttribute('class', 'rappel-arrowhead');
    group.appendChild(arrowhead);

    // Description text if present
    if (rappel.description) {
      const textOffsetX = rappel.textOffsetX || 0;
      const textOffsetY = rappel.textOffsetY || 0;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', controlX + perpX * 15 + textOffsetX);
      text.setAttribute('y', controlY + perpY * 15 - 20 + textOffsetY);
      text.setAttribute('font-size', '14');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('fill', '#666');
      text.setAttribute('class', 'rappel-description');
      text.textContent = rappel.description;
      group.appendChild(text);
    }

    this.featureLayer.appendChild(group);
    return group;
  }

  // Draw the icon shapes for a note into an existing group element.
  // Clears any existing .note-icon children first so it can be called
  // on both initial render and updates.
  drawNoteIconElements(group, cx, cy, size, iconType) {
    group.querySelectorAll('.note-icon').forEach(el => el.remove());

    switch (iconType || 'warning') {
      case 'warning': {
        // Yellow equilateral triangle with hardcoded !
        const h = size * Math.sqrt(3) / 2;
        const topY = cy - h * 2 / 3;
        const botY = cy + h / 3;
        const tri = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        tri.setAttribute('points', `${cx},${topY} ${cx - size/2},${botY} ${cx + size/2},${botY}`);
        tri.setAttribute('fill', '#FFD700');
        tri.setAttribute('stroke', '#000');
        tri.setAttribute('stroke-width', '2');
        tri.setAttribute('class', 'note-icon');
        group.appendChild(tri);
        const excl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        excl.setAttribute('x', cx);
        excl.setAttribute('y', cy + size * 0.18);
        excl.setAttribute('text-anchor', 'middle');
        excl.setAttribute('font-size', size * 0.5);
        excl.setAttribute('font-weight', 'bold');
        excl.setAttribute('fill', '#333');
        excl.setAttribute('class', 'note-icon');
        excl.textContent = '!';
        group.appendChild(excl);
        break;
      }
      case 'swim': {
        // Three horizontal blue wavy lines
        const ww = size * 0.8;
        const wh = size * 0.14;
        const sx = cx - ww / 2;
        [-size * 0.22, 0, size * 0.22].forEach(dy => {
          const y = cy + dy;
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('d',
            `M ${sx},${y} q ${ww/4},${-wh} ${ww/2},0 q ${ww/4},${wh} ${ww/2},0`
          );
          path.setAttribute('stroke', '#2980b9');
          path.setAttribute('stroke-width', Math.max(1.5, size * 0.08));
          path.setAttribute('fill', 'none');
          path.setAttribute('stroke-linecap', 'round');
          path.setAttribute('class', 'note-icon');
          group.appendChild(path);
        });
        break;
      }
      case 'keeper': {
        // Dark filled circle (pothole) with lighter inner highlight
        const outer = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        outer.setAttribute('cx', cx);
        outer.setAttribute('cy', cy);
        outer.setAttribute('r', size / 2);
        outer.setAttribute('fill', '#1a1a2e');
        outer.setAttribute('stroke', '#000');
        outer.setAttribute('stroke-width', '2');
        outer.setAttribute('class', 'note-icon');
        group.appendChild(outer);
        const inner = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        inner.setAttribute('cx', cx + size * 0.08);
        inner.setAttribute('cy', cy - size * 0.08);
        inner.setAttribute('rx', size * 0.18);
        inner.setAttribute('ry', size * 0.12);
        inner.setAttribute('fill', 'none');
        inner.setAttribute('stroke', '#666');
        inner.setAttribute('stroke-width', '1.5');
        inner.setAttribute('class', 'note-icon');
        group.appendChild(inner);
        break;
      }
      case 'flood': {
        // Orange lightning bolt
        const s = size * 0.42;
        const bolt = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        bolt.setAttribute('points',
          `${cx + s*0.28},${cy - s} ` +
          `${cx - s*0.14},${cy + s*0.08} ` +
          `${cx + s*0.1},${cy + s*0.08} ` +
          `${cx - s*0.28},${cy + s} ` +
          `${cx + s*0.14},${cy - s*0.08} ` +
          `${cx - s*0.1},${cy - s*0.08}`
        );
        bolt.setAttribute('fill', '#e67e22');
        bolt.setAttribute('stroke', '#c0392b');
        bolt.setAttribute('stroke-width', '1');
        bolt.setAttribute('stroke-linejoin', 'round');
        bolt.setAttribute('class', 'note-icon');
        group.appendChild(bolt);
        break;
      }
      case 'cold': {
        // Blue snowflake — 6 arms with crossbars
        const r = size * 0.44;
        const cr = size * 0.15;
        const sw = Math.max(1.5, size * 0.08);
        for (let i = 0; i < 6; i++) {
          const angle = i * Math.PI / 3;
          const ex = cx + r * Math.cos(angle);
          const ey = cy + r * Math.sin(angle);
          const arm = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          arm.setAttribute('x1', cx); arm.setAttribute('y1', cy);
          arm.setAttribute('x2', ex); arm.setAttribute('y2', ey);
          arm.setAttribute('stroke', '#2980b9');
          arm.setAttribute('stroke-width', sw);
          arm.setAttribute('stroke-linecap', 'round');
          arm.setAttribute('class', 'note-icon');
          group.appendChild(arm);
          const mx = cx + r * 0.58 * Math.cos(angle);
          const my = cy + r * 0.58 * Math.sin(angle);
          const pa = angle + Math.PI / 2;
          const cb = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          cb.setAttribute('x1', mx - cr * Math.cos(pa)); cb.setAttribute('y1', my - cr * Math.sin(pa));
          cb.setAttribute('x2', mx + cr * Math.cos(pa)); cb.setAttribute('y2', my + cr * Math.sin(pa));
          cb.setAttribute('stroke', '#2980b9');
          cb.setAttribute('stroke-width', sw * 0.85);
          cb.setAttribute('stroke-linecap', 'round');
          cb.setAttribute('class', 'note-icon');
          group.appendChild(cb);
        }
        break;
      }
      case 'constriction': {
        // Two rock wedges pointing inward, leaving a narrow gap
        const gap = size * 0.08;
        const w   = size * 0.45;
        const h   = size * 0.42;
        const left = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        left.setAttribute('points',
          `${cx - w},${cy - h} ${cx - gap},${cy} ${cx - w},${cy + h}`
        );
        left.setAttribute('fill', '#7f8c8d');
        left.setAttribute('stroke', '#000');
        left.setAttribute('stroke-width', '1.5');
        left.setAttribute('stroke-linejoin', 'round');
        left.setAttribute('class', 'note-icon');
        group.appendChild(left);
        const right = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        right.setAttribute('points',
          `${cx + w},${cy - h} ${cx + gap},${cy} ${cx + w},${cy + h}`
        );
        right.setAttribute('fill', '#7f8c8d');
        right.setAttribute('stroke', '#000');
        right.setAttribute('stroke-width', '1.5');
        right.setAttribute('stroke-linejoin', 'round');
        right.setAttribute('class', 'note-icon');
        group.appendChild(right);
        break;
      }
      case 'rockfall': {
        // Two falling rock polygons + downward arrow
        const rs = size * 0.22;
        // Rock 1 (upper left)
        const r1 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        r1.setAttribute('points',
          `${cx - rs*1.1},${cy - rs*1.1} ` +
          `${cx - rs*0.3},${cy - rs*1.4} ` +
          `${cx + rs*0.1},${cy - rs*0.6} ` +
          `${cx - rs*0.7},${cy - rs*0.3}`
        );
        r1.setAttribute('fill', '#7f8c8d');
        r1.setAttribute('stroke', '#000');
        r1.setAttribute('stroke-width', '1');
        r1.setAttribute('class', 'note-icon');
        group.appendChild(r1);
        // Rock 2 (lower right)
        const r2 = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        r2.setAttribute('points',
          `${cx + rs*0.4},${cy + rs*0.1} ` +
          `${cx + rs*1.2},${cy - rs*0.3} ` +
          `${cx + rs*1.3},${cy + rs*0.6} ` +
          `${cx + rs*0.5},${cy + rs*0.7}`
        );
        r2.setAttribute('fill', '#7f8c8d');
        r2.setAttribute('stroke', '#000');
        r2.setAttribute('stroke-width', '1');
        r2.setAttribute('class', 'note-icon');
        group.appendChild(r2);
        // Downward arrow in the middle
        const arrowX = cx - rs * 0.1;
        const ay1 = cy - rs * 0.2;
        const ay2 = cy + rs * 1.5;
        const aw = rs * 0.6;
        const arr = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        arr.setAttribute('d',
          `M ${arrowX},${ay1} L ${arrowX},${ay2} ` +
          `M ${arrowX - aw},${ay2 - aw} L ${arrowX},${ay2} L ${arrowX + aw},${ay2 - aw}`
        );
        arr.setAttribute('stroke', '#c0392b');
        arr.setAttribute('stroke-width', '2');
        arr.setAttribute('fill', 'none');
        arr.setAttribute('stroke-linecap', 'round');
        arr.setAttribute('stroke-linejoin', 'round');
        arr.setAttribute('class', 'note-icon');
        group.appendChild(arr);
        break;
      }
    }
  }

  renderNote(note) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', note.id);
    group.setAttribute('data-type', 'note');

    const cx = note.x;
    const cy = note.y;
    const size = note.size;

    this.drawNoteIconElements(group, cx, cy, size, note.iconType);

    // Label text placed next to the icon
    if (note.text) {
      const textOffsetX = note.textOffsetX || 0;
      const textOffsetY = note.textOffsetY || 0;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', cx + size * 0.65 + textOffsetX);
      text.setAttribute('y', cy + 5 + textOffsetY);
      text.setAttribute('font-size', '12');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('fill', '#333');
      text.setAttribute('class', 'note-text');
      text.textContent = note.text;
      group.appendChild(text);
    }

    this.featureLayer.appendChild(group);
    return group;
  }

  renderAccess(access) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', access.id);
    group.setAttribute('data-type', 'access');

    const accessType = access.accessType || 'exit';
    const color = accessType === 'entrance' ? '#27ae60' : '#000';

    const x1 = access.x;
    const y1 = access.y;
    // Exit goes NE (-45°), entrance goes NW (-135°) so connection point is at SE end
    const angle = accessType === 'entrance' ? -3 * Math.PI / 4 : -Math.PI / 4;
    const x2 = x1 + access.length * Math.cos(angle);
    const y2 = y1 + access.length * Math.sin(angle);

    // Pull the visual line back from the connection point so it doesn't overlap the dot
    const shorten = 8;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const lineX1 = x1 + dx * shorten;
    const lineY1 = y1 + dy * shorten;

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', lineX1);
    line.setAttribute('y1', lineY1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke', color);
    line.setAttribute('stroke-width', '5');
    line.setAttribute('stroke-linecap', 'round');
    line.setAttribute('class', 'access-line');
    group.appendChild(line);

    const perpX = -dy;
    const perpY = dx;
    const arrowSize = 10;
    const arrowWidth = 6;

    // Exit: tip pushed slightly beyond far end (NE); entrance: tip pulled back from connection point (NW)
    const arrowOffset = 5;
    let tipX, tipY, dirX, dirY;
    if (accessType === 'entrance') {
      tipX = x1 + dx * arrowOffset;
      tipY = y1 + dy * arrowOffset;
      dirX = -dx;
      dirY = -dy;
    } else {
      tipX = x2 + dx * arrowOffset;
      tipY = y2 + dy * arrowOffset;
      dirX = dx;
      dirY = dy;
    }

    const arrowhead = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    arrowhead.setAttribute('points',
      `${tipX},${tipY} ` +
      `${tipX - dirX * arrowSize + perpX * arrowWidth},${tipY - dirY * arrowSize + perpY * arrowWidth} ` +
      `${tipX - dirX * arrowSize - perpX * arrowWidth},${tipY - dirY * arrowSize - perpY * arrowWidth}`
    );
    arrowhead.setAttribute('fill', color);
    arrowhead.setAttribute('stroke', color);
    arrowhead.setAttribute('stroke-width', '1');
    arrowhead.setAttribute('class', 'access-arrowhead');
    group.appendChild(arrowhead);

    this.featureLayer.appendChild(group);
    return group;
  }

  // ---------------------------------------------------------------------------
  // Event listeners — pan + zoom only
  // ---------------------------------------------------------------------------

  attachEventListeners() {
    // Mouse wheel zoom — zooms toward the cursor position
    this.svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;

      // Cursor in SVG coords before zoom
      const rect = this.svg.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const svgX = this.panX + (screenX / rect.width)  * (this.width  / this.zoomLevel);
      const svgY = this.panY + (screenY / rect.height) * (this.height / this.zoomLevel);

      // Apply zoom
      this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomDelta));

      // Adjust pan so the same SVG point stays under the cursor
      this.panX = svgX - (screenX / rect.width)  * (this.width  / this.zoomLevel);
      this.panY = svgY - (screenY / rect.height) * (this.height / this.zoomLevel);

      this.applyViewTransform();
    });

    // Pan with middle mouse button
    this.svg.addEventListener('mousedown', (e) => {
      if (e.button === 1) {
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.svg.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    this.svg.addEventListener('mousemove', (e) => {
      if (this.isPanning) {
        const dx = (this.panStartX - e.clientX) / this.zoomLevel;
        const dy = (this.panStartY - e.clientY) / this.zoomLevel;
        this.panX += dx;
        this.panY += dy;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.applyViewTransform();
      }
    });

    document.addEventListener('mouseup', (e) => {
      if (this.isPanning && e.button === 1) {
        this.isPanning = false;
        this.svg.style.cursor = 'default';
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Coordinate conversion
  // ---------------------------------------------------------------------------

  screenToSVGCoords(e) {
    const rect = this.svg.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const viewWidth = this.width / this.zoomLevel;
    const viewHeight = this.height / this.zoomLevel;

    const svgX = this.panX + (screenX / rect.width) * viewWidth;
    const svgY = this.panY + (screenY / rect.height) * viewHeight;

    return { x: svgX, y: svgY };
  }

  // ---------------------------------------------------------------------------
  // Zoom / pan
  // ---------------------------------------------------------------------------

  zoomIn() {
    this.setZoom(this.zoomLevel * 1.25);
  }

  zoomOut() {
    this.setZoom(this.zoomLevel / 1.25);
  }

  resetView() {
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.applyViewTransform();
  }

  fitToContent() {
    if (!this.features || this.features.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const expand = (x, y) => {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
    };

    this.features.forEach(f => {
      switch (f.type) {
        case 'line':
          expand(f.x1, f.y1);
          expand(f.x2, f.y2);
          break;
        case 'pool':
          expand(f.x - f.width / 2, f.y);
          expand(f.x + f.width / 2, f.y + f.depth);
          break;
        case 'anchor':
          expand(f.x, f.y);
          break;
        case 'rappel': {
          const rad = (f.slope * Math.PI) / 180;
          expand(f.x, f.y);
          expand(f.x + f.length * Math.cos(rad), f.y + f.length * Math.sin(rad));
          break;
        }
        case 'note':
          expand(f.x - f.size, f.y - f.size);
          expand(f.x + f.size, f.y + f.size);
          break;
        case 'access': {
          const angle = (f.accessType === 'entrance') ? -3 * Math.PI / 4 : -Math.PI / 4;
          expand(f.x, f.y);
          expand(f.x + f.length * Math.cos(angle), f.y + f.length * Math.sin(angle));
          break;
        }
      }
    });

    if (!isFinite(minX)) return;

    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    const zoom = Math.min(
      this.width / contentWidth,
      this.height / contentHeight,
      this.maxZoom
    );
    this.zoomLevel = Math.max(this.minZoom, zoom);

    const viewWidth = this.width / this.zoomLevel;
    const viewHeight = this.height / this.zoomLevel;
    this.panX = minX + (contentWidth - viewWidth) / 2;
    this.panY = minY + (contentHeight - viewHeight) / 2;

    this.applyViewTransform();
  }

  setZoom(newZoom) {
    this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
    this.applyViewTransform();
  }

  applyViewTransform() {
    const viewWidth = this.width / this.zoomLevel;
    const viewHeight = this.height / this.zoomLevel;

    this.svg.setAttribute('viewBox', `${this.panX} ${this.panY} ${viewWidth} ${viewHeight}`);

    const zoomDisplay = document.getElementById('zoom-display');
    if (zoomDisplay) {
      zoomDisplay.textContent = `${Math.round(this.zoomLevel * 100)}%`;
    }

    // Redraw grid to cover newly visible area.
    // The viewer subclass overrides drawGrid() to a no-op, so this is safe.
    this.drawGrid();
  }
}

// ---------------------------------------------------------------------------
// Feature schema — single source of truth for valid types, fields, subtypes,
// and legacy migrations. Used by render() and loadFromYAML().
// ---------------------------------------------------------------------------

TopoRenderer.FEATURE_SCHEMA = {
  line: {
    fields: new Set(['type', 'id', 'x1', 'y1', 'x2', 'y2', 'slope', 'length', 'arrow', 'shorten', 'traverse']),
  },
  rappel: {
    fields: new Set(['type', 'id', 'x', 'y', 'length', 'slope', 'curveOffset', 'curvePosition', 'description', 'textOffsetX', 'textOffsetY']),
  },
  pool: {
    fields: new Set(['type', 'id', 'x', 'y', 'width', 'depth']),
  },
  anchor: {
    fields: new Set(['type', 'id', 'x', 'y', 'size', 'connectionX', 'connectionY', 'anchorType', 'count', 'name']),
    subtypes: { anchorType: ['bolt', 'natural', 'piton', 'tree', 'rock'] },
  },
  note: {
    fields: new Set(['type', 'id', 'x', 'y', 'size', 'iconType', 'text', 'textOffsetX', 'textOffsetY']),
    subtypes: { iconType: ['warning', 'swim', 'keeper', 'flood', 'cold', 'constriction', 'rockfall'] },
  },
  access: {
    fields: new Set(['type', 'id', 'x', 'y', 'length', 'accessType']),
    subtypes: { accessType: ['exit', 'entrance'] },
  },
};

// Migrations applied by loadFromYAML() before field validation.
// Each entry: { from: oldType, to: newType, defaults: { field: defaultValue, ... } }
TopoRenderer.FEATURE_MIGRATIONS = [
  { from: 'exit',   to: 'access', defaults: { accessType: 'exit' } },
  { from: 'hazard', to: 'note',   defaults: { iconType: 'warning' } },
];
