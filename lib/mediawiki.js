console.log('[topo] loading mediawiki.js');
let pageCanyonName = mw.config.get('wgPageName').replace(/_/g, ' ').replace(/^Topo:/,'');
let pageFullName = mw.config.get('wgPageName');
console.log("[topo] ", pageCanyonName, pageFullName);

// let pageCanyonName = "Mineral Creek (Alpine Lakes)";
// let pageFullName = "Topo:Mineral_Creek_(Alpine_Lakes)";