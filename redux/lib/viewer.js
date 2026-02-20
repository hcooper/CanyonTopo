// TopoViewer - read-only view of a canyon topo

class TopoViewer extends TopoRenderer {
  constructor(containerId) {
    super(containerId); // sets container, width=800, height=600, gridSize, features, zoom/pan state

    // Viewer uses larger default dimensions than the editor
    this.width = 800;
    this.height = 600;

    this.init();
  }

  init() {
    super.init(); // createCanvas(), drawGrid() (no-op), attachEventListeners()
    this.createControls();
  }

  // Override to suppress grid drawing — the viewer shows no grid
  drawGrid() {}

  // Override to add left-click pan on top of the base middle-mouse pan + wheel zoom.
  attachEventListeners() {
    super.attachEventListeners();

    // Default cursor indicates the canvas is pannable
    this.svg.style.cursor = 'grab';

    this.svg.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        this.svg.style.cursor = 'grabbing';
        e.preventDefault();
      }
    });

    // mousemove panning is handled by the base class listener (checks this.isPanning)

    document.addEventListener('mouseup', (e) => {
      if (e.button === 0 && this.isPanning) {
        this.isPanning = false;
        this.svg.style.cursor = 'grab';
      }
    });
  }

  createControls() {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls';

    const zoomResetBtn = document.createElement('button');
    zoomResetBtn.textContent = '1:1';
    zoomResetBtn.title = 'Reset Zoom';
    zoomResetBtn.addEventListener('click', () => this.resetView());

    const zoomFitBtn = document.createElement('button');
    zoomFitBtn.textContent = 'Fit';
    zoomFitBtn.title = 'Fit to content';
    zoomFitBtn.addEventListener('click', () => this.fitToContent());

    const exportBtn = document.createElement('button');
    exportBtn.textContent = 'Export PNG';
    exportBtn.addEventListener('click', () => this.exportPNG());

    controlsDiv.appendChild(exportBtn);
    controlsDiv.appendChild(zoomResetBtn);
    controlsDiv.appendChild(zoomFitBtn);

    this.container.appendChild(controlsDiv);
  }

  loadFromYAML(yamlString) {
    try {
      const data = jsyaml.load(yamlString);

      if (!data.features || !Array.isArray(data.features)) {
        throw new Error('Invalid data: missing features array');
      }

      this.features = data.features;

      if (data.width) {
        this.width = data.width;
        this.svg.setAttribute('width', this.width);
      }
      if (data.height) {
        this.height = data.height;
        this.svg.setAttribute('height', this.height);
      }
      if (data.gridSize) this.gridSize = data.gridSize;

      this.title = data.title || '';
      this.grade = data.grade || '';
      this.titleX = data.titleX !== undefined ? data.titleX : null;
      this.titleY = data.titleY !== undefined ? data.titleY : null;
      this.gradeX = data.gradeX !== undefined ? data.gradeX : null;
      this.gradeY = data.gradeY !== undefined ? data.gradeY : null;

      this.render();
      this.fitToContent();
    } catch (err) {
      alert(`Failed to load topo: ${err.message}`);
    }
  }

  exportPNG() {
    // Calculate content bounds (same logic as fitToContent)
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
          expand(f.x + f.width / 2, f.y + Math.max(f.leftDepth || f.depth || 30, f.rightDepth || f.depth || 30));
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

    // Add padding
    const padding = 50;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Clone the SVG to avoid modifying the original
    const svgClone = this.svg.cloneNode(true);

    // Set viewBox to content area (fit to content)
    svgClone.setAttribute('viewBox', `${minX} ${minY} ${contentWidth} ${contentHeight}`);
    svgClone.setAttribute('width', contentWidth);
    svgClone.setAttribute('height', contentHeight);

    // Remove any editor-only layers that may not exist in the viewer but
    // guard defensively anyway
    ['#cursor-layer', '#grid-layer'].forEach(sel => {
      const el = svgClone.querySelector(sel);
      if (el) el.remove();
    });
    svgClone.querySelectorAll('.connection-point, .midpoint, .curve-midpoint')
      .forEach(el => el.remove());

    svgClone.style.backgroundColor = '#ffffff';

    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);

    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = contentWidth * scale;
    canvas.height = contentHeight * scale;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((pngBlob) => {
        const downloadUrl = URL.createObjectURL(pngBlob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = 'topo-export.png';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
        URL.revokeObjectURL(url);
      }, 'image/png');
    };

    img.onerror = () => {
      alert('Failed to export PNG.');
      URL.revokeObjectURL(url);
    };

    img.src = url;
  }

  loadFromFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml';

    input.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => this.loadFromYAML(event.target.result);
      reader.readAsText(file);
    });

    input.click();
  }
}

function loadViewerPage() {
  const mainContainer = document.createElement('div');
  mainContainer.className = 'main-container';

  const canvasSection = document.createElement('div');
  canvasSection.className = 'canvas-section';

  const canvasContainer = document.createElement('div');
  canvasContainer.id = 'canvas-container';
  canvasSection.appendChild(canvasContainer);

  mainContainer.appendChild(canvasSection);

  document.getElementById('topo-container').appendChild(mainContainer);
}

document.addEventListener('DOMContentLoaded', () => {
  // Only run the standalone viewer bootstrap when the dedicated container exists.
  // When viewer.js is loaded for inline {{#toposvg:}} embeds on regular wiki pages
  // this guard prevents a crash trying to build the UI in a non-existent element.
  if (!document.getElementById('topo-container')) return;
  loadViewerPage();
  window.topoViewer = new TopoViewer('canvas-container');
  if (typeof raw_yaml !== 'undefined' && raw_yaml) {
    window.topoViewer.loadFromYAML(raw_yaml);
  }
});
