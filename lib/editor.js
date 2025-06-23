import { loadYAMLIntoConfig, displayConfigAsYAML } from './io.js';
import { initializeSortable } from './dragging.js';
import { addHighlightEvents, removeHighlightFromSVGItem, highlightSVGItem } from './highlight.js';
import { saveChangesToMediaWikiAPI } from './wiki_api.js';
import { insertInlineButtons, removeInlineButtons, generateFeatureButtons } from './buttons.js';
import '../deps/Sortable.min.js';
import '../deps/js-yaml.min.js';
import { Draw } from './draw.js';
import { initializeLabelDragging } from './label-dragging.js';

// Debounce utility function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Create debounced version of updateSVG
const debouncedUpdateSVG = debounce(updateSVG, 300);

export function refresh() {
    updateSVG();
    renderFeatureList();
    addHighlightEvents();
}

export function renderFeatureList() {
    const featureList = document.getElementById("feature-list");
    featureList.innerHTML = "";

    window.topo.config.features.forEach((feature, index) => {
        const li = document.createElement("li");
        li.id = `list-item-${index}`; // Assign a unique ID to each list item
        li.classList.add("feature-list-item");


        li.addEventListener("click", () => {
            if (li.classList.contains('topo-highlight')) {
                li.classList.remove('topo-highlight');
                window.topo.selectedItemIndex = null;
                removeInlineButtons();
                removeHighlightFromSVGItem();
            } else {
                window.topo.selectedItemIndex = index;
                let list_items = document.querySelectorAll('.feature-list-item');
                list_items.forEach(item => {
                    item.classList.remove('topo-highlight');
                });
                li.classList.add('topo-highlight');

                // Remove existing highlights,then add new.
                removeInlineButtons();
                removeHighlightFromSVGItem();

                highlightSVGItem(index);
            }
        });

        // Label input for all features
        const labelInput = createInput("text", feature.label || "", (e) => {
            feature.label = e.target.value;
            // Show/hide position controls based on label content
            updateLabelControls();
            debouncedUpdateSVG();
        }, { placeholder: "Enter label..." });

        // Advanced controls container (collapsible)
        const advancedContainer = document.createElement("div");
        advancedContainer.style.width = "100%";

        // Advanced toggle button
        const advancedToggle = document.createElement("button");
        advancedToggle.textContent = "▶ Advanced";
        advancedToggle.style.cssText = "background: none; border: none; color: #666; cursor: pointer; font-size: 12px; padding: 2px 5px;";

        // Advanced content (initially hidden)
        const advancedContent = document.createElement("div");
        advancedContent.style.display = "none";
        advancedContent.style.marginTop = "5px";
        advancedContent.style.padding = "5px";
        advancedContent.style.backgroundColor = "#f5f5f5";
        advancedContent.style.borderRadius = "3px";
        advancedContent.style.fontSize = "12px";

        // Label position controls container
        const labelControlsDiv = document.createElement("div");
        labelControlsDiv.style.display = feature.label ? "block" : "none";
        labelControlsDiv.style.marginBottom = "5px";

        const labelXInput = createInput("number", feature.labelOffsetX || 10, (e) => {
            feature.labelOffsetX = Math.round(parseFloat(e.target.value));
            debouncedUpdateSVG();
        }, { placeholder: "X offset", min: -500, max: 500 });

        const labelYInput = createInput("number", feature.labelOffsetY || -40, (e) => {
            feature.labelOffsetY = Math.round(parseFloat(e.target.value));
            debouncedUpdateSVG();
        }, { placeholder: "Y offset", min: -500, max: 500 });

        const textStyleInput = createInput("text", feature.textStyle || "", (e) => {
            feature.textStyle = e.target.value;
            debouncedUpdateSVG();
        }, { placeholder: "CSS style (e.g., color: red; font-size: 20px;)" });

        labelControlsDiv.appendChild(document.createTextNode("Label X: "));
        labelControlsDiv.appendChild(labelXInput);
        labelControlsDiv.appendChild(document.createTextNode(" Y: "));
        labelControlsDiv.appendChild(labelYInput);
        labelControlsDiv.appendChild(document.createElement("br"));
        labelControlsDiv.appendChild(document.createTextNode("Style: "));
        labelControlsDiv.appendChild(textStyleInput);

        advancedContent.appendChild(labelControlsDiv);

        // Toggle functionality
        let isExpanded = false;
        advancedToggle.addEventListener("click", (e) => {
            e.preventDefault();
            isExpanded = !isExpanded;
            if (isExpanded) {
                advancedToggle.textContent = "▼ Advanced";
                advancedContent.style.display = "block";
            } else {
                advancedToggle.textContent = "▶ Advanced";
                advancedContent.style.display = "none";
            }
        });

        advancedContainer.appendChild(advancedToggle);
        advancedContainer.appendChild(advancedContent);

        // Function to show/hide label position controls
        function updateLabelControls() {
            if (labelInput.value.trim()) {
                labelControlsDiv.style.display = "block";
            } else {
                labelControlsDiv.style.display = "none";
                feature.labelOffsetX = undefined;
                feature.labelOffsetY = undefined;
                feature.textStyle = undefined;
            }
        }

        // Row numbers
        const id_span = document.createElement("span");
        id_span.classList.add("id_span");
        id_span.textContent = index;

        // Main row container for basic controls
        const mainRow = document.createElement("div");
        mainRow.style.display = "flex";
        mainRow.style.alignItems = "center";
        mainRow.style.width = "100%";

        mainRow.appendChild(id_span);
        mainRow.appendChild(labelInput);


        // Display parameters and create input fields for editable parameters
        if (feature.type === "line") {
            const addSectionBtn = document.createElement("button");
            addSectionBtn.textContent = "+ Section";
            addSectionBtn.addEventListener("click", () => {
                if (!feature.sections) {
                    feature.sections = [{ length: feature.length, slope: feature.slope }];
                    delete feature.length;
                    delete feature.slope;
                }
                feature.sections.push({ length: 30, slope: 0 });
                refresh();
            });
            mainRow.appendChild(addSectionBtn);

            if (feature.sections && Array.isArray(feature.sections)) {
                feature.sections.forEach((section, sectionIndex) => {
                    const sectionLabel = document.createElement("div");
                    sectionLabel.textContent = `Section ${sectionIndex + 1}:`;
                    mainRow.appendChild(sectionLabel);

                    const lengthInput = createInput("number", section.length, (e) => {
                        feature.sections[sectionIndex].length = parseFloat(e.target.value);
                        debouncedUpdateSVG();
                    }, { min: 0, placeholder: "Length" });

                    const slopeInput = createInput("number", section.slope, (e) => {
                        feature.sections[sectionIndex].slope = parseFloat(e.target.value);
                        debouncedUpdateSVG();
                    }, { min: -90, max: 90, placeholder: "Slope" });

                    mainRow.appendChild(document.createTextNode("Length: "));
                    mainRow.appendChild(lengthInput);
                    mainRow.appendChild(document.createTextNode("Slope: "));
                    mainRow.appendChild(slopeInput);
                });

                mainRow.appendChild(addSectionBtn);

            } else {
                const lengthInput = createInput("number", feature.length, (e) => {
                    feature.length = parseFloat(e.target.value);
                    debouncedUpdateSVG();
                }, { min: 0, placeholder: "Length" });

                const slopeInput = createInput("number", feature.slope, (e) => {
                    feature.slope = parseFloat(e.target.value);
                    debouncedUpdateSVG();
                }, { min: -90, max: 90, placeholder: "Slope" });

                const shortenInput = createInput("checkbox", feature.shorten, (e) => {
                    feature.shorten = e.target.checked;
                    updateSVG();
                });

                const traverseInput = createInput(
                    "checkbox",
                    feature.traverse,
                    (e) => {
                        feature.traverse = e.target.checked;
                        updateSVG();
                    }
                );

                mainRow.appendChild(document.createTextNode("Length: "));
                mainRow.appendChild(lengthInput);
                mainRow.appendChild(document.createTextNode("Slope: "));
                mainRow.appendChild(slopeInput);
                mainRow.appendChild(document.createTextNode("Shorten: "));
                mainRow.appendChild(shortenInput);
                mainRow.appendChild(document.createTextNode("Traverse: "));
                mainRow.appendChild(traverseInput);
                mainRow.appendChild(addSectionBtn);
            }
        }

        if (feature.type === "pool") {
            const widthInput = createInput("number", feature.width, (e) => {
                feature.width = parseFloat(e.target.value);
                updateSVG();
            });

            const depthInput = createInput("number", feature.depth, (e) => {
                feature.depth = parseFloat(e.target.value);
                updateSVG();
            });

            mainRow.appendChild(document.createTextNode("Width: "));
            mainRow.appendChild(widthInput);
            mainRow.appendChild(document.createTextNode("Depth: "));
            mainRow.appendChild(depthInput);
        }

        if (feature.type === "rap") {
            const addSectionBtn = document.createElement("button");
            addSectionBtn.textContent = "+ Section";
            addSectionBtn.addEventListener("click", () => {
                if (!feature.sections) {
                    feature.sections = [{ length: feature.length, slope: feature.slope }];
                    delete feature.length;
                    delete feature.slope;
                }
                feature.sections.push({ length: 30, slope: 90 });
                refresh();
            });
            mainRow.appendChild(addSectionBtn);

            if (feature.sections && Array.isArray(feature.sections)) {
                feature.sections.forEach((section, sectionIndex) => {
                    const sectionLabel = document.createElement("div");
                    sectionLabel.textContent = `Section ${sectionIndex + 1}:`;
                    mainRow.appendChild(sectionLabel);

                    const lengthInput = createInput("number", section.length, (e) => {
                        feature.sections[sectionIndex].length = parseFloat(e.target.value);
                        debouncedUpdateSVG();
                    }, { min: 0, placeholder: "Length" });

                    const slopeInput = createInput("number", section.slope, (e) => {
                        feature.sections[sectionIndex].slope = parseFloat(e.target.value);
                        debouncedUpdateSVG();
                    }, { min: -90, max: 90, placeholder: "Slope" });

                    mainRow.appendChild(document.createTextNode("Length: "));
                    mainRow.appendChild(lengthInput);
                    mainRow.appendChild(document.createTextNode("Slope: "));
                    mainRow.appendChild(slopeInput);
                });

                mainRow.appendChild(addSectionBtn);

            } else {
                const lengthInput = createInput("number", feature.length, (e) => {
                    feature.length = parseFloat(e.target.value);
                    updateSVG();
                });

                const slopeInput = createInput("number", feature.slope, (e) => {
                    feature.slope = parseFloat(e.target.value);
                    updateSVG();
                });

                mainRow.appendChild(document.createTextNode("Length: "));
                mainRow.appendChild(lengthInput);
                mainRow.appendChild(document.createTextNode("Slope: "));
                mainRow.appendChild(slopeInput);
                mainRow.appendChild(addSectionBtn);
            }
        }

        if (feature.type === "anchor") {
            const countInput = createInput("number", feature.count, (e) => {
                feature.count = parseFloat(e.target.value);
                updateSVG();
            });

            const styleInput = createInput("text", feature.style, (e) => {
                feature.style = e.target.value;
                updateSVG();
            });

            mainRow.appendChild(document.createTextNode("Count: "));
            mainRow.appendChild(countInput);
            mainRow.appendChild(document.createTextNode("Style: "));
            mainRow.appendChild(styleInput);
        }

        if (feature.type === "break") {
            // Add CSS class for break styling
            li.classList.add("break-feature");

            const restartXInput = createInput("number", feature.restart_x || 20, (e) => {
                feature.restart_x = Math.round(parseFloat(e.target.value));
                updateSVG();
            }, { placeholder: "Restart X position" });

            const restartYInput = createInput("number", feature.restart_y || 100, (e) => {
                feature.restart_y = Math.round(parseFloat(e.target.value));
                updateSVG();
            }, { placeholder: "Restart Y position" });

            mainRow.appendChild(document.createTextNode("Restart X: "));
            mainRow.appendChild(restartXInput);
            mainRow.appendChild(document.createTextNode("Y: "));
            mainRow.appendChild(restartYInput);
        }

        const type_span = document.createElement("span");
        type_span.classList.add("type_span");
        type_span.textContent = feature.type;
        mainRow.appendChild(type_span);

        // Add buttons for deleting and adding features
        const deleteButton = createButton("X", () => {
            window.topo.config.features.splice(index, 1);
            refresh();
        });
        deleteButton.classList.add('delete_button');

        const plusButton = createButton("+", (e) => {
            e.stopPropagation(); // Prevent li click event

            console.log('Plus button clicked for index:', index);

            // Check if inline buttons are already visible for this item
            const existingButtons = document.getElementById('inlineButtons');
            const nextElement = li.nextElementSibling;

            if (existingButtons && nextElement === existingButtons) {
                // Hide inline buttons if they're already showing for this item
                removeInlineButtons();
                console.log('Inline buttons hidden');
            } else {
                // Remove any existing inline buttons first
                removeInlineButtons();

                // Set selected index for insertion
                window.topo.selectedItemIndex = index;

                console.log('Calling insertInlineButtons with:', li);

                // Insert inline buttons after this item
                insertInlineButtons(li);
            }
        });
        plusButton.classList.add('plus_button');

        // Append buttons to main row
        mainRow.appendChild(plusButton);
        mainRow.appendChild(deleteButton);

        // Add main row and advanced container to list item
        li.appendChild(mainRow);
        li.appendChild(advancedContainer);
        featureList.appendChild(li);
    });



    initializeSortable();
    addHighlightEvents(); // we force a refresh because of a load-time delay
}

