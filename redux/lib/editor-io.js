// Canyon Topo Editor — IO/save/undo methods
// Loaded after editor.js; extends TopoEditor.prototype

Object.assign(TopoEditor.prototype, {

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
  },

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.restoreState(this.history[this.historyIndex]);
      this.updateUndoRedoButtons();
      console.log('Undo - restored to history index:', this.historyIndex);
    }
  },

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.restoreState(this.history[this.historyIndex]);
      this.updateUndoRedoButtons();
      console.log('Redo - restored to history index:', this.historyIndex);
    }
  },

  restoreState(state) {
    // Restore features and nextId
    this.features = JSON.parse(JSON.stringify(state.features));
    this.nextId = state.nextId;

    // Re-render everything
    this.render();
    this.selectFeature(null);
  },

  updateUndoRedoButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');

    if (undoBtn) {
      undoBtn.disabled = this.historyIndex <= 0;
    }
    if (redoBtn) {
      redoBtn.disabled = this.historyIndex >= this.history.length - 1;
    }
  },

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
  },

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
  },

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
  },

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
  },

  // ---------------------------------------------------------------------------
  // MediaWiki save
  // ---------------------------------------------------------------------------

  isEditMode() {
    return typeof mw !== 'undefined' && mw.config.get('wgAction') === 'edit-topo';
  },

  wikiPageName() {
    return typeof mw !== 'undefined' ? mw.config.get('wgPageName') : null;
  },

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
  },

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
  },

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

});
