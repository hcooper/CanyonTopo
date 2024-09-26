
RW_DOMAIN = "https://ropewiki.attack-kitten.com";


function fetch_yaml_from_ropewiki() {
  const urlParams = new URLSearchParams(window.location.search);
  const pageName = urlParams.get("rw");

  if (pageName) {
    fetch(
      `${RW_DOMAIN}/api.php?action=query&titles=${pageName}&prop=revisions&rvprop=content&format=json`
    )
      .then((response) => response.json())
      .then((data) => {

        const page = Object.values(data.query.pages)[0];
        const yamlContent = page.revisions[0]["*"];

        const newConfig = jsyaml.load(yamlContent);
        if (newConfig) {
          config = newConfig;
          updateSVG();
          renderFeatureList();
        }
      })
      .catch((error) => console.error("Error fetching YAML:", error));
  }
}

// Call the function at page load
window.addEventListener("load", fetch_yaml_from_ropewiki);


function getEditToken(pageName) {
  return fetch(
    `${RW_DOMAIN}/api.php?action=query&meta=tokens&type=csrf&format=json`
  )
    .then((response) => response.json())
    .then((data) => {
      const token = data.query.tokens.csrftoken;
      return token;
    })
    .catch((error) => console.error("Error fetching edit token:", error));
}
function saveChangesToMediaWiki(pageName, newYamlContent) {
  getEditToken(pageName).then((token) => {
    const formData = new URLSearchParams();
    formData.append("action", "edit");
    formData.append("title", pageName);
    formData.append("text", newYamlContent); // The new YAML content
    formData.append("token", token); // CSRF edit token
    formData.append("format", "json");

    // Send the request to save the changes
    fetch(`${RW_DOMAIN}/api.php?`, {
      method: "POST",
      body: formData,
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.edit && data.edit.result === "Success") {
          console.log("Page updated successfully:", data);
        } else {
          console.error("Error saving changes:", data);
        }
      })
      .catch((error) => console.error("Error updating page:", error));
  });
}