// Helper function to create input fields with validation
function createInput(type, value, onChange, options = {}) {
    const input = document.createElement("input");
    input.type = type;

    // Set the appropriate value or checked attribute based on the input type
    if (type === "checkbox") {
        input.checked = value;
    } else {
        input.value = value;
    }

    // Add validation for numeric inputs
    const validatedOnChange = (e) => {
        if (type === "number") {
            const numValue = parseFloat(e.target.value);
            if (isNaN(numValue)) {
                console.warn(`Invalid numeric input: ${e.target.value}`);
                e.target.value = value; // Reset to previous valid value
                return;
            }
            // Apply min/max constraints if provided
            if (options.min !== undefined && numValue < options.min) {
                e.target.value = options.min;
            }
            if (options.max !== undefined && numValue > options.max) {
                e.target.value = options.max;
            }
        }
        onChange(e);
    };

    input.addEventListener("change", validatedOnChange);

    // Add placeholder if provided
    if (options.placeholder) {
        input.placeholder = options.placeholder;
    }

    return input;
}

// Helper function to create buttons
function createButton(text, onClick) {
    const button = document.createElement("button");
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
}

export function updateSVG() {
    try {
        displayConfigAsYAML();
        const svgPreview = document.getElementById("svg-preview");
        if (!svgPreview) {
            throw new Error('SVG preview element not found');
        }
        svgPreview.innerHTML = new Draw(window.topo.config, true).draw();
        addHighlightEvents();
        initializeLabelDragging();
    } catch (error) {
        console.error('SVG generation error:', error);
        const svgPreview = document.getElementById("svg-preview");
        if (svgPreview) {
            svgPreview.innerHTML = `<p style="color: red;">Error generating SVG: ${error.message}</p>`;
        }
    }
}

