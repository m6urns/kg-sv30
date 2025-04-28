// UI navigation system for knowledge graph visualization
import { focusOnNode, navigateBack, navigateForward, addToNodeViewHistory } from '../nodeInteraction.js';
import { VIEW_TYPE, getDOMReference, getDOMReferences, getElementByIdIfExists } from './common.js';

// View history structure to unify navigation
let _viewHistory = [];
let _currentViewIndex = -1;

/**
 * Initialize UI components
 * @param {HTMLElement} searchResults - The search results container
 * @param {HTMLElement} searchInput - The search input element
 * @param {HTMLElement} clusterPanel - The cluster panel element
 */
export function initializeUI(searchResults, searchInput, clusterPanel) {
  // Store DOM references
  const domReferences = {
    searchResults,
    searchInput,
    clusterPanel,
    navigationPanel: getElementByIdIfExists('navigation-panel'),
    clustersContainer: getElementByIdIfExists('clusters-container')
  };
  
  // Set DOM references in the common module
  import('./common.js').then(module => {
    module.setDOMReferences(domReferences);
  });
  
  // Create filtered nodes panel - will be inserted in the same container as navigation panel
  const filteredNodesPanel = document.createElement('div');
  filteredNodesPanel.id = 'filtered-nodes-panel';
  filteredNodesPanel.style.display = 'none';
  filteredNodesPanel.className = 'filtered-nodes-panel';
  
  // Insert filtered nodes panel after navigation panel
  if (domReferences.navigationPanel) {
    domReferences.navigationPanel.parentNode.insertBefore(
      filteredNodesPanel, 
      domReferences.navigationPanel.nextSibling
    );
    
    // Add to DOM references
    domReferences.filteredNodesPanel = filteredNodesPanel;
  }
  
  // Initially hide the navigation panel
  if (domReferences.navigationPanel) {
    domReferences.navigationPanel.style.display = 'none';
  }
  
  // Initially show clusters and set its height
  if (domReferences.clustersContainer) {
    domReferences.clustersContainer.style.display = 'flex';
    domReferences.clustersContainer.style.height = '100%';
  }

  // Initialize view history with clusters view
  _viewHistory = [{ type: VIEW_TYPE.CLUSTERS }];
  _currentViewIndex = 0;

  // Create universal navigation buttons
  initializeUniversalNavigation();

  // Expose displayNodeDetails to the global scope for nodeInteraction.js to use
  // This will be refactored in future updates to use proper imports
  window.displayNodeDetails = (data, nodeViewHistory) => {
    import('./nodeDetails.js').then(module => {
      module.displayNodeDetails(data, nodeViewHistory);
    });
  };
}

/**
 * Initialize universal navigation buttons that will be shown across all views
 */
export function initializeUniversalNavigation() {
  // Make this function available globally for legacy support
  window.initializeUniversalNavigation = initializeUniversalNavigation;
  
  // Remove any existing navigation buttons to avoid duplicates
  const existingNavButtons = getElementByIdIfExists('navigation-buttons');
  if (existingNavButtons) {
    existingNavButtons.remove();
  }

  // Create navigation buttons container
  const navigationButtons = document.createElement('div');
  navigationButtons.id = 'navigation-buttons';
  
  // Create a container for button labels for better styling
  const backButtonContainer = document.createElement('div');
  backButtonContainer.className = 'nav-button-container';
  
  // Add back button
  const backButton = document.createElement('button');
  backButton.id = 'universal-back-button';
  backButton.className = 'nav-button';
  backButton.textContent = 'Back';
  backButton.onclick = navigateHistoryBack;
  backButton.disabled = true; // Disabled initially
  backButton.classList.add('disabled');
  backButtonContainer.appendChild(backButton);
  navigationButtons.appendChild(backButtonContainer);
  
  // Add home/overview button container
  const overviewButtonContainer = document.createElement('div');
  overviewButtonContainer.className = 'nav-button-container';
  
  // Add home/overview button
  const overviewButton = document.createElement('button');
  overviewButton.id = 'universal-overview-button';
  overviewButton.className = 'nav-button overview';
  overviewButton.textContent = 'Overview';
  
  overviewButton.onclick = () => {
    navigateToView({ type: VIEW_TYPE.CLUSTERS });
  };
  overviewButtonContainer.appendChild(overviewButton);
  navigationButtons.appendChild(overviewButtonContainer);
  
  // Add forward button container
  const forwardButtonContainer = document.createElement('div');
  forwardButtonContainer.className = 'nav-button-container';
  
  // Add forward button
  const forwardButton = document.createElement('button');
  forwardButton.id = 'universal-forward-button';
  forwardButton.className = 'nav-button';
  forwardButton.textContent = 'Forward';
  forwardButton.onclick = navigateHistoryForward;
  forwardButton.disabled = true; // Disabled initially
  forwardButton.classList.add('disabled');
  forwardButtonContainer.appendChild(forwardButton);
  navigationButtons.appendChild(forwardButtonContainer);
  
  // Make buttons always visible
  navigationButtons.style.display = 'flex';
  
  // Important: Add to body instead of sidebar to ensure it's always visible
  // This prevents it from being hidden when switching between views
  document.body.appendChild(navigationButtons);
  
  // Update button state immediately
  updateNavigationButtonsState();
}

