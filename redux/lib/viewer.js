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

  createControls() {
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'controls';

    // Load File button
    const loadBtn = document.createElement('button');
    loadBtn.textContent = 'Load File';
    loadBtn.addEventListener('click', () => this.loadFromFile());

    // Zoom controls
    const zoomInBtn = document.createElement('button');
    zoomInBtn.textContent = '+';
    zoomInBtn.title = 'Zoom In';
    zoomInBtn.style.fontSize = '20px';
    zoomInBtn.addEventListener('click', () => this.zoomIn());

    const zoomOutBtn = document.createElement('button');
    zoomOutBtn.textContent = '−';
    zoomOutBtn.title = 'Zoom Out';
    zoomOutBtn.style.fontSize = '20px';
    zoomOutBtn.addEventListener('click', () => this.zoomOut());

    const zoomResetBtn = document.createElement('button');
    zoomResetBtn.textContent = '1:1';
    zoomResetBtn.title = 'Reset Zoom';
    zoomResetBtn.addEventListener('click', () => this.resetView());

    const zoomDisplay = document.createElement('span');
    zoomDisplay.id = 'zoom-display';
    zoomDisplay.style.padding = '0 10px';
    zoomDisplay.style.fontSize = '14px';
    zoomDisplay.textContent = '100%';

    controlsDiv.appendChild(loadBtn);
    controlsDiv.appendChild(zoomOutBtn);
    controlsDiv.appendChild(zoomDisplay);
    controlsDiv.appendChild(zoomInBtn);
    controlsDiv.appendChild(zoomResetBtn);

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

      this.render();
      this.fitToContent();
    } catch (err) {
      alert(`Failed to load topo: ${err.message}`);
    }
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

  document.body.appendChild(mainContainer);
}

document.addEventListener('DOMContentLoaded', () => {
  loadViewerPage();
  window.topoViewer = new TopoViewer('canvas-container');
  if (typeof raw_yaml !== 'undefined' && raw_yaml) {
    window.topoViewer.loadFromYAML(raw_yaml);
  }
});