function enableLineDragging() {
    // Refresh SVG to show connection nodes
    updateSVG();

    if (window.interact && !window.topo.lineDraggable) {
        window.topo.lineDraggable = window.interact('.conn-node').draggable({
            modifiers: [
                window.interact.modifiers.snap({
                    targets: [window.interact.snappers.grid({ x: 10, y: 10 })],
                    range: Infinity,
                    relativePoints: [{ x: 0.5, y: 0.5 }],
                })
            ],
            listeners: {
                move(event) {
                    const circle = event.target;
                    const role = circle.dataset.role;
                    const parent = circle.closest('.feature-group');
                    const line = parent.querySelector('line');

                    const cx = parseFloat(circle.getAttribute('cx')) + event.dx;
                    const cy = parseFloat(circle.getAttribute('cy')) + event.dy;

                    circle.setAttribute('cx', cx);
                    circle.setAttribute('cy', cy);

                    if (role === 'start') {
                        line.setAttribute('x1', cx);
                        line.setAttribute('y1', cy);
                    } else {
                        line.setAttribute('x2', cx);
                        line.setAttribute('y2', cy);
                    }

                    // Update config
                    const index = parseInt(circle.dataset.index);
                    const feature = window.topo.config.features[index];
                    if (!feature || feature.type !== 'line' && feature.type !== 'rap') return;

                    // Get current x1/y1 and x2/y2
                    const x1 = parseFloat(line.getAttribute('x1'));
                    const y1 = parseFloat(line.getAttribute('y1'));
                    const x2 = parseFloat(line.getAttribute('x2'));
                    const y2 = parseFloat(line.getAttribute('y2'));

                    // Update length and slope
                    const dx = x2 - x1;
                    const dy = y2 - y1;
                    feature.length = Math.round(Math.hypot(dx, dy));
                    feature.slope = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
                    if (feature.slope < 0) feature.slope += 360;

                    refresh();
                }
            }
        });
    }
}

