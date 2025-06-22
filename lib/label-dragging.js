// label-dragging.js - Handles draggable label functionality
import {displayConfigAsYAML} from './io.js';

let dragState = {
    isDragging: false,
    currentLabel: null,
    startX: 0,
    startY: 0,
    labelStartX: 0,
    labelStartY: 0,
    initialOffsetX: 0,
    initialOffsetY: 0,
    featureIndex: null
};

export function initializeLabelDragging() {
    // Remove existing event listeners to prevent duplicates
    removeLabelDragListeners();
    
    // Add event listeners to all draggable labels
    const labels = document.querySelectorAll('.draggable-label');
    labels.forEach(label => {
        label.addEventListener('mousedown', handleLabelMouseDown);
    });
    
    // Add global mouse handlers
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

function handleLabelMouseDown(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const label = e.target;
    const svg = label.closest('svg');
    
    // Create SVG point for coordinate conversion
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svg.getScreenCTM().inverse());
    
    dragState.isDragging = true;
    dragState.currentLabel = label;
    dragState.startX = svgPoint.x;
    dragState.startY = svgPoint.y;
    dragState.initialOffsetX = parseFloat(label.getAttribute('data-offset-x'));
    dragState.initialOffsetY = parseFloat(label.getAttribute('data-offset-y'));
    dragState.featureIndex = parseInt(label.getAttribute('data-index'));
    
    // Store the current label position in SVG coordinates
    dragState.labelStartX = parseFloat(label.getAttribute('x'));
    dragState.labelStartY = parseFloat(label.getAttribute('y'));
    
    // Visual feedback
    label.style.opacity = '0.7';
    label.style.filter = 'drop-shadow(2px 2px 4px rgba(0,0,0,0.3))';
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
}

function handleMouseMove(e) {
    if (!dragState.isDragging || !dragState.currentLabel) return;
    
    e.preventDefault();
    
    const label = dragState.currentLabel;
    const svg = label.closest('svg');
    
    // Convert mouse coordinates to SVG coordinates
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const svgPoint = pt.matrixTransform(svg.getScreenCTM().inverse());
    
    // Calculate movement delta in SVG coordinates
    const deltaX = svgPoint.x - dragState.startX;
    const deltaY = svgPoint.y - dragState.startY;
    
    // Calculate new label position
    const newX = dragState.labelStartX + deltaX;
    const newY = dragState.labelStartY + deltaY;
    
    // Update label position immediately
    label.setAttribute('x', newX);
    label.setAttribute('y', newY);
    
    // Calculate new offset values for storage
    const featureX = parseFloat(label.getAttribute('data-feature-x'));
    const featureY = parseFloat(label.getAttribute('data-feature-y'));
    const newOffsetX = newX - featureX;
    const newOffsetY = newY - featureY;
    
    // Update offset data attributes
    label.setAttribute('data-offset-x', newOffsetX);
    label.setAttribute('data-offset-y', newOffsetY);
}

function handleMouseUp(e) {
    if (!dragState.isDragging || !dragState.currentLabel) return;
    
    const label = dragState.currentLabel;
    
    // Remove visual feedback
    label.style.opacity = '1';
    label.style.filter = 'none';
    document.body.style.userSelect = '';
    
    // Update the feature data with new offset values
    if (window.topo && window.topo.config && window.topo.config.features) {
        const feature = window.topo.config.features[dragState.featureIndex];
        if (feature) {
            const newOffsetX = parseFloat(label.getAttribute('data-offset-x'));
            const newOffsetY = parseFloat(label.getAttribute('data-offset-y'));
            
            feature.labelOffsetX = newOffsetX;
            feature.labelOffsetY = newOffsetY;
            
            console.log(`Updated feature ${dragState.featureIndex} label offsets:`, {
                x: newOffsetX,
                y: newOffsetY,
                feature: feature
            });
            
            // Update the UI inputs if they exist
            updateLabelInputs(dragState.featureIndex, newOffsetX, newOffsetY);
            
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
    dragState.currentLabel = null;
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

function removeLabelDragListeners() {
    const labels = document.querySelectorAll('.draggable-label');
    labels.forEach(label => {
        label.removeEventListener('mousedown', handleLabelMouseDown);
    });
}

export function cleanupLabelDragging() {
    removeLabelDragListeners();
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
}