// Main export file for UI components
// Re-exports all public components for easier imports elsewhere

// Navigation and view management
export { 
  initializeUI, 
  initializeUniversalNavigation, 
  navigateToView,
  navigateHistoryBack,
  navigateHistoryForward 
} from './navigation.js';

// Search functionality
export { 
  displaySearchResults, 
  showStatus 
} from './searchUI.js';

// Node detail display
export { 
  displayNodeDetails,
  renderNodeDetails 
} from './nodeDetails.js';

// Cluster panel
export { 
  setupClusterPanel, 
  navigateToClusterView, 
  navigateToFilteredView 
} from './clusterPanel.js';

// Filter panel
export { 
  renderFilteredNodesView,
  extractExcerptWithKeyword 
} from './filterPanel.js';

// Hierarchical tags
export { 
  createHierarchicalTags 
} from './hierarchyUI.js';

// Common utilities
export { 
  VIEW_TYPE, 
  getDOMReferences, 
  getDOMReference,
  setDOMReferences 
} from './common.js';