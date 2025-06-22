// label-dragging.js - Handles draggable label and anchor functionality
import {displayConfigAsYAML} from './io.js';

let dragState = {
    isDragging: false,
    currentElement: null,
    elementType: null, // 'label' or 'anchor'
    startX: 0,
    startY: 0,
    elementStartX: 0,
    elementStartY: 0,
    initialOffsetX: 0,
    initialOffsetY: 0,
    featureIndex: null
};

export function initializeLabelDragging() {
    // Remove existing event listeners to prevent duplicates
    removeDragListeners();
    
    // Add event listeners to all draggable labels
    const labels = document.querySelectorAll('.draggable-label');
    labels.forEach(label => {
        label.addEventListener('mousedown', handleElementMouseDown);
    });
    
    // Add event listeners to all draggable anchors
    const anchors = document.querySelectorAll('.draggable-anchor');
    anchors.forEach(anchor => {
        anchor.addEventListener('mousedown', handleElementMouseDown);
    });
    
    // Add global mouse handlers
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function handleElementMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const element = e.target;
    const svg = element.closest('svg');
    
    // Determine element type
    const isLabel = element.classList.contains('draggable-label');
    const isAnchor = element.classList.contains('draggable-anchor');
    
    if (!isLabel && !isAnchor) return;
    
    // Create SVG point for coordinate conversion
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svg.getScreenCTM().inverse());
    
    dragState.isDragging = true;
    dragState.currentElement = element;
    dragState.elementType = isLabel ? 'label' : 'anchor';
    dragState.startX = svgPoint.x;
    dragState.startY = svgPoint.y;
    dragState.initialOffsetX = parseFloat(element.getAttribute('data-offset-x'));
    dragState.initialOffsetY = parseFloat(element.getAttribute('data-offset-y'));
    dragState.featureIndex = parseInt(element.getAttribute('data-index'));
    
    // Store the current element position in SVG coordinates
    dragState.elementStartX = parseFloat(element.getAttribute('x'));
    dragState.elementStartY = parseFloat(element.getAttribute('y'));
    
    // Visual feedback
    element.style.opacity = '0.7';
    element.style.filter = 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))';
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
}

function handleMouseMove(e) {
    if (!dragState.isDragging || !dragState.currentElement) return;
    
    e.preventDefault();
    
    const element = dragState.currentElement;
    const svg = element.closest('svg');
    
    // Convert mouse coordinates to SVG coordinates
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svg.getScreenCTM().inverse());
    
    // Calculate movement delta in SVG coordinates
    const deltaX = svgPoint.x - dragState.startX;
    const deltaY = svgPoint.y - dragState.startY;
    
    // Calculate new element position
    const newX = dragState.elementStartX + deltaX;
    const newY = dragState.elementStartY + deltaY;
    
    // Update element position immediately
    element.setAttribute('x', newX);
    element.setAttribute('y', newY);
    
    // Calculate new offset values for storage
    const featureX = parseFloat(element.getAttribute('data-feature-x'));
    const featureY = parseFloat(element.getAttribute('data-feature-y'));
    const newOffsetX = newX - featureX;
    const newOffsetY = newY - featureY;
    
    // Update offset data attributes
    element.setAttribute('data-offset-x', newOffsetX);
    element.setAttribute('data-offset-y', newOffsetY);
}

