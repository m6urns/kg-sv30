// Common utilities and shared state for UI components

// Constants for view types to track navigation history
export const VIEW_TYPE = {
  CLUSTERS: 'clusters',
  NODE: 'node',
  FILTERED: 'filtered'
};

// DOM element references
let _domReferences = {
  searchResults: null,
  searchInput: null,
  clusterPanel: null,
  navigationPanel: null,
  clustersContainer: null,
  filteredNodesPanel: null
};

/**
 * Set DOM references for use across UI components
 * @param {Object} references - Object with DOM element references
 */
export function setDOMReferences(references) {
  _domReferences = { ..._domReferences, ...references };
}

/**
 * Get DOM references for use in UI components
 * @returns {Object} - All DOM references
 */
export function getDOMReferences() {
  return _domReferences;
}

/**
 * Get a specific DOM reference
 * @param {string} name - Name of the DOM reference to get
 * @returns {HTMLElement|null} - The DOM element or null if not found
 */
export function getDOMReference(name) {
  return _domReferences[name] || null;
}

/**
 * Check if an element exists in the DOM
 * @param {string} id - ID of the element to check
 * @returns {HTMLElement|null} - The element or null if not found
 */
export function getElementByIdIfExists(id) {
  return document.getElementById(id);
}