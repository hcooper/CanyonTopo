function addHightlightEvents() {
  // svg -> list
  const svgElements = document.querySelectorAll(["text", "line", "path"]);
  svgElements.forEach((element) => {
    element.addEventListener("mouseover", function () {
      if (highlight_mode) {
        const index = element.getAttribute("data-index");
        highlightListItem(index);
        highlightSVGItem(index);
      }
    });
    element.addEventListener("mouseout", function () {
      if (highlight_mode) {
        const index = element.getAttribute("data-index");
        removeHighlightFromListItem(index);
        removeHighlightFromSVGItem(index);
      }
    });
  });

  // list -> svg
  const listElements = document.querySelectorAll(".feature-list-item");
  listElements.forEach((element) => {
    element.addEventListener("mouseover", function () {
      if (highlight_mode) {
        const index = element.getAttribute("id").split("-")[2];
        highlightSVGItem(index);
        highlightListItem(index);
      }
    });
    element.addEventListener("mouseout", function () {
      if (highlight_mode) {
        const index = element.getAttribute("id").split("-")[2];
        removeHighlightFromSVGItem(index);
        removeHighlightFromListItem(index);
      }
    });
  });
}

function highlightListItem(index) {
  const listItem = document.querySelector(`#list-item-${index}`);
  if (listItem) {
    scrollToItem(index);
    listItem.classList.add("topo-highlight");
  }
}

function removeHighlightFromListItem(index) {
  const listItem = document.querySelector(`#list-item-${index}`);
  if (listItem) {
    listItem.classList.remove("topo-highlight");
  }
}

function highlightSVGItem(index) {
  const listItem = document.querySelector(`svg [data-index="${index}"]`);
  if (listItem) {
    listItem.classList.add("topo-highlight-svg");
  }
}

function removeHighlightFromSVGItem(index) {
  const listItem = document.querySelector(`svg [data-index="${index}"]`);
  if (listItem) {
    listItem.classList.remove("topo-highlight-svg");
  }
}