function disableLineDragging() {
    if (window.topo.lineDraggable) {
        window.topo.lineDraggable.unset();
        window.topo.lineDraggable = null;
    }

    // Refresh SVG to hide connection nodes
    updateSVG();
}

export function setup() {
    console.log('[topo] ui setup called');
    document
        .getElementById("highlight-checkbox")
        .addEventListener("change", function () {
            if (this.checked) {
                window.topo.highlight_mode = true;
            } else {
                window.topo.highlight_mode = false;
            }
        });

    document
        .getElementById("line-dragging-checkbox")
        .addEventListener("change", function () {
            if (this.checked) {
                window.topo.line_dragging_enabled = true;
                enableLineDragging();
            } else {
                window.topo.line_dragging_enabled = false;
                disableLineDragging();
            }
        });

    // Start position inputs
    const startXInput = document.getElementById("start-x-input");
    const startYInput = document.getElementById("start-y-input");

    if (startXInput && startYInput) {
        startXInput.addEventListener("input", function () {
            const value = parseFloat(this.value);
            if (!isNaN(value)) {
                window.topo.config.start_x = Math.round(value);
                updateSVG();
            }
        });

        startYInput.addEventListener("input", function () {
            const value = parseFloat(this.value);
            if (!isNaN(value)) {
                window.topo.config.start_y = Math.round(value);
                updateSVG();
            }
        });

        // Initialize start position inputs with current values
        function updateStartPositionInputs() {
            if (window.topo && window.topo.config) {
                startXInput.value = window.topo.config.start_x || 20;
                startYInput.value = window.topo.config.start_y || 0;
            }
        }

        // Set initial values
        updateStartPositionInputs();
    } else {
        console.warn("Start position input elements not found in DOM");
    }

    document.getElementById('load-yaml-button').addEventListener('click', () => {
        loadYAMLIntoConfig();
        refresh();
    });

    document.getElementById('delete-offsets').addEventListener('click', () => {
        removeOffsetsFromConfig(window.topo.config);
        refresh();
    });

    document.getElementById('save-btn').addEventListener('click', function () {
        const saveBtn = document.getElementById('save-btn');

        // Force immediate YAML update to ensure latest changes are included
        loadYAMLIntoConfig();
        const newYamlContent = document.getElementById('yaml-textbox').value;

        // Set saving state
        saveBtn.textContent = 'Saving...';
        saveBtn.disabled = true;

        // Save with callbacks to handle UI state
        saveChangesToMediaWikiAPI(
            window.topo.pageFullName,
            newYamlContent,
            // Success callback
            () => {
                saveBtn.textContent = 'Saved!';
                setTimeout(() => {
                    // Reload the SVG from the saved YAML without overwriting textarea
                    loadYAMLIntoConfig();
                    const svgPreview = document.getElementById("svg-preview");
                    if (svgPreview) {
                        svgPreview.innerHTML = new Draw(window.topo.config, true).draw();
                        addHighlightEvents();
                        initializeLabelDragging();
                    }
                    saveBtn.textContent = 'Save';
                    saveBtn.disabled = false;
                }, 1000);
            },
            // Error callback
            (error) => {
                saveBtn.textContent = 'Save Failed';
                setTimeout(() => {
                    saveBtn.textContent = 'Save';
                    saveBtn.disabled = false;
                }, 3000);
            }
        );
    });

    loadYAMLIntoConfig();
    refresh();

    console.log('[topo] DOM done - loading UI');
    let featureList = document.getElementById('feature-list');

    const inlineButtons = document.createElement('div');
    inlineButtons.id = 'inlineButtons-static';
    inlineButtons.classList.add('inlineButtons-static');
    inlineButtons.innerHTML = "<hr>";
    inlineButtons.append(generateFeatureButtons());
    featureList.insertAdjacentElement('afterend', inlineButtons);
    import("https://cdn.jsdelivr.net/npm/@interactjs/interactjs/index.min.js").then(() => {
        // Store interact globally for enable/disable functions
        window.interact = interact;

        // Initialize line dragging state
        window.topo.lineDraggable = null;
        window.topo.line_dragging_enabled = false;

        interact('.break-marker').draggable({
            modifiers: [
                interact.modifiers.snap({
                    targets: [interact.snappers.grid({ x: 10, y: 10 })],
                    range: Infinity,
                    relativePoints: [{ x: 0.5, y: 0.5 }],
                })
            ],
            listeners: {
                move(event) {
                    const circle = event.target;
                    const parent = circle.closest('.feature-group');
                    const text = parent.querySelector('text');

                    const cx = parseFloat(circle.getAttribute('cx')) + event.dx;
                    const cy = parseFloat(circle.getAttribute('cy')) + event.dy;

                    circle.setAttribute('cx', cx);
                    circle.setAttribute('cy', cy);

                    // Update the RESTART text position
                    if (text) {
                        text.setAttribute('x', cx);
                        text.setAttribute('y', cy - 12);
                    }

                    // Update config
                    const index = parseInt(circle.dataset.index);
                    const feature = window.topo.config.features[index];
                    if (!feature || feature.type !== 'break') return;

                    feature.restart_x = Math.round(cx);
                    feature.restart_y = Math.round(cy);

                    refresh();
                }
            }
        })

        interact('.start-marker').draggable({
            modifiers: [
                interact.modifiers.snap({
                    targets: [interact.snappers.grid({ x: 10, y: 10 })],
                    range: Infinity,
                    relativePoints: [{ x: 0.5, y: 0.5 }],
                })
            ],
            listeners: {
                move(event) {
                    const circle = event.target;
                    const parent = circle.closest('.start-position-group');
                    const text = parent.querySelector('text');

                    const cx = parseFloat(circle.getAttribute('cx')) + event.dx;
                    const cy = parseFloat(circle.getAttribute('cy')) + event.dy;

                    circle.setAttribute('cx', cx);
                    circle.setAttribute('cy', cy);

                    // Update the START text position
                    if (text) {
                        text.setAttribute('x', cx);
                        text.setAttribute('y', cy - 15);
                    }

                    // Update config start position (rounded to integers)
                    window.topo.config.start_x = Math.round(cx);
                    window.topo.config.start_y = Math.round(cy);

                    // Update the input fields
                    const startXInput = document.getElementById("start-x-input");
                    const startYInput = document.getElementById("start-y-input");
                    if (startXInput) startXInput.value = Math.round(cx);
                    if (startYInput) startYInput.value = Math.round(cy);

                    refresh();
                }
            }
        })

    });

}


export function removeOffsetsFromConfig(config = window.topo.config) {
    // Remove offsets from features
    if (config.features && Array.isArray(config.features)) {
        config.features.forEach(feature => {
            if ('labelOffsetX' in feature) delete feature.labelOffsetX;
            if ('labelOffsetY' in feature) delete feature.labelOffsetY;
            if ('anchorOffsetX' in feature) delete feature.anchorOffsetX;
            if ('anchorOffsetY' in feature) delete feature.anchorOffsetY;
            if ('restart_x' in feature) delete feature.restart_x;
            if ('restart_y' in feature) delete feature.restart_y;
        });
    }
    // Remove start_x and start_y from the top level
    if ('start_x' in config) delete config.start_x;
    if ('start_y' in config) delete config.start_y;
}