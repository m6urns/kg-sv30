// UI components for the graph visualization
import { focusOnNode, navigateBack, navigateForward, canNavigateForward, addToNodeViewHistory, toggleFocusMode, isFocusModeEnabled } from './nodeInteraction.js';

// DOM element references
let _searchResults = null;
let _searchInput = null;
let _clusterPanel = null;
let _navigationPanel = null;
let _clustersContainer = null;
let _filteredNodesPanel = null; // Panel for displaying nodes filtered by keywords

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

  // Expose displayNodeDetails to the global scope for nodeInteraction.js to use
  window.displayNodeDetails = displayNodeDetails;
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
 * Display node details in the navigation panel
 * @param {Object} data - Node data with connections
 * @param {Array} nodeViewHistory - History of viewed nodes
 */
export function displayNodeDetails(data, nodeViewHistory) {
  if (!_navigationPanel || !_clustersContainer) return;
  
  // Add node to history
  const nodeId = data.node.id;
  addToNodeViewHistory(nodeId);
  
  // Show navigation panel, hide clusters panel and filtered nodes panel
  if (_navigationPanel) {
    _navigationPanel.style.display = 'flex';
    _navigationPanel.style.height = '100%'; // Ensure it takes full height
  }
  
  if (_clustersContainer) {
    _clustersContainer.style.display = 'none';
  }
  
  // Also hide the filtered nodes panel if coming from there
  if (_filteredNodesPanel) {
    _filteredNodesPanel.style.display = 'none';
  }
  
  // Get the content wrapper and navigation buttons container
  const contentWrapper = document.getElementById('nav-content-wrapper');
  const navigationButtons = document.getElementById('navigation-buttons');
  
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
  
  if (navigationButtons) navigationButtons.innerHTML = '';
  
  // Create header for the node
  const header = document.createElement('h2');
  header.textContent = data.node.label;
  contentContainer.appendChild(header);
  
  // Add node type indicator with appropriate styling
  const typeLabel = document.createElement('div');
  const nodeTypes = {
    'topic': 'Theme',
    'document': 'Goal',
    'strategy': 'Strategy'
  };
  const typeText = nodeTypes[data.node.type] || data.node.type;
  typeLabel.textContent = typeText;
  
  // Apply type-specific styling
  if (data.node.type === 'topic') {
    typeLabel.className = 'node-type-label node-type-theme';
  } else if (data.node.type === 'document') {
    typeLabel.className = 'node-type-label node-type-goal';
  } else if (data.node.type === 'strategy') {
    typeLabel.className = 'node-type-label node-type-strategy';
  } else {
    typeLabel.className = 'node-type-label';
  }
  
  contentContainer.appendChild(typeLabel);
  
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
  
  // Set up navigation buttons at the bottom
  
  // Add back button if there's history
  if (nodeViewHistory && nodeViewHistory.length > 1) {
    const backButton = document.createElement('button');
    backButton.id = 'node-back-button';
    backButton.className = 'nav-button';
    backButton.textContent = 'Back';
    backButton.onclick = navigateBack;
    navigationButtons.appendChild(backButton);
  } else {
    // Add a disabled back button for consistent UI
    const backButton = document.createElement('button');
    backButton.id = 'node-back-button';
    backButton.className = 'nav-button disabled';
    backButton.textContent = 'Back';
    backButton.disabled = true;
    navigationButtons.appendChild(backButton);
  }
  
  // Add return to overview button with home icon
  const overviewButton = document.createElement('button');
  overviewButton.id = 'overview-button';
  overviewButton.className = 'nav-button overview';
  
  // Create home icon element (using Unicode home symbol)
  const homeIcon = document.createElement('span');
  homeIcon.className = 'overview-icon';
  homeIcon.innerHTML = '&#8962;'; // Unicode for home symbol
  
  // Only add the home icon to the button (no text)
  overviewButton.appendChild(homeIcon);
  
  overviewButton.onclick = () => {
    // Hide navigation panel and filtered nodes panel, show clusters panel
    if (_navigationPanel) {
      _navigationPanel.style.display = 'none';
    }
    
    // Also hide the filtered nodes panel if it exists
    if (_filteredNodesPanel) {
      _filteredNodesPanel.style.display = 'none';
    }
    
    if (_clustersContainer) {
      _clustersContainer.style.display = 'flex';
      _clustersContainer.style.height = '100%';
    }
    
    // Reset scroll position of clusters container to the top
    if (_clusterPanel) _clusterPanel.scrollTop = 0;
  };
  navigationButtons.appendChild(overviewButton);
  
  // Add forward button if there's forward history
  if (canNavigateForward()) {
    const forwardButton = document.createElement('button');
    forwardButton.id = 'node-forward-button';
    forwardButton.className = 'nav-button';
    forwardButton.textContent = 'Forward';
    forwardButton.onclick = navigateForward;
    navigationButtons.appendChild(forwardButton);
  } else {
    // Add a disabled forward button for consistent UI
    const forwardButton = document.createElement('button');
    forwardButton.id = 'node-forward-button';
    forwardButton.className = 'nav-button disabled';
    forwardButton.textContent = 'Forward';
    forwardButton.disabled = true;
    navigationButtons.appendChild(forwardButton);
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
  
  // Add community/cluster if available
  if (data.node.community_label) {
    const community = document.createElement('div');
    community.className = 'node-meta-item';
    community.innerHTML = '<strong>Cluster:</strong> ' + 
                      data.node.community_label;
    metaContainer.appendChild(community);
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
  const topic = data.connections
    .find(conn => conn.node.type === 'topic' && 
                (conn.relationship === 'belongs_to' || conn.relationship === 'part_of_theme'));
  
  if (topic) {
    const topicInfo = document.createElement('div');
    topicInfo.className = 'node-meta-item';
    topicInfo.innerHTML = '<strong>Theme:</strong> ';
    
    const link = document.createElement('a');
    link.textContent = topic.node.label;
    link.href = '#';
    link.onclick = (e) => {
      e.preventDefault();
      focusOnNode(topic.node.id);
    };
    
    topicInfo.appendChild(link);
    metaContainer.appendChild(topicInfo);
  }
  
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
  if (data.node.section_number) {
    const sectionInfo = document.createElement('div');
    sectionInfo.className = 'node-meta-item';
    sectionInfo.innerHTML = '<strong>Section:</strong> ' + data.node.section_number;
    metaContainer.appendChild(sectionInfo);
  }
  
  // Show parent goal if available
  const goal = data.connections
    .find(conn => conn.node.type === 'document' && 
                (conn.relationship === 'part_of_goal'));
  
  if (goal) {
    const goalInfo = document.createElement('div');
    goalInfo.className = 'node-meta-item';
    goalInfo.innerHTML = '<strong>Goal:</strong> ';
    
    const link = document.createElement('a');
    link.textContent = goal.node.label;
    link.href = '#';
    link.onclick = (e) => {
      e.preventDefault();
      focusOnNode(goal.node.id);
    };
    
    goalInfo.appendChild(link);
    metaContainer.appendChild(goalInfo);
  }
  
  // Show theme if available
  const theme = data.connections
    .find(conn => conn.node.type === 'topic');
  
  if (theme) {
    const themeInfo = document.createElement('div');
    themeInfo.className = 'node-meta-item';
    themeInfo.innerHTML = '<strong>Theme:</strong> ';
    
    const link = document.createElement('a');
    link.textContent = theme.node.label;
    link.href = '#';
    link.onclick = (e) => {
      e.preventDefault();
      focusOnNode(theme.node.id);
    };
    
    themeInfo.appendChild(link);
    metaContainer.appendChild(themeInfo);
  }
  
  overviewSection.appendChild(metaContainer);
  
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
 * @param {number} contextLength - Number of characters to include before and after the keyword
 * @returns {string} HTML string with the excerpt and highlighted keyword
 */
function extractExcerptWithKeyword(text, keyword, contextLength = 50) {
  if (!text || typeof text !== 'string') return '';
  
  // Case insensitive search
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  const keywordIndex = lowerText.indexOf(lowerKeyword);
  
  // If keyword not found in text
  if (keywordIndex === -1) return '';
  
  // Determine the start and end indices for the excerpt
  const startIndex = Math.max(0, keywordIndex - contextLength);
  const endIndex = Math.min(text.length, keywordIndex + keyword.length + contextLength);
  
  // Get the excerpt
  let excerpt = text.substring(startIndex, endIndex);
  
  // Add ellipsis if we're not at the beginning or end of the text
  if (startIndex > 0) excerpt = '...' + excerpt;
  if (endIndex < text.length) excerpt = excerpt + '...';
  
  // Escape HTML to prevent XSS
  excerpt = excerpt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Now safely highlight the keyword by wrapping it in a span
  // First we need to find where in our escaped excerpt the keyword appears
  const escapedText = text.substring(startIndex, keywordIndex)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  const keywordPosition = escapedText.length;
  
  // Get the exact keyword as it appears in the original text to preserve case
  const originalKeyword = text.substring(keywordIndex, keywordIndex + keyword.length);
  const escapedKeyword = originalKeyword
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Insert the span tags around the keyword
  const beforeKeyword = excerpt.substring(0, keywordPosition);
  const afterKeyword = excerpt.substring(keywordPosition + escapedKeyword.length);
  
  return beforeKeyword + 
         '<span class="keyword-highlight">' + escapedKeyword + '</span>' + 
         afterKeyword;
}

/**
 * Filter nodes by a specific keyword and display them in the left-hand panel
 * @param {string} keyword - The keyword to filter by
 * @param {string|number} communityId - The ID of the community the keyword is from
 */
function filterNodesByKeyword(keyword, communityId) {
  if (!_filteredNodesPanel || !window.graphViz || !window.graphViz.nodes) return;
  
  // Hide both navigation panel and clusters container
  if (_navigationPanel) _navigationPanel.style.display = 'none';
  if (_clustersContainer) _clustersContainer.style.display = 'none';
  
  // Show filtered nodes panel
  _filteredNodesPanel.style.display = 'flex';
  _filteredNodesPanel.style.height = '100%';
  
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
  
  // Create back button to return to clusters view
  const backButton = document.createElement('button');
  backButton.className = 'keyword-back-button';
  backButton.innerHTML = '&larr; Back to Clusters';
  backButton.addEventListener('click', () => {
    // Hide filtered panel and navigation panel, show clusters
    _filteredNodesPanel.style.display = 'none';
    
    if (_navigationPanel) {
      _navigationPanel.style.display = 'none';
    }
    
    _clustersContainer.style.display = 'flex';
    _clustersContainer.style.height = '100%';
    
    // Reset scroll position to the top
    if (_clusterPanel) _clusterPanel.scrollTop = 0;
  });
  header.appendChild(backButton);
  
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
    
    // Create header with community label
    const header = document.createElement('h3');
    header.textContent = community.label;
    if (window.graphViz && window.graphViz.colorScale) {
      header.style.color = window.graphViz.colorScale(community.id);
    } else {
      header.style.color = '#000';
    }
    section.appendChild(header);
    
    // Add top keywords for this cluster if available
    const topKeywords = extractTopKeywords(community);
    if (topKeywords && topKeywords.length > 0) {
      const keywordsContainer = document.createElement('div');
      keywordsContainer.className = 'cluster-keywords';
      
      const keywordsTitle = document.createElement('h4');
      keywordsTitle.textContent = 'Top Keywords:';
      keywordsContainer.appendChild(keywordsTitle);
      
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
    
    // Create entry points list for central topics
    if (community.central_topics && community.central_topics.length > 0) {
      const entriesTitle = document.createElement('h4');
      entriesTitle.textContent = 'Key Topics:';
      section.appendChild(entriesTitle);
      
      const entriesList = document.createElement('ul');
      community.central_topics.forEach(topic => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.textContent = topic.label;
        link.href = '#';
        link.onclick = (e) => {
          e.preventDefault();
          focusOnNode(topic.id);
        };
        item.appendChild(link);
        entriesList.appendChild(item);
      });
      section.appendChild(entriesList);
    }
    
    paddingContainer.appendChild(section);
  });
}