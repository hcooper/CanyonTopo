
let config = {
    features: [],
};

highlight_mode = false;

function refresh() {
    updateSVG();
    renderFeatureList();
    addHightlightEvents();
}

function renderFeatureList() {
    const featureList = document.getElementById("feature-list");
    featureList.innerHTML = "";

    config.features.forEach((feature, index) => {
        const li = document.createElement("li");
        li.id = `list-item-${index}`; // Assign a unique ID to each list item
        li.classList.add("feature-list-item");


        li.addEventListener("click", () => {
            if (li.classList.contains('topo-highlight')) {
                li.classList.remove('topo-highlight');
                selectedItemIndex = null;
                removeInlineButtons();
                highlightSVGItem(index);
                removeHighlightFromSVGItem(index);
            } else {
                selectedItemIndex = index;
                document.querySelectorAll('.feature-list-item').forEach(item => {
                    item.classList.remove('topo-highlight');
                });
                li.classList.add('topo-highlight');
                removeInlineButtons(); // Remove any existing placeholder
                insertInlineButtons(li); // Insert new placeholder below the selected item
                highlightSVGItem(index);
            }
        });

        // Label input for all features
        const labelInput = createInput("text", feature.label || "", (e) => {
            feature.label = e.target.value;
            updateSVG();
        });

        // Row numbers
        const id_span = document.createElement("span");
        id_span.classList.add("id_span");
        id_span.textContent = index;

        li.appendChild(id_span);
        li.appendChild(labelInput);

        // Display parameters and create input fields for editable parameters
        if (feature.type === "line") {
            const lengthInput = createInput("number", feature.length, (e) => {
                feature.length = parseFloat(e.target.value);
                updateSVG();
            });

            const slopeInput = createInput("number", feature.slope, (e) => {
                feature.slope = parseFloat(e.target.value);
                updateSVG();
            });

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

        // Add buttons for deleting
        const deleteButton = createButton("X", () => {
            config.features.splice(index, 1);
            refresh();
        });
        deleteButton.classList.add('delete_button');

        // Append buttons and input fields to the list item
        li.appendChild(deleteButton);
        featureList.appendChild(li);
    });



    initializeSortable();
    addHightlightEvents(); // we force a refresh because of a load-time delay
}

// Helper function to create input fields
function createInput(type, value, onChange) {
    const input = document.createElement("input");
    input.type = type;
    // Set the appropriate value or checked attribute based on the input type
    if (type === "checkbox") {
        input.checked = value; // Use "checked" for checkboxes
    } else {
        input.value = value; // Use "value" for other input types
    }
    input.addEventListener("change", onChange);
    return input;
}

// Helper function to create buttons
function createButton(text, onClick) {
    const button = document.createElement("button");
    button.textContent = text;
    button.addEventListener("click", onClick);
    return button;
}

function updateSVG() {
    try {
        displayConfigAsYAML();
        const drawInstance = new Draw(config);
        drawInstance.draw();
        const svg = drawInstance.generateSVG();
        document.getElementById("svg-preview").innerHTML = svg;
        addHightlightEvents();
    } catch (error) {
        document.getElementById(
            "svg-preview"
        ).innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
    }
}

function setup() {
    document
        .getElementById("load-yaml-button")
        .addEventListener("click", loadYAMLIntoConfig);
    document
        .getElementById("update-button")
        .addEventListener("click", updateSVG);
    document
        .getElementById("highlight-checkbox")
        .addEventListener("change", function () {
            if (this.checked) {
                highlight_mode = true;
            } else {
                highlight_mode = false;
            }
        });
    document.getElementById('save-btn').addEventListener('click', function () {
        const newYamlContent = document.getElementById('yaml-textbox').value;
        const pageName = rw_page_from_url();
        saveChangesToMediaWiki(pageName, newYamlContent);
    });

    loadYAMLIntoConfig();
    refresh();
    featureListContainer = document.getElementById('feature-list-container');
    featureListContainer.append(generateFeatureButtons());

}

RW_DOMAIN = "https://ropewiki.attack-kitten.com";
window.addEventListener("load", setup);
window.addEventListener("load", fetch_yaml_from_ropewiki);