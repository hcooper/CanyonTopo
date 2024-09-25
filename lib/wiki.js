function getEditToken(pageName) {
  return fetch(
    `https://ropewiki.attack-kitten.com/api.php?action=query&meta=tokens&type=csrf&format=json&origin=*`
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
    fetch("https://your-wiki-url/api.php?origin=*", {
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