/**
 * Navigate to a specific view in the UI
 * @param {Object} viewData - Data describing the view to navigate to
 * @param {string} viewData.type - Type of view (from VIEW_TYPE constants)
 * @param {Object} [viewData.data] - Additional data needed for the view
 * @param {boolean} [fromHistory=false] - Whether this navigation is from history navigation
 * @param {boolean} [replaceCurrentView=false] - Whether to replace the current view instead of adding a new one
 */
export function navigateToView(viewData, fromHistory = false, replaceCurrentView = false) {
  if (!viewData || !viewData.type) return;
  
  // If not navigating from history, add to history
  if (!fromHistory) {
    // Special handling for node views to avoid duplicates in history
    if (viewData.type === VIEW_TYPE.NODE && viewData.data && viewData.data.nodeId) {
      // Check if we're already on a node view
      const currentView = _currentViewIndex >= 0 ? _viewHistory[_currentViewIndex] : null;
      
      if (currentView && currentView.type === VIEW_TYPE.NODE && 
          currentView.data && currentView.data.nodeId === viewData.data.nodeId) {
        // If we're clicking the same node again, don't add to history
        replaceCurrentView = true;
      }
      
      // Check if this node is already in the next position in history
      if (_currentViewIndex < _viewHistory.length - 1) {
        const nextView = _viewHistory[_currentViewIndex + 1];
        if (nextView && nextView.type === VIEW_TYPE.NODE && 
            nextView.data && nextView.data.nodeId === viewData.data.nodeId) {
          // If the next view in history is this node, just navigate forward to it
          _currentViewIndex++;
          fromHistory = true;
        }
      }
    }
    
    if (!fromHistory) {
      if (replaceCurrentView && _currentViewIndex >= 0) {
        // Replace the current view
        _viewHistory[_currentViewIndex] = viewData;
      } else {
        // If navigating forward (not backward through history)
        // Add the new view to history at the current position
        if (_currentViewIndex < _viewHistory.length - 1) {
          // We're in the middle of history, append after the current position
          _viewHistory.splice(_currentViewIndex + 1, 0, viewData);
          _currentViewIndex++;
        } else {
          // We're at the end of history, just append
          _viewHistory.push(viewData);
          _currentViewIndex = _viewHistory.length - 1;
        }
      }
    }
  }

  const refs = getDOMReferences();
  
  // Hide all panels first
  if (refs.navigationPanel) refs.navigationPanel.style.display = 'none';
  if (refs.clustersContainer) refs.clustersContainer.style.display = 'none';
  if (refs.filteredNodesPanel) refs.filteredNodesPanel.style.display = 'none';
  
  // Show the appropriate panel based on view type
  switch (viewData.type) {
    case VIEW_TYPE.CLUSTERS:
      if (refs.clustersContainer) {
        refs.clustersContainer.style.display = 'flex';
        refs.clustersContainer.style.height = '100%';
        // Reset scroll position to the top
        if (refs.clusterPanel) refs.clusterPanel.scrollTop = 0;
      }
      break;
      
    case VIEW_TYPE.NODE:
      if (refs.navigationPanel) {
        refs.navigationPanel.style.display = 'flex';
        refs.navigationPanel.style.height = '100%';
        
        // If we have node data, we might need to refresh the content
        if (viewData.data && viewData.data.nodeId) {
          if (!fromHistory) {
            // This will be handled by focusOnNode which calls displayNodeDetails
          } else if (window.focusOnNode) {
            // When navigating from history, we need to explicitly focus the node
            // to ensure the graph visualization is updated
            window.focusOnNode(viewData.data.nodeId, true);
          }
        } else if (viewData.data && viewData.data.nodeData) {
          // We already have the node data, just display it
          import('./nodeDetails.js').then(module => {
            module.renderNodeDetails(viewData.data.nodeData);
          });
        }
      }
      break;
      
    case VIEW_TYPE.FILTERED:
      if (refs.filteredNodesPanel) {
        refs.filteredNodesPanel.style.display = 'flex';
        refs.filteredNodesPanel.style.height = '100%';
        
        // If we have filter data and this isn't from history navigation,
        // we need to re-run the filter
        if (viewData.data && viewData.data.keyword && viewData.data.communityId) {
          import('./filterPanel.js').then(module => {
            module.renderFilteredNodesView(viewData.data.keyword, viewData.data.communityId);
          });
        }
      }
      break;
  }
  
  // Update navigation buttons state
  updateNavigationButtonsState();
  
  // Ensure the navigation buttons exist and are visible
  const navigationButtons = getElementByIdIfExists('navigation-buttons');
  if (!navigationButtons) {
    // If navigation buttons don't exist, reinitialize them
    initializeUniversalNavigation();
  } else {
    // Make sure they're visible and have proper styles
    navigationButtons.style.display = 'flex';
    navigationButtons.style.zIndex = '9999';
    navigationButtons.style.position = 'fixed';
  }
}