function handleMouseUp(e) {
    if (!dragState.isDragging || !dragState.currentElement) return;
    
    const element = dragState.currentElement;
    
    // Remove visual feedback
    element.style.opacity = '1';
    element.style.filter = 'none';
    document.body.style.userSelect = '';
    
    // Update the feature data with new offset values
    if (window.topo && window.topo.config && window.topo.config.features) {
        const feature = window.topo.config.features[dragState.featureIndex];
        if (feature) {
            const newOffsetX = parseFloat(element.getAttribute('data-offset-x'));
            const newOffsetY = parseFloat(element.getAttribute('data-offset-y'));
            
            if (dragState.elementType === 'label') {
                feature.labelOffsetX = Math.round(newOffsetX);
                feature.labelOffsetY = Math.round(newOffsetY);
                
                console.log(`Updated feature ${dragState.featureIndex} label offsets:`, {
                    x: Math.round(newOffsetX),
                    y: Math.round(newOffsetY),
                    feature: feature
                });
                
                // Update the UI inputs if they exist
                updateLabelInputs(dragState.featureIndex, Math.round(newOffsetX), Math.round(newOffsetY));
            } else if (dragState.elementType === 'anchor') {
                feature.anchorOffsetX = Math.round(newOffsetX);
                feature.anchorOffsetY = Math.round(newOffsetY);
                
                console.log(`Updated feature ${dragState.featureIndex} anchor offsets:`, {
                    x: Math.round(newOffsetX),
                    y: Math.round(newOffsetY),
                    feature: feature
                });
                
                // Update the UI inputs if they exist (for anchors)
                updateAnchorInputs(dragState.featureIndex, Math.round(newOffsetX), Math.round(newOffsetY));
            }
            
            // Trigger YAML update
            try {
                displayConfigAsYAML();
            } catch (error) {
                console.error('Error updating YAML display:', error);
            }
        }
    }
    
    // Reset drag state
    dragState.isDragging = false;
    dragState.currentElement = null;
    dragState.elementType = null;
    dragState.featureIndex = null;
}

function updateLabelInputs(featureIndex, offsetX, offsetY) {
    // Find the corresponding input fields in the feature list
    const featureList = document.getElementById('feature-list');
    if (!featureList) {
        console.log('Feature list not found');
        return;
    }
    
    const listItems = featureList.children;
    if (listItems[featureIndex]) {
        const inputs = listItems[featureIndex].querySelectorAll('input[type="number"]');
        console.log(`Found ${inputs.length} number inputs for feature ${featureIndex}`);
        
        inputs.forEach(input => {
            console.log('Input placeholder:', input.placeholder);
            if (input.placeholder === 'X offset') {
                input.value = Math.round(offsetX);
                console.log('Updated X offset input to:', Math.round(offsetX));
            } else if (input.placeholder === 'Y offset') {
                input.value = Math.round(offsetY);
                console.log('Updated Y offset input to:', Math.round(offsetY));
            }
        });
    } else {
        console.log(`List item ${featureIndex} not found`);
    }
}

function updateAnchorInputs(featureIndex, offsetX, offsetY) {
    // Find the corresponding input fields in the feature list
    const featureList = document.getElementById('feature-list');
    if (!featureList) {
        console.log('Feature list not found');
        return;
    }
    
    const listItems = featureList.children;
    if (listItems[featureIndex]) {
        const inputs = listItems[featureIndex].querySelectorAll('input[type="number"]');
        console.log(`Found ${inputs.length} number inputs for anchor feature ${featureIndex}`);
        
        inputs.forEach(input => {
            console.log('Input placeholder:', input.placeholder);
            if (input.placeholder === 'Anchor X offset') {
                input.value = Math.round(offsetX);
                console.log('Updated anchor X offset input to:', Math.round(offsetX));
            } else if (input.placeholder === 'Anchor Y offset') {
                input.value = Math.round(offsetY);
                console.log('Updated anchor Y offset input to:', Math.round(offsetY));
            }
        });
    } else {
        console.log(`List item ${featureIndex} not found`);
    }
}

function removeDragListeners() {
    const labels = document.querySelectorAll('.draggable-label');
    labels.forEach(label => {
        label.removeEventListener('mousedown', handleElementMouseDown);
    });
    
    const anchors = document.querySelectorAll('.draggable-anchor');
    anchors.forEach(anchor => {
        anchor.removeEventListener('mousedown', handleElementMouseDown);
    });
}

export function cleanupLabelDragging() {
    removeDragListeners();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
}