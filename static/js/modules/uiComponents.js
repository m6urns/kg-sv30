// UI components for the graph visualization
import { focusOnNode, navigateBack, navigateForward, canNavigateForward, addToNodeViewHistory, toggleFocusMode, isFocusModeEnabled } from './nodeInteraction.js';
import { fetchNodeDetails } from './dataService.js';

// DOM element references
let _searchResults = null;
let _searchInput = null;
let _clusterPanel = null;
let _navigationPanel = null;
let _clustersContainer = null;
let _filteredNodesPanel = null; // Panel for displaying nodes filtered by keywords

// Constants for view types to track navigation history
const VIEW_TYPE = {
  CLUSTERS: 'clusters',
  NODE: 'node',
  FILTERED: 'filtered'
};

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
  _searchResults = searchResults;
  _searchInput = searchInput;
  _clusterPanel = clusterPanel;
  
  // Get navigation panel and clusters container
  _navigationPanel = document.getElementById('navigation-panel');
  _clustersContainer = document.getElementById('clusters-container');
  
  // Create filtered nodes panel - will be inserted in the same container as navigation panel
  _filteredNodesPanel = document.createElement('div');
  _filteredNodesPanel.id = 'filtered-nodes-panel';
  _filteredNodesPanel.style.display = 'none';
  _filteredNodesPanel.className = 'filtered-nodes-panel';
  
  // Insert filtered nodes panel after navigation panel
  if (_navigationPanel) {
    _navigationPanel.parentNode.insertBefore(_filteredNodesPanel, _navigationPanel.nextSibling);
  }
  
  // Initially hide the navigation panel
  if (_navigationPanel) {
    _navigationPanel.style.display = 'none';
  }
  
  // Initially show clusters and set its height
  if (_clustersContainer) {
    _clustersContainer.style.display = 'flex';
    _clustersContainer.style.height = '100%';
  }

  // Initialize view history with clusters view
  _viewHistory = [{ type: VIEW_TYPE.CLUSTERS }];
  _currentViewIndex = 0;

  // Create universal navigation buttons
  initializeUniversalNavigation();

  // Expose displayNodeDetails to the global scope for nodeInteraction.js to use
  window.displayNodeDetails = displayNodeDetails;
}

/**
 * Initialize universal navigation buttons that will be shown across all views
 * Exported globally for access from other modules
 */
function initializeUniversalNavigation() {
  // Make this function available globally
  window.initializeUniversalNavigation = initializeUniversalNavigation;
  // Remove any existing navigation buttons to avoid duplicates
  const existingNavButtons = document.getElementById('navigation-buttons');
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
 * Show a status message
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, loading)
 * @param {HTMLElement} statusElement - Status element to update
 */
export function showStatus(message, type, statusElement) {
  if (!statusElement) return;
  // Hide standard status messages
  if (message && (message.includes("loaded") || message.includes("Loading"))) {
    statusElement.textContent = "";
    statusElement.className = "";
    return;
  }
  
  // Only show error messages
  if (type === "error") {
    statusElement.textContent = message;
    statusElement.className = type;
  } else {
    statusElement.textContent = "";
    statusElement.className = "";
  }
}

/**
 * Display search results in the UI with enhanced match information
 * @param {Array} results - Enhanced search result items
 */
export function displaySearchResults(results) {
  if (!_searchResults || !_searchInput) return;
  
  _searchResults.innerHTML = '';
  
  if (results.length === 0) {
    _searchResults.innerHTML = '<p class="p-2">No results found</p>';
    _searchResults.style.display = 'block';
    return;
  }
  
  const ul = document.createElement('ul');
  ul.className = 'search-results-list';
  
  results.forEach(result => {
    const li = document.createElement('li');
    li.className = 'search-result-item';
    
    // Create container for result header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'result-header';
    
    // Add node label as title
    const titleSpan = document.createElement('span');
    titleSpan.className = 'result-title';
    titleSpan.textContent = result.label;
    headerDiv.appendChild(titleSpan);
    
    // Add node type indicator
    const typeSpan = document.createElement('span');
    typeSpan.className = 'result-type';
    
    // Set type display name based on node type
    const typeLabels = {
      'topic': 'Theme',
      'document': 'Goal',
      'strategy': 'Strategy'
    };
    typeSpan.textContent = typeLabels[result.type] || result.type;
    headerDiv.appendChild(typeSpan);
    
    li.appendChild(headerDiv);
    
    // If we have match info, display it
    if (result.match_info && result.match_info.matches.length > 0) {
      // Create container for match summary
      const matchSummaryDiv = document.createElement('div');
      matchSummaryDiv.className = 'match-summary';
      matchSummaryDiv.textContent = result.match_summary || 'Match found';
      li.appendChild(matchSummaryDiv);
      
      // If we have a best match with text content, show a preview
      if (result.best_match && result.best_match.text) {
        // Create container for match preview
        const previewDiv = document.createElement('div');
        previewDiv.className = 'match-preview';
        
        // Get a relevant snippet of text with the match context
        let previewText = result.best_match.text;
        const query = _searchInput.value.trim().toLowerCase();
        
        // If text is long, create a snippet around the match
        if (previewText.length > 150) {
          const matchIndex = previewText.toLowerCase().indexOf(query);
          if (matchIndex >= 0) {
            // Get text before and after the match
            const startIndex = Math.max(0, matchIndex - 50);
            const endIndex = Math.min(previewText.length, matchIndex + query.length + 50);
            
            // Create snippet with ellipses if needed
            previewText = 
              (startIndex > 0 ? '...' : '') + 
              previewText.substring(startIndex, endIndex) + 
              (endIndex < previewText.length ? '...' : '');
          } else {
            // Just take the first 150 chars if match not found directly
            previewText = previewText.substring(0, 150) + '...';
          }
        }
        
        previewDiv.textContent = previewText;
        li.appendChild(previewDiv);
      }
    }
    
    li.addEventListener('click', async () => {
      try {
        // Hide search results
        _searchResults.style.display = 'none';
        _searchInput.value = '';
        
        // Focus on the node in the graph
        // This will trigger displayNodeDetails which adds to our unified navigation
        focusOnNode(result.id);
      } catch (error) {
        console.error('Error fetching node details:', error);
      }
    });
    
    ul.appendChild(li);
  });
  
  _searchResults.appendChild(ul);
  _searchResults.style.display = 'block';
}

