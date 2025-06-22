import {loadYAMLIntoConfig, displayConfigAsYAML} from './io.js';
import {initializeSortable} from './dragging.js';
import {addHighlightEvents, removeHighlightFromSVGItem, highlightSVGItem} from './highlight.js';
import {saveChangesToMediaWikiAPI} from './wiki_api.js';
import {insertInlineButtons, removeInlineButtons, generateFeatureButtons } from './buttons.js';
import '../deps/Sortable.min.js';
import '../deps/js-yaml.min.js';
import {Draw} from './draw.js';
import {initializeLabelDragging} from './label-dragging.js';

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

        // Label position controls container
        const labelControlsDiv = document.createElement("div");
        labelControlsDiv.style.display = feature.label ? "inline" : "none";
        
        const labelXInput = createInput("number", feature.labelOffsetX || 10, (e) => {
            feature.labelOffsetX = parseFloat(e.target.value);
            debouncedUpdateSVG();
        }, { placeholder: "X offset", min: -500, max: 500 });
        
        const labelYInput = createInput("number", feature.labelOffsetY || -40, (e) => {
            feature.labelOffsetY = parseFloat(e.target.value);
            debouncedUpdateSVG();
        }, { placeholder: "Y offset", min: -500, max: 500 });
        
        labelControlsDiv.appendChild(labelXInput);
        labelControlsDiv.appendChild(labelYInput);
        
        // Function to show/hide label position controls
        function updateLabelControls() {
            if (labelInput.value.trim()) {
                labelControlsDiv.style.display = "inline";
            } else {
                labelControlsDiv.style.display = "none";
                feature.labelOffsetX = undefined;
                feature.labelOffsetY = undefined;
            }
        }

        // Row numbers
        const id_span = document.createElement("span");
        id_span.classList.add("id_span");
        id_span.textContent = index;

        li.appendChild(id_span);
        li.appendChild(labelInput);
        li.appendChild(labelControlsDiv);


        // Display parameters and create input fields for editable parameters
        if (feature.type === "line") {
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

            li.appendChild(document.createTextNode("Length: "));
            li.appendChild(lengthInput);
            li.appendChild(document.createTextNode("Slope: "));
            li.appendChild(slopeInput);
            li.appendChild(document.createTextNode("Shorten: "));
            li.appendChild(shortenInput);
            li.appendChild(document.createTextNode("Traverse: "));
            li.appendChild(traverseInput);
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

            li.appendChild(document.createTextNode("Width: "));
            li.appendChild(widthInput);
            li.appendChild(document.createTextNode("Depth: "));
            li.appendChild(depthInput);
        }

        if (feature.type === "rap") {
            const lengthInput = createInput("number", feature.length, (e) => {
                feature.length = parseFloat(e.target.value);
                updateSVG();
            });

            const slopeInput = createInput("number", feature.slope, (e) => {
                feature.slope = parseFloat(e.target.value);
                updateSVG();
            });

            li.appendChild(document.createTextNode("Length: "));
            li.appendChild(lengthInput);
            li.appendChild(document.createTextNode("Slope: "));
            li.appendChild(slopeInput);
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

            li.appendChild(document.createTextNode("Count: "));
            li.appendChild(countInput);
            li.appendChild(document.createTextNode("Style: "));
            li.appendChild(styleInput);
        }

        const type_span = document.createElement("span");
        type_span.classList.add("type_span");
        type_span.textContent = feature.type;
        li.appendChild(type_span);

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

        // Append buttons and input fields to the list item (plus first, then delete)
        li.appendChild(plusButton);
        li.appendChild(deleteButton);
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

    document.getElementById('save-btn').addEventListener('click', function () {
        const newYamlContent = document.getElementById('yaml-textbox').value;
        saveChangesToMediaWikiAPI(window.topo.pageFullName, newYamlContent);
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
    import("https://cdn.jsdelivr.net/npm/@interactjs/interactjs/index.min.js").then(

        interact('.conn-node').draggable({
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

                // if (role === 'start') {
                //     feature.start_x = cx;
                //     feature.start_y = cy;
                //   }


                // Update length and slope
                const dx = x2 - x1;
                const dy = y2 - y1;
                feature.length = Math.round(Math.hypot(dx, dy));
                feature.slope = Math.round(Math.atan2(dy, dx) * 180 / Math.PI);
                if (feature.slope < 0) feature.slope += 360;

                refresh();
              }
            }
          })
          

    );

}