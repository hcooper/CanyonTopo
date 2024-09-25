function initializeSortable() {
  const featureList = document.getElementById("feature-list");

  Sortable.create(featureList, {
    animation: 150,
    onEnd: function (/**Event*/ evt) {
      const oldIndex = evt.oldIndex;
      const newIndex = evt.newIndex;

      // Reorder the config.features array
      const movedItem = config.features.splice(oldIndex, 1)[0];
      config.features.splice(newIndex, 0, movedItem);

      // Update SVG and list
      updateSVG();
      renderFeatureList();
    },
  });
}

function scrollToNewItem() {
  const featureListContainer = document.getElementById(
    "feature-list-container"
  );
  const featureList = document.getElementById("feature-list");
  const lastItem = featureList.lastElementChild;

  // Scroll the feature list container to the bottom
  featureListContainer.scrollTop = featureListContainer.scrollHeight;

  // Add fade-in class to the last item
  lastItem.classList.add("fade-in");

  // Remove the fade-in class after animation completes
  setTimeout(() => {
    lastItem.classList.remove("fade-in");
  }, 1000); // Match the CSS animation duration
}

function scrollToItem(index) {
  const listItem = document.getElementById(`list-item-${index}`);
  const container = document.getElementById("feature-list-container");

  if (listItem && container) {
    // Scroll the container such that the listItem is visible
    container.scrollTop =
      listItem.offsetTop -
      container.offsetTop -
      container.clientHeight / 2 +
      listItem.clientHeight / 2;
  }
}
