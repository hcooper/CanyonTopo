console.log('[topo] Loading io.js');

export function displayConfigAsYAML() {
  // Clone the config to avoid modifying the original object
  try {
    const tempConfig = JSON.parse(JSON.stringify(window.topo.config));

  // Create an array to store the processed features
  let processedFeatures = [];

  let yamlString = ``;

  if (tempConfig.canyon_name) {
    yamlString += `canyon_name: ${tempConfig.canyon_name}\n`;
  }
  if (tempConfig.canyon_location) {
    yamlString += `canyon_location: ${tempConfig.canyon_location}\n`;
  }
  if (tempConfig.canyon_grade) {
    yamlString += `canyon_grade: ${tempConfig.canyon_grade}\n`;
  }


  if (!tempConfig.features || !tempConfig.features.length) {
    yamlString += `features: []`;
    console.log('here', yamlString);
  } else {
    yamlString += `features:\n`;
  }

  if (processedFeatures) {
    // Add the processed features to the features block
    yamlString += processedFeatures.join("\n");
    tempConfig.features.forEach((feature) => {
      let featureYAML = jsyaml.dump(feature);
      processedFeatures.push(`- ${featureYAML.split("\n").join("\n  ")}`);
    });
  }

  yamlString += processedFeatures.join("\n") + "\n";

  const yamlTextbox = document.getElementById("yaml-textbox");
  if (yamlTextbox) {
    yamlTextbox.value = yamlString;
  } else {
    console.error('YAML textbox element not found');
  }
  } catch (error) {
    console.error('Error generating YAML display:', error);
    alert(`Failed to generate YAML: ${error.message}`);
  }
}

export function loadYAMLIntoConfig() {
  const yamlTextbox = document.getElementById("yaml-textbox");
  if (!yamlTextbox) {
    console.error('YAML textbox element not found');
    alert('Error: YAML input field not found on page');
    return;
  }
  let rawYamlConfig = yamlTextbox.value;
  // console.log('Parsing ', rawYamlConfig);

  if (!rawYamlConfig) {
    // console.log('Loading defaults')
    // rawYamlConfig = `canyon_name: ${pageCanyonName},\nfeatures: []`;
    window.topo.config = { 'canyon_name': window.topo.pageCanyonName, 'features': [] };
  } else {
    try {
      const newConfig = jsyaml.load(rawYamlConfig);
      if (newConfig) {
        window.topo.config = newConfig;
      } else {
        console.error('YAML parsing resulted in null/undefined config');
        alert('Error: YAML configuration is invalid or empty');
        return;
      }
    } catch (error) {
      console.error('YAML parsing error:', error);
      alert(`YAML parsing failed: ${error.message}`);
      return;
    }
  }
  console.log('Loaded: ', window.topo.config);
}