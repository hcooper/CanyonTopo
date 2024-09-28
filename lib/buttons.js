function insertFeature(newFeature) {
    if (selectedItemIndex !== null) {
        config.features.splice(selectedItemIndex + 1, 0, newFeature);
    } else {
        config.features.push(newFeature);
    }
    refresh();
    // scrollToNewItem();
}


function generateFeatureButtons() {
    const buttons = [
        { id: 'add-line', text: 'Add Line', func: () => insertFeature({ type: "line", slope: 0, length: 30, shorten: false, traverse: false }) },
        { id: 'add-rap', text: 'Add Rap', func: () => insertFeature({ type: "rap", slope: 90, length: 100 }) },
        { id: 'add-pool', text: 'Add Pool', func: () => insertFeature({ type: "pool", width: 50, depth: 20 }) },
        { id: 'add-anchor', text: 'Add Anchor', func: () => insertFeature({ type: "anchor", style: "bolt", count: 1 }) },
        { id: 'add-exit', text: 'Add Exit', func: () => insertFeature({ type: "exit" }) },
        { id: 'add-break', text: 'Add Break', func: () => insertFeature({ type: "break" }) }
    ];

    buttons_div = document.createElement('div')

    buttons.forEach(buttonInfo => {
        const button = document.createElement('button');
        button.id = buttonInfo.id;
        button.textContent = buttonInfo.text;
        button.addEventListener("click", buttonInfo.func);
        buttons_div.appendChild(button);
    });

    return buttons_div;
}


function insertInlineButtons(selectedItem) {
    const inlineButtons = document.createElement('div');
    inlineButtons.id = 'inlineButtons';
    inlineButtons.classList.add('inlineButtons');

    inlineButtons.append(generateFeatureButtons());
    selectedItem.insertAdjacentElement('afterend', inlineButtons);
}

function removeInlineButtons() {
    const inlineButtons = document.getElementById('inlineButtons');
    if (inlineButtons) {
        inlineButtons.remove();
    }
}