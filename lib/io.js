function displayConfigAsYAML() {
  // Clone the config to avoid modifying the original object
  const tempConfig = JSON.parse(JSON.stringify(config));

  // Create an array to store the processed features
  let processedFeatures = [];

  let yamlString = ``;

  // Process each feature
  tempConfig.features.forEach((feature) => {
    if (feature.hidden) {
      // Generate YAML for the hidden feature and comment it out
      let featureYAML = jsyaml.dump(feature);
      featureYAML = featureYAML.split('\n').map(line => '# ' + line).join('\n');
      processedFeatures.push(`# - ${featureYAML.split('\n').join('\n# ')}`);
    } else {
      // Generate YAML for visible features, properly formatted as a list item
      let featureYAML = jsyaml.dump(feature);
      processedFeatures.push(`- ${featureYAML.split('\n').join('\n  ')}`);
    }
  });

  // Recreate the final YAML structure TODO: automate this
  yamlString += `width: ${tempConfig.width}\n`;
  yamlString += `height: ${tempConfig.height}\n`;
  yamlString += `canyon_name: ${tempConfig.canyon_name}\n`;
  yamlString += `canyon_location: ${tempConfig.canyon_location}\n`;
  yamlString += `canyon_grade: ${tempConfig.canyon_grade}\n`;
  yamlString += `features:\n`;

  // Add the processed features to the features block
  yamlString += processedFeatures.join('\n') + '\n';

  // Display the modified YAML string in the text area
  document.getElementById('yaml-textbox').value = yamlString;
}

function loadYAMLIntoConfig() {
  try {
    const yamlString = document.getElementById('yaml-textbox').value;  // Get YAML from the text box
    const newConfig = jsyaml.load(yamlString);  // Parse the YAML into a JavaScript object
    if (newConfig) {
      config = newConfig;  // Update the global config object
      updateSVG();  // Re-render the SVG
      renderFeatureList();  // Re-render the feature list
    }
  } catch (error) {
    alert('Invalid YAML format. Please fix the errors.');  // Handle invalid YAML
    console.error(error);
  }
}

function fetch_yaml_from_ropewiki() {
  const urlParams = new URLSearchParams(window.location.search);
  const pageName = urlParams.get('rw');

  if (pageName) {
    fetch(`https://ropewiki.attack-kitten.com/api.php?action=query&titles=${pageName}&prop=revisions&rvprop=content&format=json`)
      .then(response => response.json())
      .then(data => {
        console.log(data);

        const page = Object.values(data.query.pages)[0];
        const yamlContent = page.revisions[0]['*'];

        const newConfig = jsyaml.load(yamlContent);
        if (newConfig) {
          config = newConfig;
          updateSVG();
          renderFeatureList();
        }
      })
      .catch(error => console.error('Error fetching YAML:', error));
  }
}

// Call the function at page load
window.addEventListener('load', fetch_yaml_from_ropewiki);