/**
 * Update the state of navigation buttons based on current history position
 */
function updateNavigationButtonsState() {
  const backButton = getElementByIdIfExists('universal-back-button');
  const forwardButton = getElementByIdIfExists('universal-forward-button');
  
  if (!backButton || !forwardButton) return;
  
  // Update back button
  if (_currentViewIndex > 0) {
    backButton.disabled = false;
    backButton.classList.remove('disabled');
  } else {
    backButton.disabled = true;
    backButton.classList.add('disabled');
  }
  
  // Update forward button
  if (_currentViewIndex < _viewHistory.length - 1) {
    forwardButton.disabled = false;
    forwardButton.classList.remove('disabled');
  } else {
    forwardButton.disabled = true;
    forwardButton.classList.add('disabled');
  }
}

/**
 * Navigate backward in the view history
 */
export function navigateHistoryBack() {
  if (_currentViewIndex > 0) {
    _currentViewIndex--;
    const previousView = _viewHistory[_currentViewIndex];
    
    // For node views, we also need to update the node-specific navigation 
    // to keep the two navigation systems in sync
    if (previousView.type === VIEW_TYPE.NODE && previousView.data && previousView.data.nodeId) {
      // Import navigateBack function if available
      if (typeof window.graphNodesNavigation === 'undefined') {
        // Store node navigation functions for future reference
        window.graphNodesNavigation = {
          nodeViewHistory: [],
          currentNodeId: null,
          navigateToNode: function(nodeId) {
            // Find the node in graph viz
            if (window.graphViz && window.graphViz.nodes) {
              const node = window.graphViz.nodes.find(n => n.id === nodeId);
              if (node) {
                // Import focusOnNode from nodeInteraction
                const focusOnNode = window.focusOnNode || 
                  (window.nodeInteraction && window.nodeInteraction.focusOnNode);
                
                if (typeof focusOnNode === 'function') {
                  focusOnNode(nodeId, true); // true = from navigation
                }
              }
            }
          }
        };
      }
      
      // We're navigating to a node view, so we need to ensure the node is highlighted
      // and properly focused in the graph visualization
      if (window.focusOnNode) {
        window.focusOnNode(previousView.data.nodeId, true); // true = from navigation
      }
    }
    
    // Continue with normal view navigation
    navigateToView(previousView, true);
  }
}

/**
 * Navigate forward in the view history
 */
export function navigateHistoryForward() {
  if (_currentViewIndex < _viewHistory.length - 1) {
    _currentViewIndex++;
    const nextView = _viewHistory[_currentViewIndex];
    
    // For node views, we also need to update the node-specific visualization
    if (nextView.type === VIEW_TYPE.NODE && nextView.data && nextView.data.nodeId) {
      // We're navigating to a node view, so we need to ensure the node is highlighted
      // and properly focused in the graph visualization
      if (window.focusOnNode) {
        window.focusOnNode(nextView.data.nodeId, true); // true = from navigation
      }
    }
    
    // Continue with normal view navigation
    navigateToView(nextView, true);
  }
}

/**
 * Navigate to cluster/overview view
 */
export function navigateToClusterView() {
  navigateToView({ type: VIEW_TYPE.CLUSTERS });
}

/**
 * Navigate to filtered view with keyword and community ID
 * @param {string} keyword - Keyword to filter by
 * @param {string|number} communityId - Community ID to filter within
 */
export function navigateToFilteredView(keyword, communityId) {
  navigateToView({
    type: VIEW_TYPE.FILTERED,
    data: {
      keyword,
      communityId
    }
  });
}