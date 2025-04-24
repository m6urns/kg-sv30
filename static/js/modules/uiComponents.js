// UI components for the graph visualization
import { focusOnNode, navigateBack, navigateForward, canNavigateForward, addToNodeViewHistory, toggleFocusMode, isFocusModeEnabled } from './nodeInteraction.js';

// DOM element references
let _searchResults = null;
let _searchInput = null;
let _clusterPanel = null;
let _navigationPanel = null;
let _clustersContainer = null;

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
  
  // Show navigation panel, hide clusters panel
  if (_navigationPanel) {
    _navigationPanel.style.display = 'flex';
    _navigationPanel.style.height = '100%'; // Ensure it takes full height
  }
  
  if (_clustersContainer) {
    _clustersContainer.style.display = 'none';
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
    contentContainer.style.paddingBottom = '300px';
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
    backButton.className = 'nav-button back';
    backButton.innerHTML = '&larr; Back';
    backButton.onclick = navigateBack;
    navigationButtons.appendChild(backButton);
  } else {
    // Add a disabled back button for consistent UI
    const backButton = document.createElement('button');
    backButton.id = 'node-back-button';
    backButton.className = 'nav-button back disabled';
    backButton.innerHTML = '&larr; Back';
    backButton.disabled = true;
    navigationButtons.appendChild(backButton);
  }
  
  // Add return to overview button
  const overviewButton = document.createElement('button');
  overviewButton.id = 'overview-button';
  overviewButton.className = 'nav-button overview';
  overviewButton.innerHTML = 'Overview';
  overviewButton.onclick = () => {
    // Hide navigation panel, show clusters panel
    if (_navigationPanel) {
      _navigationPanel.style.display = 'none';
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
    forwardButton.className = 'nav-button forward';
    forwardButton.innerHTML = 'Forward &rarr;';
    forwardButton.onclick = navigateForward;
    navigationButtons.appendChild(forwardButton);
  } else {
    // Add a disabled forward button for consistent UI
    const forwardButton = document.createElement('button');
    forwardButton.id = 'node-forward-button';
    forwardButton.className = 'nav-button forward disabled';
    forwardButton.innerHTML = 'Forward &rarr;';
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
  // Show topic keywords
  const keywords = document.createElement('p');
  keywords.innerHTML = '<strong>Keywords:</strong> ' + 
                      (data.node.keywords || []).join(', ');
  contentWrapper.appendChild(keywords);
  
  // Show overview/description if available
  if (data.node.description || data.node.overview) {
    const description = document.createElement('p');
    description.className = 'node-description theme-description';
    description.textContent = data.node.overview || data.node.description;
    contentWrapper.appendChild(description);
  }
  
  // Show community
  if (data.node.community_label) {
    const community = document.createElement('p');
    community.innerHTML = '<strong>Cluster:</strong> ' + 
                        data.node.community_label;
    contentWrapper.appendChild(community);
  }
  
  // Show related topics
  const relatedTopics = data.connections
    .filter(conn => conn.node.type === 'topic')
    .map(conn => conn.node);
  
  if (relatedTopics.length > 0) {
    const topicsTitle = document.createElement('h3');
    topicsTitle.textContent = 'Related Topics:';
    contentWrapper.appendChild(topicsTitle);
    
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
    
    contentWrapper.appendChild(topicsList);
  }
  
  // Show related documents (goals)
  const docsTitle = document.createElement('h3');
  docsTitle.textContent = 'Related Goals:';
  contentWrapper.appendChild(docsTitle);
  
  const docList = document.createElement('ul');
  docList.className = 'hierarchy-list';
  
  const relatedDocs = data.connections
    .filter(conn => conn.node.type === 'document')
    .map(conn => conn.node);
  
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
  
  contentWrapper.appendChild(docList);
}

/**
 * Display details for document nodes with strategies
 * @param {Object} data - Node data
 * @param {HTMLElement} contentWrapper - The content container
 */
function displayDocumentWithStrategies(data, contentWrapper) {
  // Show document text/description
  const text = document.createElement('p');
  text.textContent = data.node.text;
  text.className = 'node-description goal-description';
  contentWrapper.appendChild(text);
  
  // Show related topic
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
    contentWrapper.appendChild(topicInfo);
  }
  
  // Show strategies
  const strategiesTitle = document.createElement('h3');
  strategiesTitle.textContent = 'Strategies:';
  contentWrapper.appendChild(strategiesTitle);
  
  const strategiesList = document.createElement('ul');
  strategiesList.className = 'hierarchy-list';
  
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
  
  contentWrapper.appendChild(strategiesList);
}

/**
 * Display details for strategy nodes
 * @param {Object} data - Node data
 * @param {HTMLElement} contentWrapper - The content container
 */
function displayStrategyDetails(data, contentWrapper) {
  // Show strategy section number if available
  if (data.node.section_number) {
    const sectionNumber = document.createElement('div');
    sectionNumber.className = 'strategy-section-number';
    sectionNumber.textContent = data.node.section_number;
    contentWrapper.appendChild(sectionNumber);
  }
  
  // Show strategy text
  const text = document.createElement('p');
  text.textContent = data.node.text;
  text.className = 'node-description strategy-description';
  contentWrapper.appendChild(text);
  
  // Show relationships container
  const relationshipsContainer = document.createElement('div');
  relationshipsContainer.className = 'strategy-relationships';
  
  // Show parent goal
  const goal = data.connections
    .find(conn => conn.node.type === 'document' && 
                (conn.relationship === 'part_of_goal'));
  
  if (goal) {
    const goalInfo = document.createElement('p');
    goalInfo.innerHTML = '<strong>Goal:</strong> ';
    
    const link = document.createElement('a');
    link.textContent = goal.node.label;
    link.href = '#';
    link.onclick = (e) => {
      e.preventDefault();
      focusOnNode(goal.node.id);
    };
    
    goalInfo.appendChild(link);
    relationshipsContainer.appendChild(goalInfo);
  }
  
  // Show theme (if available through connections)
  const theme = data.connections
    .find(conn => conn.node.type === 'topic');
  
  if (theme) {
    const themeInfo = document.createElement('p');
    themeInfo.innerHTML = '<strong>Theme:</strong> ';
    
    const link = document.createElement('a');
    link.textContent = theme.node.label;
    link.href = '#';
    link.onclick = (e) => {
      e.preventDefault();
      focusOnNode(theme.node.id);
    };
    
    themeInfo.appendChild(link);
    relationshipsContainer.appendChild(themeInfo);
  }
  
  contentWrapper.appendChild(relationshipsContainer);
  
  // Display similar strategies if available
  if (data.node.connections && data.node.connections.length > 0) {
    // First check if there are any similar strategies (strategy-to-strategy connections)
    const similarStrategies = data.node.connections.filter(conn => 
      conn.node_type === 'strategy' || 
      (conn.relationship && conn.relationship.includes('similar')));
    
    if (similarStrategies.length > 0) {
      displaySimilarStrategies(data.node, contentWrapper);
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
      
      const contextInfo = document.createElement('small');
      contextInfo.className = 'item-context';
      contextInfo.textContent = contextText.join(' | ');
      item.appendChild(contextInfo);
    }
    
    strategiesList.appendChild(item);
  });
  
  container.appendChild(strategiesList);
  
  // Add extra spacer div to ensure all content is visible
  const spacer = document.createElement('div');
  spacer.style.height = '100px';
  spacer.style.width = '100%';
  container.appendChild(spacer);
}

/**
 * Set up the cluster panel showing communities and topics
 * @param {Array} communities - Communities data
 */
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