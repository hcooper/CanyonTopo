
function rw_page_from_url() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get("rw");
}


function fetch_yaml_from_ropewiki() {
  const pageName = rw_page_from_url();

  if (!pageName) {
    console.warn('No page name found in URL parameters');
    return;
  }

  if (!RW_DOMAIN) {
    console.error('RW_DOMAIN is not defined');
    return;
  }

  fetch(
    `${RW_DOMAIN}/api.php?action=query&titles=${encodeURIComponent(pageName)}&prop=revisions&rvprop=content&format=json`
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (!data.query || !data.query.pages) {
        throw new Error('Invalid API response format');
      }
      
      const page = Object.values(data.query.pages)[0];
      if (!page || page.missing) {
        throw new Error(`Page "${pageName}" not found`);
      }
      
      if (!page.revisions || !page.revisions[0]) {
        throw new Error('No revisions found for page');
      }
      
      const yamlContent = page.revisions[0]["*"];
      if (!yamlContent) {
        throw new Error('Page content is empty');
      }

      try {
        const newConfig = jsyaml.load(yamlContent);
        if (newConfig) {
          config = newConfig;
          updateSVG();
          renderFeatureList();
        } else {
          throw new Error('YAML parsing resulted in null/undefined config');
        }
      } catch (yamlError) {
        throw new Error(`YAML parsing failed: ${yamlError.message}`);
      }
    })
    .catch((error) => {
      console.error("Error fetching YAML:", error);
      alert(`Failed to load page data: ${error.message}`);
    });
}



function getEditToken(pageName) {
  if (!window.topo.RW_DOMAIN) {
    return Promise.reject(new Error('RW_DOMAIN is not defined'));
  }

  return fetch(
    `${window.topo.RW_DOMAIN}/api.php?action=query&meta=tokens&type=csrf&format=json`
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (!data.query || !data.query.tokens || !data.query.tokens.csrftoken) {
        throw new Error('Invalid token response format');
      }
      const token = data.query.tokens.csrftoken;
      if (!token || token === '+\\') {
        throw new Error('Invalid or missing CSRF token');
      }
      return token;
    })
    .catch((error) => {
      console.error("Error fetching edit token:", error);
      throw error;
    });
}

export function saveChangesToMediaWikiAPI(name, newYamlContent, onSuccess, onError) {
  if (!name || typeof name !== 'string') {
    console.error('Invalid page name provided');
    if (onError) onError(new Error('Invalid page name provided'));
    return;
  }
  
  if (!newYamlContent || typeof newYamlContent !== 'string') {
    console.error('Invalid YAML content provided');
    if (onError) onError(new Error('Invalid YAML content provided'));
    return;
  }
  
  if (!window.topo.RW_DOMAIN) {
    console.error('RW_DOMAIN is not configured');
    if (onError) onError(new Error('RW_DOMAIN is not configured'));
    return;
  }

  getEditToken(name)
    .then((token) => {
      const formData = new URLSearchParams();
      formData.append("action", "edit");
      formData.append("title", name);
      formData.append("text", newYamlContent);
      formData.append("token", token);
      formData.append("format", "json");

      return fetch(`${window.topo.RW_DOMAIN}/api.php`, {
        method: "POST",
        body: formData,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      });
    })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      if (data.edit && data.edit.result === "Success") {
        console.log("Page updated successfully:", data);
        if (onSuccess) onSuccess(data);
      } else if (data.error) {
        throw new Error(data.error.info || data.error.code || 'Unknown API error');
      } else {
        throw new Error('Unexpected response format');
      }
    })
    .catch((error) => {
      console.error("Error updating page:", error);
      if (onError) onError(error);
    });
}