/**
 * Navigate to a specific view in the UI
 * @param {Object} viewData - Data describing the view to navigate to
 * @param {string} viewData.type - Type of view (from VIEW_TYPE constants)
 * @param {Object} [viewData.data] - Additional data needed for the view
 * @param {boolean} [fromHistory=false] - Whether this navigation is from history navigation
 * @param {boolean} [replaceCurrentView=false] - Whether to replace the current view instead of adding a new one
 */
function navigateToView(viewData, fromHistory = false, replaceCurrentView = false) {
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
  
  // Hide all panels first
  if (_navigationPanel) _navigationPanel.style.display = 'none';
  if (_clustersContainer) _clustersContainer.style.display = 'none';
  if (_filteredNodesPanel) _filteredNodesPanel.style.display = 'none';
  
  // Show the appropriate panel based on view type
  switch (viewData.type) {
    case VIEW_TYPE.CLUSTERS:
      if (_clustersContainer) {
        _clustersContainer.style.display = 'flex';
        _clustersContainer.style.height = '100%';
        // Reset scroll position to the top
        if (_clusterPanel) _clusterPanel.scrollTop = 0;
      }
      break;
      
    case VIEW_TYPE.NODE:
      if (_navigationPanel) {
        _navigationPanel.style.display = 'flex';
        _navigationPanel.style.height = '100%';
        
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
          renderNodeDetails(viewData.data.nodeData);
        }
      }
      break;
      
    case VIEW_TYPE.FILTERED:
      if (_filteredNodesPanel) {
        _filteredNodesPanel.style.display = 'flex';
        _filteredNodesPanel.style.height = '100%';
        
        // If we have filter data and this isn't from history navigation,
        // we need to re-run the filter
        if (viewData.data && viewData.data.keyword && viewData.data.communityId) {
          renderFilteredNodesView(viewData.data.keyword, viewData.data.communityId);
        }
      }
      break;
  }
  
  // Update navigation buttons state
  updateNavigationButtonsState();
  
  // Ensure the navigation buttons exist and are visible
  const navigationButtons = document.getElementById('navigation-buttons');
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
  const backButton = document.getElementById('universal-back-button');
  const forwardButton = document.getElementById('universal-forward-button');
  
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
function navigateHistoryBack() {
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
function navigateHistoryForward() {
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
 * Display node details in the navigation panel
 * @param {Object} data - Node data with connections
 * @param {Array} nodeViewHistory - History of viewed nodes (deprecated, kept for compatibility)
 */
function displayNodeDetails(data, nodeViewHistory) {
  if (!_navigationPanel || !_clustersContainer) return;
  
  // Add node to view history for unified navigation
  navigateToView({
    type: VIEW_TYPE.NODE,
    data: {
      nodeId: data.node.id,
      nodeData: data
    }
  });
  
  // Legacy node history for compatibility with nodeInteraction.js
  const nodeId = data.node.id;
  addToNodeViewHistory(nodeId);
  
  // Render the node details content
  renderNodeDetails(data);
}

/**
 * Render node details in the navigation panel
 * @param {Object} data - Node data with connections
 */
function renderNodeDetails(data) {
  // Get the content wrapper
  const contentWrapper = document.getElementById('nav-content-wrapper');
  
  // Create a content container with padding
  let contentContainer;
  if (contentWrapper) {
    contentWrapper.innerHTML = '';
    // Add padding container for content
    contentContainer = document.createElement('div');
    contentContainer.className = 'nav-padding-container';
    contentContainer.style.padding = '20px';
    // Add extra bottom padding to ensure content isn't hidden behind buttons
    contentContainer.style.paddingBottom = '150px';
    contentWrapper.appendChild(contentContainer);
  }
  
  // Create header for the node
  const header = document.createElement('h2');
  header.textContent = data.node.label;
  contentContainer.appendChild(header);
  
  // Create hierarchical tags
  createHierarchicalTags(data, contentContainer);
  
  // Process content based on node type
  if (data.node.type === 'topic') {
    displayTopicDetails(data, contentContainer);
  } else if (data.node.type === 'document' && 
            (data.node.has_strategy_links || data.node.display_type === 'strategy_list') && 
            data.node.strategy_entries) {
    displayDocumentWithStrategies(data, contentContainer);
  } else if (data.node.type === 'strategy') {
    displayStrategyDetails(data, contentContainer);
  } else {
    displayGenericDetails(data, contentContainer);
  }
}

/**
 * Display details for topic nodes
 * @param {Object} data - Node data
 * @param {HTMLElement} contentWrapper - The content container
 */
function displayTopicDetails(data, contentWrapper) {
  // Create overview section
  const overviewSection = document.createElement('div');
  overviewSection.className = 'node-info-section';
  
  // Create metadata container
  const metaContainer = document.createElement('div');
  metaContainer.className = 'node-meta';
  
  // Add keywords if available - only if theme is not part of a community (not collected)
  if (data.node.keywords && data.node.keywords.length > 0 && !data.node.community_label) {
    const keywords = document.createElement('div');
    keywords.className = 'node-meta-item';
    keywords.innerHTML = '<strong>Keywords:</strong> ' + 
                        data.node.keywords.join(', ');
    metaContainer.appendChild(keywords);
  }
  
  overviewSection.appendChild(metaContainer);
  
  // Add description if available
  if (data.node.description || data.node.overview) {
    const description = document.createElement('p');
    description.className = 'node-description theme-description';
    description.textContent = data.node.overview || data.node.description;
    overviewSection.appendChild(description);
  }
  
  contentWrapper.appendChild(overviewSection);
  
  // Create related topics section if there are any
  const relatedTopics = data.connections
    .filter(conn => conn.node.type === 'topic')
    .map(conn => conn.node);
  
  if (relatedTopics.length > 0) {
    const topicsSection = document.createElement('div');
    topicsSection.className = 'node-info-section';
    
    const topicsTitle = document.createElement('h3');
    topicsTitle.textContent = 'Related Themes';
    topicsSection.appendChild(topicsTitle);
    
    const topicsList = document.createElement('ul');
    topicsList.className = 'hierarchy-list';
    
    relatedTopics.forEach(topic => {
      const item = document.createElement('li');
      item.className = 'theme-item';
      
      const link = document.createElement('a');
      link.textContent = topic.label;
      link.href = '#';
      link.onclick = (e) => {
        e.preventDefault();
        focusOnNode(topic.id);
      };
      
      item.appendChild(link);
      topicsList.appendChild(item);
    });
    
    topicsSection.appendChild(topicsList);
    contentWrapper.appendChild(topicsSection);
  }
  
  // Create related goals section
  const goalsSection = document.createElement('div');
  goalsSection.className = 'node-info-section';
  
  const docsTitle = document.createElement('h3');
  docsTitle.textContent = 'Related Goals';
  goalsSection.appendChild(docsTitle);
  
  const relatedDocs = data.connections
    .filter(conn => conn.node.type === 'document')
    .map(conn => conn.node);
  
  if (relatedDocs.length > 0) {
    const docList = document.createElement('ul');
    docList.className = 'hierarchy-list';
    
    relatedDocs.forEach(doc => {
      const item = document.createElement('li');
      item.className = 'goal-item';
      
      const link = document.createElement('a');
      link.textContent = doc.label;
      link.href = '#';
      link.onclick = (e) => {
        e.preventDefault();
        focusOnNode(doc.id);
      };
      
      item.appendChild(link);
      docList.appendChild(item);
    });
    
    goalsSection.appendChild(docList);
  } else {
    // Show message if no goals
    const noGoals = document.createElement('p');
    noGoals.className = 'empty-connections';
    noGoals.textContent = 'No goals associated with this theme';
    goalsSection.appendChild(noGoals);
  }
  
  contentWrapper.appendChild(goalsSection);
}

/**
 * Display details for document nodes with strategies
 * @param {Object} data - Node data
 * @param {HTMLElement} contentWrapper - The content container
 */
function displayDocumentWithStrategies(data, contentWrapper) {
  // Create overview section
  const overviewSection = document.createElement('div');
  overviewSection.className = 'node-info-section';
  
  // Note: We don't show the goal text since it's already in the title
  // Instead, show some metadata like theme
  const metaContainer = document.createElement('div');
  metaContainer.className = 'node-meta';
  
  // Find related topic/theme
  // const topic = data.connections
  //   .find(conn => conn.node.type === 'topic' && 
  //               (conn.relationship === 'belongs_to' || conn.relationship === 'part_of_theme'));
  
  // if (topic) {
  //   const topicInfo = document.createElement('div');
  //   topicInfo.className = 'node-meta-item';
  //   topicInfo.innerHTML = '<strong>Theme:</strong> ';
    
  //   const link = document.createElement('a');
  //   link.textContent = topic.node.label;
  //   link.href = '#';
  //   link.onclick = (e) => {
  //     e.preventDefault();
  //     focusOnNode(topic.node.id);
  //   };
    
  //   topicInfo.appendChild(link);
  //   metaContainer.appendChild(topicInfo);
  // }
  
  // Add metadata to the overview section
  overviewSection.appendChild(metaContainer);
  
  // Add goal description if different from label
  if (data.node.text && data.node.text !== data.node.label) {
    const text = document.createElement('p');
    text.textContent = data.node.text;
    text.className = 'node-description goal-description';
    overviewSection.appendChild(text);
  }
  
  contentWrapper.appendChild(overviewSection);
  
  // Create strategies section
  const strategiesSection = document.createElement('div');
  strategiesSection.className = 'node-info-section';
  
  // Add strategies header
  const strategiesTitle = document.createElement('h3');
  strategiesTitle.textContent = 'Strategies';
  strategiesSection.appendChild(strategiesTitle);
  
  // Create strategies list
  const strategiesList = document.createElement('ul');
  strategiesList.className = 'hierarchy-list';
  
  if (data.node.strategy_entries && data.node.strategy_entries.length > 0) {
    data.node.strategy_entries.forEach(strategy => {
      const item = document.createElement('li');
      item.className = 'strategy-item';
      
      const link = document.createElement('a');
      // Format according to the item_format if specified, otherwise use default format
      const displayText = strategy.section + ': ' + strategy.summary;
      link.textContent = displayText;
      link.href = strategy.url || '#';
      
      // Extract strategy ID from the URL if it exists
      let strategyId = strategy.id;
      if (!strategyId && strategy.url) {
        // If there's a URL like "#/strategy/strategy_id", extract the ID
        const match = strategy.url.match(/#\/strategy\/(.+)$/);
        if (match) strategyId = match[1];
      }
      
      if (strategyId) {
        link.onclick = (e) => {
          e.preventDefault();
          focusOnNode(strategyId);
        };
      }
      
      item.appendChild(link);
      strategiesList.appendChild(item);
    });
  } else {
    // Show message if no strategies
    const noStrategies = document.createElement('p');
    noStrategies.className = 'empty-connections';
    noStrategies.textContent = 'No strategies found for this goal';
    strategiesSection.appendChild(noStrategies);
  }
  
  strategiesSection.appendChild(strategiesList);
  contentWrapper.appendChild(strategiesSection);
}

/**
 * Display details for strategy nodes
 * @param {Object} data - Node data
 * @param {HTMLElement} contentWrapper - The content container
 */
function displayStrategyDetails(data, contentWrapper) {
  // Create overview section
  const overviewSection = document.createElement('div');
  overviewSection.className = 'node-info-section';
  
  // Create metadata container
  const metaContainer = document.createElement('div');
  metaContainer.className = 'node-meta';
  
  // Show section number if available
  // if (data.node.section_number) {
  //   const sectionInfo = document.createElement('div');
  //   sectionInfo.className = 'node-meta-item';
  //   sectionInfo.innerHTML = '<strong>Section:</strong> ' + data.node.section_number;
  //   metaContainer.appendChild(sectionInfo);
  // }
  
  // Show parent goal if available
  // const goal = data.connections
  //   .find(conn => conn.node.type === 'document' && 
  //               (conn.relationship === 'part_of_goal'));
  
  // if (goal) {
  //   const goalInfo = document.createElement('div');
  //   goalInfo.className = 'node-meta-item';
  //   goalInfo.innerHTML = '<strong>Goal:</strong> ';
    
  //   const link = document.createElement('a');
  //   link.textContent = goal.node.label;
  //   link.href = '#';
  //   link.onclick = (e) => {
  //     e.preventDefault();
  //     focusOnNode(goal.node.id);
  //   };
    
  //   goalInfo.appendChild(link);
  //   metaContainer.appendChild(goalInfo);
  // }
  
  // // Show theme if available
  // const theme = data.connections
  //   .find(conn => conn.node.type === 'topic');
  
  // if (theme) {
  //   const themeInfo = document.createElement('div');
  //   themeInfo.className = 'node-meta-item';
  //   themeInfo.innerHTML = '<strong>Theme:</strong> ';
    
  //   const link = document.createElement('a');
  //   link.textContent = theme.node.label;
  //   link.href = '#';
  //   link.onclick = (e) => {
  //     e.preventDefault();
  //     focusOnNode(theme.node.id);
  //   };
    
  //   themeInfo.appendChild(link);
  //   metaContainer.appendChild(themeInfo);
  // }
  
  // overviewSection.appendChild(metaContainer);
  
  // Show strategy text
  const text = document.createElement('p');
  text.textContent = data.node.text;
  text.className = 'node-description strategy-description';
  overviewSection.appendChild(text);
  
  contentWrapper.appendChild(overviewSection);
  
  // Display similar strategies section if available
  if (data.node.connections && data.node.connections.length > 0) {
    // Check if there are any similar strategies
    const similarStrategies = data.node.connections.filter(conn => 
      conn.node_type === 'strategy' || 
      (conn.relationship && conn.relationship.includes('similar')));
    
    if (similarStrategies.length > 0) {
      const similarSection = document.createElement('div');
      similarSection.className = 'node-info-section';
      
      // We'll append the similar strategies to this section
      displaySimilarStrategies(data.node, similarSection);
      
      contentWrapper.appendChild(similarSection);
    }
  }
}

/**
 * Display details for other node types
 * @param {Object} data - Node data
 * @param {HTMLElement} contentWrapper - The content container
 */
function displayGenericDetails(data, contentWrapper) {
  // Show document text
  const text = document.createElement('p');
  text.textContent = data.node.text;
  text.className = 'node-description';
  contentWrapper.appendChild(text);
  
  // Show related topic and/or goal
  const relationshipsContainer = document.createElement('div');
  
  const topic = data.connections
    .find(conn => conn.node.type === 'topic' && 
                (conn.relationship === 'belongs_to' || conn.relationship === 'part_of_theme'));
  
  if (topic) {
    const topicInfo = document.createElement('p');
    topicInfo.innerHTML = '<strong>Theme:</strong> ';
    
    const link = document.createElement('a');
    link.textContent = topic.node.label;
    link.href = '#';
    link.onclick = (e) => {
      e.preventDefault();
      focusOnNode(topic.node.id);
    };
    
    topicInfo.appendChild(link);
    relationshipsContainer.appendChild(topicInfo);
  }
  
  contentWrapper.appendChild(relationshipsContainer);
  
  // Add any other connections
  const otherConnections = data.connections
    .filter(conn => conn.node.type !== 'topic' || 
        (conn.relationship !== 'belongs_to' && conn.relationship !== 'part_of_theme'));
        
  if (otherConnections.length > 0) {
    const connectionsTitle = document.createElement('h3');
    connectionsTitle.textContent = 'Related Items:';
    contentWrapper.appendChild(connectionsTitle);
    
    const connectionsList = document.createElement('ul');
    connectionsList.className = 'hierarchy-list';
    
    otherConnections.forEach(conn => {
      const item = document.createElement('li');
      item.className = conn.node.type === 'topic' ? 'theme-item' : 
                     conn.node.type === 'document' ? 'goal-item' : 'strategy-item';
      
      const link = document.createElement('a');
      link.textContent = conn.node.label;
      link.href = '#';
      link.onclick = (e) => {
        e.preventDefault();
        focusOnNode(conn.node.id);
      };
      
      item.appendChild(link);
      connectionsList.appendChild(item);
    });
    
    contentWrapper.appendChild(connectionsList);
  }
}

/**
 * Display similar strategies panel
 * @param {Object} strategyNode - Strategy node data
 * @param {HTMLElement} container - Container to append to
 */
function displaySimilarStrategies(strategyNode, container) {
  // Create header
  const header = document.createElement('h3');
  header.textContent = 'Similar Strategies';
  container.appendChild(header);
  
  // Check if there are any similar strategies
  if (!strategyNode.connections || strategyNode.connections.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-connections';
    emptyMessage.textContent = 'No similar strategies found';
    container.appendChild(emptyMessage);
    return;
  }
  
  // Create list of similar strategies using the common list styling
  const strategiesList = document.createElement('ul');
  strategiesList.className = 'hierarchy-list';
  
  // Loop through connections and add them to the list
  strategyNode.connections.forEach(connection => {
    const item = document.createElement('li');
    item.className = 'strategy-item';
    
    // Create link to the strategy
    const link = document.createElement('a');
    
    // Use the display_label if available, otherwise use the node_label
    link.textContent = connection.node_label;
    link.href = '#';
    link.dataset.nodeId = connection.node_id;
    
    // Add click handler to navigate to the connected strategy
    link.onclick = (e) => {
      e.preventDefault();
      focusOnNode(connection.node_id);
    };
    
    item.appendChild(link);
    
    // Add context info as subtitle if available
    if (connection.theme_title || connection.goal_title) {
      const contextText = [];
      if (connection.theme_title) contextText.push(connection.theme_title);
      if (connection.goal_title) contextText.push(connection.goal_title);
      
      if (contextText.length > 0) {
        const contextInfo = document.createElement('small');
        contextInfo.className = 'item-context';
        contextInfo.textContent = contextText.join(' | ');
        item.appendChild(contextInfo);
      }
    }
    
    strategiesList.appendChild(item);
  });
  
  container.appendChild(strategiesList);
  
  // Add extra spacer div to ensure all content is visible
  const spacer = document.createElement('div');
  spacer.style.height = '50px';
  spacer.style.width = '100%';
  container.appendChild(spacer);
}

/**
 * Extract the top 10 keywords from a community by aggregating all topic keywords
 * @param {Object} community - Community data with topics
 * @returns {Array} - Array of [keyword, count] pairs for top 10 keywords
 */
function extractTopKeywords(community) {
  if (!community.topics || community.topics.length === 0) {
    return [];
  }
  
  // Collect all keywords from all topics in this community
  const keywordCounts = {};
  
  // Count occurrences of each keyword
  community.topics.forEach(topic => {
    if (topic.keywords && topic.keywords.length > 0) {
      topic.keywords.forEach(keyword => {
        if (!keywordCounts[keyword]) {
          keywordCounts[keyword] = 0;
        }
        keywordCounts[keyword]++;
      });
    }
  });
  
  // Convert to array of [keyword, count] pairs and sort
  const keywordPairs = Object.entries(keywordCounts);
  keywordPairs.sort((a, b) => b[1] - a[1]); // Sort by count descending
  
  // Return top 10 keywords with their counts (or all if less than 10)
  return keywordPairs.slice(0, 10);
}

/**
 * Extract a text excerpt that contains the keyword, highlighting the keyword
 * @param {string} text - The full text to extract from
 * @param {string} keyword - The keyword to highlight
 * @param {number} contextLength - Number of words to include before and after the keyword
 * @returns {string} HTML string with the excerpt and highlighted keyword
 */
function extractExcerptWithKeyword(text, keyword, contextWords = 8) {
  if (!text || typeof text !== 'string') return '';
  
  // Case insensitive search with word boundaries
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  
  // Find the keyword with word boundaries if possible
  const wordBoundaryRegex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
  const match = text.match(wordBoundaryRegex);
  
  // If no word boundary match, fall back to simple indexOf
  let keywordIndex;
  let matchedKeyword;
  
  if (match && match.index !== undefined) {
    keywordIndex = match.index;
    matchedKeyword = match[0]; // The actual matched text with correct case
  } else {
    keywordIndex = lowerText.indexOf(lowerKeyword);
    // If still not found, give up
    if (keywordIndex === -1) return '';
    matchedKeyword = text.substring(keywordIndex, keywordIndex + lowerKeyword.length);
  }
  
  // Split the text into words
  const words = text.split(/\s+/);
  const allText = words.join(' '); // Normalize spaces
  
  // Find which word contains our keyword
  let charCount = 0;
  let keywordWordIndex = -1;
  
  for (let i = 0; i < words.length; i++) {
    const nextCharCount = charCount + words[i].length + (i > 0 ? 1 : 0); // +1 for space
    
    if (keywordIndex >= charCount && keywordIndex < nextCharCount) {
      keywordWordIndex = i;
      break;
    }
    
    charCount = nextCharCount;
  }
  
  if (keywordWordIndex === -1) return ''; // Couldn't find the word somehow
  
  // Determine start and end word indices for the excerpt
  const startWordIndex = Math.max(0, keywordWordIndex - contextWords);
  const endWordIndex = Math.min(words.length, keywordWordIndex + contextWords + 1);
  
  // Extract the relevant words
  const excerptWords = words.slice(startWordIndex, endWordIndex);
  
  // Add ellipsis indicators
  let excerpt = excerptWords.join(' ');
  if (startWordIndex > 0) excerpt = '... ' + excerpt;
  if (endWordIndex < words.length) excerpt = excerpt + ' ...';
  
  // Escape HTML to prevent XSS
  excerpt = excerpt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Find the keyword in the escaped excerpt to highlight it
  // We need to find where it is in the excerpt, not the original text
  const excerptLower = excerpt.toLowerCase();
  const escapedKeywordLower = matchedKeyword.toLowerCase()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Look for the keyword with word boundaries in the escaped excerpt
  const excerptKeywordMatch = new RegExp(`\\b${escapedKeywordLower}\\b`, 'i');
  const excerptMatch = excerptLower.match(excerptKeywordMatch);
  
  // If we can't find it with word boundaries, look for it without them
  let excerptKeywordIndex;
  if (excerptMatch && excerptMatch.index !== undefined) {
    excerptKeywordIndex = excerptMatch.index;
  } else {
    excerptKeywordIndex = excerptLower.indexOf(escapedKeywordLower);
    if (excerptKeywordIndex === -1) {
      // If still can't find, just return the escaped excerpt without highlighting
      return excerpt;
    }
  }
  
  // Get the original case version of the keyword from the excerpt
  const excerptKeyword = excerpt.substring(
    excerptKeywordIndex, 
    excerptKeywordIndex + escapedKeywordLower.length
  );
  
  // Insert the span tags around the keyword
  const beforeKeyword = excerpt.substring(0, excerptKeywordIndex);
  const afterKeyword = excerpt.substring(excerptKeywordIndex + excerptKeyword.length);
  
  return beforeKeyword + 
         '<span class="keyword-highlight">' + excerptKeyword + '</span>' + 
         afterKeyword;
}

/**
 * Filter nodes by a specific keyword and display them in the left-hand panel
 * @param {string} keyword - The keyword to filter by
 * @param {string|number} communityId - The ID of the community the keyword is from
 */
function filterNodesByKeyword(keyword, communityId) {
  if (!_filteredNodesPanel || !window.graphViz || !window.graphViz.nodes) return;
  
  // Add to view history
  navigateToView({
    type: VIEW_TYPE.FILTERED,
    data: {
      keyword: keyword,
      communityId: communityId
    }
  });
  
  // Render the filtered nodes view
  renderFilteredNodesView(keyword, communityId);
}

/**
 * Render the filtered nodes view without changing navigation history
 * @param {string} keyword - The keyword to filter by
 * @param {string|number} communityId - The ID of the community the keyword is from
 */
function renderFilteredNodesView(keyword, communityId) {
  if (!_filteredNodesPanel || !window.graphViz || !window.graphViz.nodes) return;
  
  // Clear previous content
  _filteredNodesPanel.innerHTML = '';
  
  // Create content container with padding
  const contentContainer = document.createElement('div');
  contentContainer.className = 'nav-padding-container';
  contentContainer.style.padding = '20px';
  contentContainer.style.paddingBottom = '150px';
  _filteredNodesPanel.appendChild(contentContainer);
  
  // Create header with filter information
  const header = document.createElement('div');
  header.className = 'filtered-header';
  
  // Create title showing what we're filtering by
  const title = document.createElement('h3');
  title.textContent = `Nodes containing "${keyword}"`;
  title.style.marginTop = '10px';
  header.appendChild(title);
  
  // Add subtitle showing the community
  const community = window.graphViz.communities.find(c => c.id === communityId);
  if (community) {
    const subtitle = document.createElement('p');
    subtitle.className = 'filter-subtitle';
    subtitle.textContent = `From cluster: ${community.label || communityId}`;
    if (window.graphViz.colorScale) {
      subtitle.style.color = window.graphViz.colorScale(communityId);
    }
    header.appendChild(subtitle);
  }
  
  contentContainer.appendChild(header);
  
  // Filter the nodes to find those with the keyword
  const filteredNodes = window.graphViz.nodes.filter(node => {
    // Check if node has keywords and if our target keyword is in there
    if (node.keywords && Array.isArray(node.keywords)) {
      return node.keywords.includes(keyword);
    }
    // Also check in content/text fields for the keyword
    if (node.text && typeof node.text === 'string') {
      return node.text.toLowerCase().includes(keyword.toLowerCase());
    }
    if (node.content && typeof node.content === 'string') {
      return node.content.toLowerCase().includes(keyword.toLowerCase());
    }
    return false;
  });
  
  // Group the filtered nodes by type (theme, goal, strategy)
  const groupedNodes = {
    topic: [], // Themes
    document: [], // Goals
    strategy: [] // Strategies
  };
  
  filteredNodes.forEach(node => {
    if (groupedNodes[node.type]) {
      groupedNodes[node.type].push(node);
    }
  });
  
  // Create sections for each node type
  const types = [
    { key: 'topic', label: 'Themes', className: 'theme-item' },
    { key: 'document', label: 'Goals', className: 'goal-item' },
    { key: 'strategy', label: 'Strategies', className: 'strategy-item' }
  ];
  
  types.forEach(type => {
    const nodes = groupedNodes[type.key];
    
    if (nodes.length > 0) {
      // Create section for this node type
      const section = document.createElement('div');
      section.className = 'node-info-section';
      
      const sectionTitle = document.createElement('h3');
      sectionTitle.textContent = type.label;
      section.appendChild(sectionTitle);
      
      // Create list of nodes
      const nodesList = document.createElement('ul');
      nodesList.className = 'hierarchy-list';
      
      nodes.forEach(node => {
        const item = document.createElement('li');
        item.className = type.className;
        
        const link = document.createElement('a');
        link.textContent = node.label;
        link.href = '#';
        link.onclick = (e) => {
          e.preventDefault();
          // The focusOnNode will trigger displayNodeDetails which will add to our unified navigation
          focusOnNode(node.id);
        };
        
        item.appendChild(link);
        
        // Add text excerpt showing the keyword in context
        let excerptText = '';
        if (node.text) {
          excerptText = extractExcerptWithKeyword(node.text, keyword);
        } else if (node.content) {
          excerptText = extractExcerptWithKeyword(node.content, keyword);
        } else if (node.description || node.overview) {
          excerptText = extractExcerptWithKeyword(node.description || node.overview, keyword);
        }
        
        if (excerptText) {
          const excerpt = document.createElement('div');
          excerpt.className = 'keyword-excerpt';
          excerpt.innerHTML = excerptText;
          item.appendChild(excerpt);
        }
        
        nodesList.appendChild(item);
      });
      
      section.appendChild(nodesList);
      contentContainer.appendChild(section);
    }
  });
  
  // If no nodes were found, show a message
  if (filteredNodes.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-connections';
    emptyMessage.textContent = `No nodes found containing "${keyword}"`;
    contentContainer.appendChild(emptyMessage);
  } else {
    // Add summary text
    const summary = document.createElement('p');
    summary.className = 'filter-summary';
    summary.textContent = `Found ${filteredNodes.length} nodes containing "${keyword}"`;
    contentContainer.insertBefore(summary, contentContainer.children[1]);
  }
}

// Make the navigation view functions available externally
export function navigateToClusterView() {
  navigateToView({ type: VIEW_TYPE.CLUSTERS });
}

export function navigateToFilteredView(keyword, communityId) {
  navigateToView({
    type: VIEW_TYPE.FILTERED,
    data: {
      keyword: keyword,
      communityId: communityId
    }
  });
}

export function setupClusterPanel(communities) {
  if (!_clusterPanel) return;
  
  _clusterPanel.innerHTML = '';
  
  // Create a padding container
  const paddingContainer = document.createElement('div');
  paddingContainer.className = 'clusters-padding-container';
  paddingContainer.style.padding = '20px';
  _clusterPanel.appendChild(paddingContainer);
  
  // Add the title
  const title = document.createElement('h3');
  title.textContent = 'Topic Clusters';
  title.style.marginTop = '0';
  title.style.marginBottom = '20px';
  paddingContainer.appendChild(title);
  
  // Normal padding for the clusters column
  paddingContainer.style.paddingBottom = '40px';
  
  communities.forEach(community => {
    const section = document.createElement('div');
    section.className = 'community-section';
    
    // Create header with community label as a clickable link
    const header = document.createElement('h3');
    header.className = 'clickable-header';
    
    // Wrap the text in a link
    const headerLink = document.createElement('a');
    headerLink.textContent = community.label;
    headerLink.href = '#';
    headerLink.style.textDecoration = 'none';
    
    // Apply color to link instead of header
    if (window.graphViz && window.graphViz.colorScale) {
      headerLink.style.color = window.graphViz.colorScale(community.id);
    } else {
      headerLink.style.color = '#000';
    }
    
    // Add click handler to focus on the community's main node (first central topic)
    if (community.central_topics && community.central_topics.length > 0) {
      headerLink.onclick = (e) => {
        e.preventDefault();
        focusOnNode(community.central_topics[0].id);
      };
      
      // Add tooltip
      headerLink.title = 'Click to view this topic';
    }
    
    header.appendChild(headerLink);
    section.appendChild(header);
    
    // Add top keywords for this cluster if available
    const topKeywords = extractTopKeywords(community);
    if (topKeywords && topKeywords.length > 0) {
      const keywordsContainer = document.createElement('div');
      keywordsContainer.className = 'cluster-keywords';
      
      // Removed "Top Keywords:" heading
      
      const keywordsList = document.createElement('div');
      keywordsList.className = 'keywords-list';
      
      topKeywords.forEach(pair => {
        const [keyword, count] = pair;
        const keywordTag = document.createElement('button');
        keywordTag.className = 'keyword-tag';
        keywordTag.textContent = keyword; // Remove count display
        keywordTag.title = `Click to show nodes containing "${keyword}"`;
        
        // Add click event to filter nodes by this keyword
        keywordTag.addEventListener('click', () => {
          filterNodesByKeyword(keyword, community.id);
        });
        
        keywordsList.appendChild(keywordTag);
      });
      
      keywordsContainer.appendChild(keywordsList);
      section.appendChild(keywordsContainer);
    }
    
    // We've removed the separate "Key Topics" section since we now have clickable headers
    
    paddingContainer.appendChild(section);
  });
}

/**
 * Creates hierarchical navigation tags based on node type and connections
 * @param {Object} data - Node data with connections
 * @param {HTMLElement} container - Container to append tags to
 */
function createHierarchicalTags(data, container) {
  const tagContainer = document.createElement('div');
  tagContainer.className = 'hierarchical-tags';
  
  const node = data.node;
  const nodeType = node.type;
  let parentGoal = null;
  let parentTheme = null;
  
  // Find direct parent relationships
  if (nodeType === 'strategy' || nodeType === 'document') {
    // For strategies and goals, first try to find direct theme connection
    parentTheme = data.connections.find(conn => 
      conn.node.type === 'topic' && 
      (conn.relationship === 'belongs_to' || conn.relationship === 'part_of_theme'));
  }
  
  // Find parent goal for strategies
  if (nodeType === 'strategy') {
    parentGoal = data.connections.find(conn => 
      conn.node.type === 'document' && 
      (conn.relationship === 'part_of_goal'));
    
    // We need to fetch the theme for this strategy
    if (!parentTheme && parentGoal) {
      // Store goal info to access in the theme tag even if we don't have theme data yet
      const goalId = parentGoal.node.id;
      
      // Create a slightly different theme tag for strategies
      // This will create a theme tag that says "Parent Theme" if we don't know the name yet
      parentTheme = {
        node: {
          id: `theme_${goalId.split('_')[1]}`, // Construct a likely theme ID based on goal ID
          // Structure: goal_12_12_1 → theme_12
          label: "Parent Theme",
          type: 'topic'
        },
        needsFetch: true,
        goalId: goalId
      };
    }
  }
  
  // Create theme tag if applicable
  if (nodeType === 'topic' || parentTheme) {
    const themeTag = document.createElement('div');
    themeTag.className = 'node-type-label node-type-theme';
    
    if (nodeType === 'topic') {
      // Current node is a theme
      themeTag.textContent = 'Theme';
      themeTag.classList.add('current-node-tag');
    } else {
      // Parent theme tag is clickable
      themeTag.textContent = 'Theme: ' + parentTheme.node.label;
      themeTag.classList.add('clickable-tag');
      
      // Set up the click handler
      if (parentTheme && parentTheme.needsFetch && parentTheme.goalId) {
        // If we need to fetch the theme, click will go to the parent goal first
        themeTag.onclick = () => focusOnNode(parentTheme.goalId);
      } else if (parentTheme && parentTheme.node) {
        // Otherwise, direct link to theme
        themeTag.onclick = () => focusOnNode(parentTheme.node.id);
      }
    }
    
    tagContainer.appendChild(themeTag);
    
    // If we need to fetch theme data, do that now and update the tag when ready
    if (parentTheme && parentTheme.needsFetch && parentTheme.goalId) {
      // Use window.fetchNodeDetails as a fallback if the import doesn't work
      const fetchFunc = typeof fetchNodeDetails === 'function' ? 
        fetchNodeDetails : (window.fetchNodeDetails || null);
        
      if (fetchFunc) {
        fetchFunc(parentTheme.goalId).then(goalData => {
          if (goalData) {
            const themeConn = goalData.connections.find(conn => 
              conn.node.type === 'topic' && 
              (conn.relationship === 'belongs_to' || conn.relationship === 'part_of_theme'));
            
            if (themeConn) {
              // Update the theme tag with correct information
              themeTag.textContent = 'Theme: ' + themeConn.node.label;
              
              // Update the click handler to go directly to the theme
              themeTag.onclick = () => focusOnNode(themeConn.node.id);
            }
          }
        }).catch(err => {
          console.error('Error fetching theme data:', err);
        });
      }
    }
  }
  
  // Create goal tag if applicable
  if (nodeType === 'document' || parentGoal) {
    const goalTag = document.createElement('div');
    goalTag.className = 'node-type-label node-type-goal';
    
    if (nodeType === 'document') {
      // Current node is a goal
      goalTag.textContent = 'Goal';
      goalTag.classList.add('current-node-tag');
    } else {
      // Parent goal tag is clickable
      goalTag.textContent = 'Goal: ' + parentGoal.node.label;
      goalTag.classList.add('clickable-tag');
      goalTag.onclick = () => focusOnNode(parentGoal.node.id);
    }
    
    tagContainer.appendChild(goalTag);
  }
  
  // Create strategy tag if applicable
  if (nodeType === 'strategy') {
    const strategyTag = document.createElement('div');
    strategyTag.textContent = 'Strategy';
    strategyTag.className = 'node-type-label node-type-strategy current-node-tag';
    tagContainer.appendChild(strategyTag);
  }
  
  container.appendChild(tagContainer);
}