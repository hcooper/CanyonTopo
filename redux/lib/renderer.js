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
    this.applyViewTransform();  // Set initial viewBox and draw grid
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
        case 'metadata': this.renderMetadata(feature); break;
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

    // Calculate line direction and length
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / length;  // Unit vector x
    const uy = dy / length;  // Unit vector y

    // Dashed segment length
    const dashedLength = 30;

    // Calculate adjusted endpoints if we have dashed start/end
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

    // Dashed segment at start
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
      group.appendChild(dashedStart);
    }

    // Solid middle segment (or full line if no dashes)
    const lineElem = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    lineElem.setAttribute('x1', startX);
    lineElem.setAttribute('y1', startY);
    lineElem.setAttribute('x2', endX);
    lineElem.setAttribute('y2', endY);
    lineElem.setAttribute('stroke', '#000');
    lineElem.setAttribute('stroke-width', '3');
    lineElem.setAttribute('stroke-linecap', 'round');
    lineElem.setAttribute('class', 'line-shape');
    group.appendChild(lineElem);

    // Dashed segment at end
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
      group.appendChild(dashedEnd);
    }

    // Traverse curve on top if enabled
    if (line.traverse) {
      const traverseHeight = 10;
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const dip = midY - traverseHeight / 2;

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', `M ${x1},${y1 - traverseHeight} Q ${midX},${dip} ${x2},${y2 - traverseHeight}`);
      path.setAttribute('stroke', '#666');
      path.setAttribute('stroke-width', '3');
      path.setAttribute('fill', 'none');
      path.setAttribute('class', 'traverse-path');
      group.appendChild(path);
    }

    // Shorten slashes if enabled
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
      group.appendChild(slash1);

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

    // Support both old (depth) and new (leftDepth/rightDepth) formats
    const leftDepth = pool.leftDepth !== undefined ? pool.leftDepth : (pool.depth || 30);
    const rightDepth = pool.rightDepth !== undefined ? pool.rightDepth : (pool.depth || 30);

    const startX = cx - width / 2;
    const endX = cx + width / 2;
    const leftControlOffset = leftDepth * 0.552;
    const rightControlOffset = rightDepth * 0.552;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d',
      `M ${startX},${cy} C ${startX},${cy + leftControlOffset} ${endX},${cy + rightControlOffset} ${endX},${cy}`
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
    const anchorType = anchor.anchorType || 'bolt';

    for (let i = 0; i < count; i++) {
      const offsetX = i * spacing;

      if (anchorType === 'natural') {
        // Render "N" for natural anchors
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', cx + offsetX + visualOffsetX);
        text.setAttribute('y', cy + visualOffsetY + size * 0.3);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-size', size * 1.8);
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('fill', '#000');
        text.setAttribute('class', 'anchor-line');
        text.textContent = 'N';
        group.appendChild(text);
      } else {
        // Render X for bolt anchors
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
    }

    // Name label (displayed to the right of the last X mark, draggable)
    if (anchor.name) {
      const nameOffsetX = anchor.nameOffsetX || 0;
      const nameOffsetY = anchor.nameOffsetY || 0;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', cx + visualOffsetX + (count - 1) * spacing + size + nameOffsetX);
      text.setAttribute('y', cy + visualOffsetY + nameOffsetY);
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

    // Description text if present (supports multiline with \n)
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

      // Split on newlines and create a tspan for each line
      const lines = rappel.description.split('\n');
      const lineHeight = 16;
      lines.forEach((line, i) => {
        const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
        tspan.setAttribute('x', controlX + perpX * 15 + textOffsetX);
        tspan.setAttribute('dy', i === 0 ? '0' : lineHeight);
        tspan.textContent = line;
        text.appendChild(tspan);
      });

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
      case 'water': {
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
      case 'hydraulic': {
        // Two curved arrows forming a recirculation/repeat loop
        // Direct copy from new.svg, scaled and positioned
        const scale = size / 512;  // new.svg is 512x512 viewBox

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        // Exact path from new.svg
        const d = "M69.816,256H0l93.096,93.096L186.2,256h-69.816c0.224-77.016,62.6-139.4,139.616-139.632 c22.672,0.432,44.952,6,65.16,16.296l34.896-34.896C325.6,80.144,291.176,70.528,256,69.832 C153.296,70.112,70.104,153.296,69.816,256z M395.616,256c-0.224,77.016-62.6,139.4-139.616,139.632 c-22.672-0.432-44.952-6-65.16-16.296l-34.896,34.896c30.456,17.624,64.88,27.24,100.056,27.936 C358.696,441.872,441.88,358.696,442.184,256H512l-93.096-93.096L325.8,256H395.616z";

        path.setAttribute('d', d);
        path.setAttribute('fill', '#2980b9');
        path.setAttribute('class', 'note-icon');

        // Transform to scale and center at (cx, cy)
        // Original is centered at 256,256 in a 512x512 viewBox
        const translateX = cx - 256 * scale;
        const translateY = cy - 256 * scale;
        path.setAttribute('transform', `translate(${translateX}, ${translateY}) scale(${scale})`);

        group.appendChild(path);

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
      case 'info':
        // No icon — text-only label (icon remains visible in UI picker)
        break;
      case 'name':
        // No icon — text-only label rendered in italic by renderNote()
        break;
      case 'bridge': {
        // Circle background (white fill with black stroke)
        const circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circ.setAttribute('cx', cx);
        circ.setAttribute('cy', cy);
        circ.setAttribute('r', size / 2);
        circ.setAttribute('fill', '#fff');
        circ.setAttribute('stroke', '#000');
        circ.setAttribute('stroke-width', '2');
        circ.setAttribute('class', 'note-icon');
        group.appendChild(circ);

        // Bridge design from bridge.svg
        // SVG center is at (42.017296, 197.19461) with radius 36.175068
        const svgCenterX = 42.017296;
        const svgCenterY = 197.19461;
        const svgRadius = 36.175068;
        const scale = (size * 0.9) / (2 * svgRadius);  // scale to 90% - bigger bridge

        // New bridge path from SVG
        // d="m 13.794594,199.47549 v -5.91031 h 3.869593 c 4.859659,0 5.90865,-0.36654 10.843989,-3.78918..."
        const bridgePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');

        // Transform the path data to our coordinate system
        // The path is complex, so we'll translate and scale it
        const pathData = `m 13.794594,199.47549 v -5.91031 h 3.869593 c 4.859659,0 5.90865,-0.36654 10.843989,-3.78918 2.201143,-1.5265 5.349008,-3.41338 6.99525,-4.19306 2.650536,-1.25534 3.421357,-1.41753 6.733705,-1.41682 3.435138,8.8e-4 4.006249,0.13286 6.99525,1.61905 1.790102,0.89004 4.631921,2.63055 6.315145,3.86782 4.730621,3.47725 5.880525,3.89147 10.83348,3.90259 l 4.275428,0.009 -0.121949,5.79296 -0.121948,5.79294 -10.164993,0.11732 -10.164976,0.11733 v -3.64935 c 0,-3.3119 -0.119636,-3.82987 -1.293434,-5.60206 -0.721811,-1.08972 -1.984295,-2.28218 -2.856658,-2.69817 -2.236355,-1.06644 -5.729114,-0.95699 -7.831905,0.24545 -2.882997,1.64859 -3.508819,2.89019 -3.757327,7.4545 l -0.218599,4.01489 -10.164976,0.11733 -10.164992,0.11732 v -5.91031 z`;

        // Scale and translate the path
        const offsetX = cx - svgCenterX * scale;
        const offsetY = cy - svgCenterY * scale;

        bridgePath.setAttribute('d', pathData);
        bridgePath.setAttribute('transform', `translate(${offsetX}, ${offsetY}) scale(${scale})`);
        bridgePath.setAttribute('fill', '#000');
        bridgePath.setAttribute('class', 'note-icon');
        group.appendChild(bridgePath);

        break;
      }
      default:
        console.warn(`[topo] Unknown note iconType "${iconType}" — rendering as warning`);
        this.drawNoteIconElements(group, cx, cy, size, 'warning');
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

    // Label text: 'name' and 'info' types have no icon so text is centered;
    // all other types sit to the right of the icon.
    if (note.text) {
      const textOffsetX = note.textOffsetX || 0;
      const textOffsetY = note.textOffsetY || 0;
      const isName = note.iconType === 'name';
      const isInfo = note.iconType === 'info';
      const hasNoIcon = isName || isInfo;
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', hasNoIcon ? cx + textOffsetX : cx + size * 0.65 + textOffsetX);
      text.setAttribute('y', cy + 5 + textOffsetY);
      text.setAttribute('font-size', '12');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('fill', '#333');
      if (isName) {
        text.setAttribute('font-style', 'italic');
        text.setAttribute('text-anchor', 'middle');
      } else if (isInfo) {
        text.setAttribute('text-anchor', 'middle');
      }
      text.setAttribute('class', 'note-text');

      // Support multiline text with \n
      const lines = note.text.split('\n');
      if (lines.length > 1) {
        const lineHeight = 14;
        lines.forEach((line, i) => {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
          tspan.setAttribute('x', hasNoIcon ? cx + textOffsetX : cx + size * 0.65 + textOffsetX);
          tspan.setAttribute('dy', i === 0 ? '0' : lineHeight);
          tspan.textContent = line;
          text.appendChild(tspan);
        });
      } else {
        text.textContent = note.text;
      }

      group.appendChild(text);
    }

    this.featureLayer.appendChild(group);

    // For 'name' type, add a rectangle box around the text (after DOM insertion for getBBox)
    if (note.text && note.iconType === 'name') {
      const textEl = group.querySelector('.note-text');
      if (textEl) {
        const bbox = textEl.getBBox();
        const padding = 4;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', bbox.x - padding);
        rect.setAttribute('y', bbox.y - padding);
        rect.setAttribute('width', bbox.width + padding * 2);
        rect.setAttribute('height', bbox.height + padding * 2);
        rect.setAttribute('fill', 'none');
        rect.setAttribute('stroke', '#000');
        rect.setAttribute('stroke-width', '1');
        rect.setAttribute('class', 'note-icon');
        // Insert before the text so the text renders on top
        group.insertBefore(rect, textEl);
      }
    }

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

    // Text label (draggable, similar to rappel descriptions)
    if (access.text) {
      const textOffsetX = access.textOffsetX || 0;
      const textOffsetY = access.textOffsetY || 0;

      // Position text to the side of the access line
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', midX + textOffsetX);
      text.setAttribute('y', midY + textOffsetY);
      text.setAttribute('font-size', '12');
      text.setAttribute('font-family', 'Arial, sans-serif');
      text.setAttribute('fill', color);
      text.setAttribute('class', 'access-text');
      text.textContent = access.text;
      group.appendChild(text);
    }

    this.featureLayer.appendChild(group);
    return group;
  }

  renderMetadata(metadata) {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    group.setAttribute('data-id', metadata.id);
    group.setAttribute('data-type', 'metadata');

    const x = metadata.x;
    let y = metadata.y;

    // Title (if present)
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
      group.appendChild(titleText);
      y += 22; // Move down for next line
    }

    // Grade (if present)
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
      group.appendChild(gradeText);
      y += 18; // Move down for next line
    }

    // Date (if timestamp present)
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
      group.appendChild(dateText);
    }

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
        case 'metadata':
          // Text box - expand based on position (approximate bounds for right-aligned text)
          expand(f.x - 200, f.y - 10);  // Left side (for long titles)
          expand(f.x + 20, f.y + 50);   // Right side + height for 3 lines
          break;
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
    fields: new Set(['type', 'id', 'x1', 'y1', 'x2', 'y2', 'slope', 'length', 'arrow', 'shorten', 'traverse', 'dashedStart', 'dashedEnd']),
  },
  rappel: {
    fields: new Set(['type', 'id', 'x', 'y', 'length', 'slope', 'curveOffset', 'curvePosition', 'description', 'textOffsetX', 'textOffsetY']),
  },
  pool: {
    fields: new Set(['type', 'id', 'x', 'y', 'width', 'depth', 'leftDepth', 'rightDepth']),
  },
  anchor: {
    fields: new Set(['type', 'id', 'x', 'y', 'size', 'connectionX', 'connectionY', 'anchorType', 'count', 'name', 'nameOffsetX', 'nameOffsetY']),
    subtypes: { anchorType: ['bolt', 'natural', 'piton', 'tree', 'rock'] },
  },
  note: {
    fields: new Set(['type', 'id', 'x', 'y', 'size', 'iconType', 'text', 'textOffsetX', 'textOffsetY']),
    subtypes: { iconType: ['info', 'warning', 'water', 'hydraulic', 'rockfall', 'name', 'bridge'] },
  },
  access: {
    fields: new Set(['type', 'id', 'x', 'y', 'length', 'accessType', 'text', 'textOffsetX', 'textOffsetY']),
    subtypes: { accessType: ['exit', 'entrance'] },
  },
  metadata: {
    fields: new Set(['type', 'id', 'x', 'y', 'title', 'grade', 'timestamp']),
  },
};

// Migrations applied by loadFromYAML() before field validation.
// Each entry: { from: oldType, to: newType, defaults: { field: defaultValue, ... } }
TopoRenderer.FEATURE_MIGRATIONS = [
  { from: 'exit',   to: 'access', defaults: { accessType: 'exit' } },
  { from: 'hazard', to: 'note',   defaults: { iconType: 'warning' } },
  { from: 'keeper', to: 'note',   defaults: { iconType: 'hydraulic' } },
];
