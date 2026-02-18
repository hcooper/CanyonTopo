// Canyon Topo Editor — feature list node-graph panel
// Loaded after editor-ui.js; extends TopoEditor.prototype
//
// Renders the feature list as a spine-flattened ASCII tree:
// the main route (spine) stays left-aligned; branches (anchors, notes,
// mid-route access features) indent to the right.

Object.assign(TopoEditor.prototype, {

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
        case 'note':
        case 'access':
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
  },

  renderFeatureList() {
    const featureListDiv = document.getElementById('feature-list');
    if (!featureListDiv) return;

    if (this.features.length === 0) {
      featureListDiv.innerHTML = '<p class="empty-state">No features yet</p>';
      return;
    }

    // --- Build adjacency list from shared connection points ---
    const adj = new Map();
    this.features.forEach(f => adj.set(f.id, []));

    const pointMap = new Map(); // "rx,ry" -> [id, ...]
    const addPt = (x, y, id) => {
      const key = `${Math.round(x)},${Math.round(y)}`;
      if (!pointMap.has(key)) pointMap.set(key, []);
      pointMap.get(key).push(id);
    };

    this.features.forEach(f => {
      if (f.type === 'line') {
        addPt(f.x1, f.y1, f.id);
        addPt(f.x2, f.y2, f.id);
      } else if (f.type === 'rappel') {
        const rad = f.slope * Math.PI / 180;
        addPt(f.x, f.y, f.id);
        addPt(f.x + f.length * Math.cos(rad), f.y + f.length * Math.sin(rad), f.id);
      } else if (f.type === 'pool') {
        addPt(f.x - f.width / 2, f.y, f.id);
        addPt(f.x + f.width / 2, f.y, f.id);
      } else if (f.type === 'anchor') {
        addPt(f.connectionX, f.connectionY, f.id);
      } else if (f.type === 'access') {
        addPt(f.x, f.y, f.id);
      }
      // notes: no connection points — always isolated
    });

    pointMap.forEach(ids => {
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          if (!adj.get(ids[i]).includes(ids[j])) adj.get(ids[i]).push(ids[j]);
          if (!adj.get(ids[j]).includes(ids[i])) adj.get(ids[j]).push(ids[i]);
        }
      }
    });

    // Sort each node's neighbour list top-to-bottom
    const getY = id => {
      const f = this.features.find(f => f.id === id);
      if (!f) return 0;
      if (f.type === 'anchor') return f.connectionY;
      if (f.type === 'line')   return f.y1;
      return f.y || 0;
    };
    adj.forEach(nbrs => nbrs.sort((a, b) => getY(a) - getY(b)));

    // --- Subtree size: count nodes reachable from id without passing through exclude ---
    const subtreeSize = (id, exclude) => {
      const seen = new Set([exclude]);
      let count = 0;
      const stack = [id];
      while (stack.length) {
        const n = stack.pop();
        if (seen.has(n)) continue;
        seen.add(n); count++;
        (adj.get(n) || []).forEach(nb => stack.push(nb));
      }
      return count;
    };

    // --- DFS with spine-flattening ---
    // isSpine=true: main-path continuation stays at same indent (no staircase).
    // isSpine=false: normal tree indentation for branch subtrees.
    const visited = new Set();
    const rows = [];

    const dfs = (id, indent, connector, isSpine) => {
      if (visited.has(id)) return;
      visited.add(id);
      const feature = this.features.find(f => f.id === id);
      if (!feature) return;

      rows.push({ feature, prefix: indent + connector });

      const unvisited = adj.get(id).filter(n => !visited.has(n));
      if (unvisited.length === 0) return;

      if (isSpine) {
        // Pick main continuation.
        // Priority 1: flow nodes (line/rappel/pool/access) beat metadata (anchor/note).
        // Priority 2: largest subtree.
        // Priority 3: highest Y (deeper into canyon).
        // Also: temporarily protect mainNid from being consumed by branch subtrees —
        // necessary because anchor+rappel share the same junction point and are mutually
        // adjacent, so without protection the branch (anchor) would visit the mainNid
        // (rappel) before the spine gets to it.
        let mainNid = null, branches = [];
        if (unvisited.length === 1) {
          mainNid = unvisited[0];
        } else {
          const ranked = unvisited
            .map(nid => {
              const feat = this.features.find(f => f.id === nid);
              const isFlow = (feat && feat.type !== 'anchor' && feat.type !== 'note') ? 1 : 0;
              return [nid, subtreeSize(nid, id), isFlow];
            })
            .sort((a, b) => b[2] - a[2] || b[1] - a[1] || getY(b[0]) - getY(a[0]));
          mainNid = ranked[0][0];
          branches = ranked.slice(1).map(r => r[0]);
          // Protect mainNid so branch DFS can't consume it
          visited.add(mainNid);
        }

        // Branches indent 3 spaces under this spine node
        const branchBase = indent + '   ';
        branches.forEach((nid, i) => {
          const isLast = i === branches.length - 1;
          dfs(nid, branchBase, isLast ? '└── ' : '├── ', false);
        });

        // Unprotect then visit main continuation at same indent
        if (branches.length > 0) visited.delete(mainNid);
        dfs(mainNid, indent, '── ', true);

      } else {
        // Normal branch DFS: all children indented one level
        const ownIsLast = connector.startsWith('└');
        const childBase = indent + (ownIsLast ? '    ' : '│   ');
        unvisited.forEach((nid, i) => {
          const isLast = i === unvisited.length - 1;
          dfs(nid, childBase, isLast ? '└── ' : '├── ', false);
        });
      }
    };

    // Traversal order: entrances first, then other degree-1 endpoints, then any remainder
    const byY = [...this.features].sort((a, b) => getY(a.id) - getY(b.id));
    byY.forEach(f => {
      if (!visited.has(f.id) && f.type === 'access' && (f.accessType || 'exit') === 'entrance')
        dfs(f.id, '', '', true);
    });
    byY.forEach(f => {
      if (!visited.has(f.id) && adj.get(f.id).length <= 1)
        dfs(f.id, '', '', true);
    });
    byY.forEach(f => { if (!visited.has(f.id)) dfs(f.id, '', '', true); });

    // --- Icon and label helpers ---
    const icon = f => {
      switch (f.type) {
        case 'line':    return '──';
        case 'rappel':  return '↓';
        case 'pool':    return '≋';
        case 'anchor':  return '✕';
        case 'note':    return '⚠';
        case 'access':  return (f.accessType || 'exit') === 'entrance' ? '↘' : '↗';
        default:        return '·';
      }
    };
    const label = f => {
      switch (f.type) {
        case 'line':    return 'Line';
        case 'rappel':  return 'Rappel' + (f.description ? ` — ${f.description}` : '');
        case 'pool':    return 'Pool';
        case 'anchor':  return 'Anchor' + (f.name ? ` — ${f.name}` : '');
        case 'note':    return `${f.iconType || 'warning'}` + (f.text ? ` — ${f.text}` : '');
        case 'access':  return (f.accessType || 'exit') === 'entrance' ? 'Entrance' : 'Exit';
        default:        return f.type;
      }
    };

    // --- Render ---
    const list = document.createElement('ul');
    list.style.cssText = 'list-style:none; padding:0; margin:0;';

    rows.forEach(({ feature, prefix }) => {
      const item = document.createElement('li');
      item.style.cssText = [
        'padding: 3px 8px',
        'cursor: pointer',
        'border-radius: 3px',
        'white-space: pre',
        'font-family: monospace',
        'font-size: 12px',
        'line-height: 1.6',
        `background: ${this.selectedFeature === feature.id ? '#e8f4f8' : 'transparent'}`,
      ].join(';');

      item.textContent = `${prefix}${icon(feature)} ${label(feature)}`;

      item.addEventListener('mouseenter', () => {
        if (this.selectedFeature !== feature.id) item.style.background = '#f0f0f0';
      });
      item.addEventListener('mouseleave', () => {
        if (this.selectedFeature !== feature.id) item.style.background = 'transparent';
      });
      item.addEventListener('click', () => this.selectFeature(feature.id));

      list.appendChild(item);
    });

    featureListDiv.innerHTML = '';
    featureListDiv.appendChild(list);
  }

});
