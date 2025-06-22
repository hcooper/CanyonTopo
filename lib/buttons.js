import {refresh} from './editor.js';

function insertFeature(newFeature) {
    if (window.topo.selectedItemIndex !== null) {
        window.topo.config.features.splice(window.topo.selectedItemIndex + 1, 0, newFeature);
        window.topo.selectedItemIndex = null; // this assumes that in-line additions only happen once
    } else {
        window.topo.config.features.push(newFeature);
    }
    refresh();
    // scrollToNewItem();
}


export function generateFeatureButtons() {
    const buttons = [
        { id: 'add-line', text: 'Add Line', func: () => insertFeature({ type: "line", slope: 0, length: 30, shorten: false, traverse: false }) },
        { id: 'add-rap', text: 'Add Rap', func: () => insertFeature({ type: "rap", slope: 90, length: 100 }) },
        { id: 'add-pool', text: 'Add Pool', func: () => insertFeature({ type: "pool", width: 50, depth: 20 }) },
        { id: 'add-anchor', text: 'Add Anchor', func: () => insertFeature({ type: "anchor", style: "bolt", count: 1 }) },
        { id: 'add-exit', text: 'Add Exit', func: () => insertFeature({ type: "exit" }) },
        { id: 'add-break', text: 'Add Break', func: () => insertFeature({ type: "break" }) }
    ];

    let buttons_div = document.createElement('div')

    buttons.forEach(buttonInfo => {
        const button = document.createElement('button');
        button.id = buttonInfo.id;
        button.textContent = buttonInfo.text;
        button.addEventListener("click", buttonInfo.func);
        buttons_div.appendChild(button);
    });

    return buttons_div;
}


export function insertInlineButtons(selectedItem) {
    console.log('insertInlineButtons called with:', selectedItem);
    
    const inlineButtons = document.createElement('div');
    inlineButtons.id = 'inlineButtons';
    inlineButtons.classList.add('inlineButtons');

    const buttons = generateFeatureButtons();
    console.log('Generated buttons:', buttons);
    
    inlineButtons.append(buttons);
    selectedItem.insertAdjacentElement('afterend', inlineButtons);
    
    console.log('Inline buttons inserted, inlineButtons element:', inlineButtons);
}

export function removeInlineButtons() {
    const inlineButtons = document.getElementById('inlineButtons');
    if (inlineButtons) {
        inlineButtons.remove();
    }
}