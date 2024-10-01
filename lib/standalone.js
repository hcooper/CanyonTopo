document
.getElementById("load-yaml-button")
.addEventListener("click", loadYAMLIntoConfig);
document
.getElementById("update-button")
.addEventListener("click", updateSVG);

window.addEventListener("load", fetch_yaml_from_ropewiki);



// function quick_draw(raw) {
//   config = jsyaml.load(raw);
//   const drawInstance = new Draw(config);
//   drawInstance.draw();
//   document.getElementById("svg-preview").innerHTML = drawInstance.generateSVG();
// }