function displayConfigAsYAML() {
  // Clone the config to avoid modifying the original object
  const tempConfig = JSON.parse(JSON.stringify(config));

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

  document.getElementById("yaml-textbox").value = yamlString;
}

function loadYAMLIntoConfig() {
  raw_yaml_config = document.getElementById("yaml-textbox").value;
  // console.log('Parsing ', raw_yaml_config);

  if (!raw_yaml_config) {
    // console.log('Loading defaults')
    // raw_yaml_config = `canyon_name: ${pageCanyonName},\nfeatures: []`;
    config = { 'canyon_name': pageCanyonName, 'features': [] };
  } else {

    const newConfig = jsyaml.load(raw_yaml_config);
    if (newConfig) {
      config = newConfig;
    }
  }
  console.log('Loaded: ', config);
}