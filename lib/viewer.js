/* This is a function to draw a topo with minimal code */
export function quick_draw(div_id, raw) {
    Promise.all([
        import('/topo/deps/js-yaml.min.js'),
        import('/topo/lib/draw.js')
    ])
        .then(([_, drawModule]) => {
            const config = jsyaml.load(raw);
            document.getElementById(div_id).innerHTML = new drawModule.Draw(config).draw();
        })
        .catch(error => {
            console.error('Error importing modules:', error);
        });
}