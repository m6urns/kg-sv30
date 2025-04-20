// UI components for the graph visualization
import { focusOnNode, navigateBack, navigateForward, canNavigateForward, addToNodeViewHistory } from './nodeInteraction.js';

// DOM element references
let _detailsPanel = null;
let _searchResults = null;
let _searchInput = null;
let _clusterPanel = null;

/**
 * Initialize UI components
 * @param {HTMLElement} detailsPanel - The details panel element
 * @param {HTMLElement} searchResults - The search results container
 * @param {HTMLElement} searchInput - The search input element
 * @param {HTMLElement} clusterPanel - The cluster panel element
 */
export function initializeUI(detailsPanel, searchResults, searchInput, clusterPanel) {
  _detailsPanel = detailsPanel;
  _searchResults = searchResults;
  _searchInput = searchInput;
  _clusterPanel = clusterPanel;

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
  statusElement.textContent = message;
  statusElement.className = type;
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
 * Display node details in the details panel
 * @param {Object} data - Node data with connections
 * @param {Array} nodeViewHistory - History of viewed nodes
 */
export function displayNodeDetails(data, nodeViewHistory) {
  if (!_detailsPanel) return;
  
  // Add node to history
  const nodeId = data.node.id;
  addToNodeViewHistory(nodeId);
  
  _detailsPanel.innerHTML = '';
  
  // Add navigation buttons if needed
  // Create navigation bar regardless of history to maintain consistent UI
  const navBar = document.createElement('div');
  navBar.className = 'node-navigation-bar';
  
  // Add back button if there's history
  if (nodeViewHistory && nodeViewHistory.length > 1) {
    const backButton = document.createElement('button');
    backButton.id = 'node-back-button';
    backButton.className = 'node-navigation-button';
    backButton.innerHTML = '&larr; Back';
    backButton.onclick = navigateBack;
    navBar.appendChild(backButton);
  } else {
    // Add a disabled back button for consistent UI
    const backButton = document.createElement('button');
    backButton.id = 'node-back-button';
    backButton.className = 'node-navigation-button disabled';
    backButton.innerHTML = '&larr; Back';
    backButton.disabled = true;
    navBar.appendChild(backButton);
  }
  
  // Add forward button if there's forward history
  if (canNavigateForward()) {
    const forwardButton = document.createElement('button');
    forwardButton.id = 'node-forward-button';
    forwardButton.className = 'node-navigation-button';
    forwardButton.innerHTML = 'Forward &rarr;';
    forwardButton.onclick = navigateForward;
    navBar.appendChild(forwardButton);
  } else {
    // Add a disabled forward button for consistent UI
    const forwardButton = document.createElement('button');
    forwardButton.id = 'node-forward-button';
    forwardButton.className = 'node-navigation-button disabled';
    forwardButton.innerHTML = 'Forward &rarr;';
    forwardButton.disabled = true;
    navBar.appendChild(forwardButton);
  }
  
  _detailsPanel.appendChild(navBar);
  
  // Create header
  const header = document.createElement('h2');
  header.textContent = data.node.label;
  _detailsPanel.appendChild(header);
  
  // Create content based on node type
  if (data.node.type === 'topic') {
    displayTopicDetails(data);
  } else if (data.node.type === 'document' && 
            (data.node.has_strategy_links || data.node.display_type === 'strategy_list') && 
            data.node.strategy_entries) {
    displayDocumentWithStrategies(data);
  } else if (data.node.type === 'strategy') {
    displayStrategyDetails(data);
  } else {
    displayGenericDetails(data);
  }
}

/**
 * Display details for topic nodes
 * @param {Object} data - Node data
 */
function displayTopicDetails(data) {
  // Show topic keywords
  const keywords = document.createElement('p');
  keywords.innerHTML = '<strong>Keywords:</strong> ' + 
                      (data.node.keywords || []).join(', ');
  _detailsPanel.appendChild(keywords);
  
  // Show overview/description if available
  if (data.node.description || data.node.overview) {
    const description = document.createElement('p');
    description.className = 'node-description theme-description';
    description.textContent = data.node.overview || data.node.description;
    _detailsPanel.appendChild(description);
  }
  
  // Show community
  if (data.node.community_label) {
    const community = document.createElement('p');
    community.innerHTML = '<strong>Cluster:</strong> ' + 
                        data.node.community_label;
    _detailsPanel.appendChild(community);
  }
  
  // Show related topics
  const relatedTopics = data.connections
    .filter(conn => conn.node.type === 'topic')
    .map(conn => conn.node);
  
  if (relatedTopics.length > 0) {
    const topicsTitle = document.createElement('h3');
    topicsTitle.textContent = 'Related Topics:';
    _detailsPanel.appendChild(topicsTitle);
    
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
    
    _detailsPanel.appendChild(topicsList);
  }
  
  // Show related documents (goals)
  const docsTitle = document.createElement('h3');
  docsTitle.textContent = 'Related Goals:';
  _detailsPanel.appendChild(docsTitle);
  
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
  
  _detailsPanel.appendChild(docList);
}

/**
 * Display details for document nodes with strategies
 * @param {Object} data - Node data
 */
function displayDocumentWithStrategies(data) {
  // Show document text/description
  const text = document.createElement('p');
  text.textContent = data.node.text;
  text.className = 'node-description goal-description';
  _detailsPanel.appendChild(text);
  
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
    _detailsPanel.appendChild(topicInfo);
  }
  
  // Show strategies
  const strategiesTitle = document.createElement('h3');
  strategiesTitle.textContent = 'Strategies:';
  _detailsPanel.appendChild(strategiesTitle);
  
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
  
  _detailsPanel.appendChild(strategiesList);
}

/**
 * Display details for strategy nodes
 * @param {Object} data - Node data
 */
function displayStrategyDetails(data) {
  // Create container for strategy content
  const strategyContainer = document.createElement('div');
  strategyContainer.className = 'strategy-container';
  
  // Show strategy section number if available
  if (data.node.section_number) {
    const sectionNumber = document.createElement('div');
    sectionNumber.className = 'strategy-section-number';
    sectionNumber.textContent = data.node.section_number;
    strategyContainer.appendChild(sectionNumber);
  }
  
  // Show strategy text
  const text = document.createElement('p');
  text.textContent = data.node.text;
  text.className = 'node-description strategy-description';
  strategyContainer.appendChild(text);
  
  _detailsPanel.appendChild(strategyContainer);
  
  // Show relationships
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
  
  _detailsPanel.appendChild(relationshipsContainer);
  
  // Display similar strategies if available
  if (data.node.connections && data.node.connections.length > 0) {
    displaySimilarStrategies(data.node, _detailsPanel);
  }
}

/**
 * Display details for other node types
 * @param {Object} data - Node data
 */
function displayGenericDetails(data) {
  // Show document text
  const text = document.createElement('p');
  text.textContent = data.node.text;
  text.className = 'node-description';
  _detailsPanel.appendChild(text);
  
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
  
  _detailsPanel.appendChild(relationshipsContainer);
}

/**
 * Display similar strategies panel
 * @param {Object} strategyNode - Strategy node data
 * @param {HTMLElement} container - Container to append to
 */
function displaySimilarStrategies(strategyNode, container) {
  // Create container for similar strategies
  const similarStrategiesContainer = document.createElement('div');
  similarStrategiesContainer.className = 'similar-strategies-container';
  
  // Create header
  const header = document.createElement('h3');
  header.className = 'similar-strategies-header';
  header.textContent = 'Similar Strategies';
  similarStrategiesContainer.appendChild(header);
  
  // Check if there are any similar strategies
  if (!strategyNode.connections || strategyNode.connections.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-connections';
    emptyMessage.textContent = 'No similar strategies found';
    similarStrategiesContainer.appendChild(emptyMessage);
    container.appendChild(similarStrategiesContainer);
    return;
  }
  
  // Create list of similar strategies
  const strategiesList = document.createElement('ul');
  strategiesList.className = 'similar-strategies-list';
  
  // Loop through connections and add them to the list
  strategyNode.connections.forEach(connection => {
    const item = document.createElement('li');
    item.className = 'similar-strategy-item';
    
    // Create link to the strategy
    const link = document.createElement('a');
    link.className = 'similar-strategy-link';
    
    // Note: We still sort by similarity score in the backend, 
    // but we no longer display the percentage in the UI
    
    // Use the display_label if available, otherwise use the node_label
    link.textContent = connection.node_label;
    link.href = '#';
    link.dataset.nodeId = connection.node_id;
    
    // Add click handler to navigate to the connected strategy
    link.onclick = (e) => {
      e.preventDefault();
      focusOnNode(connection.node_id);
    };
    
    // Create context info
    const contextInfo = document.createElement('div');
    contextInfo.className = 'similar-strategy-context';
    
    // Add theme info
    if (connection.theme_title) {
      const themeInfo = document.createElement('span');
      themeInfo.className = 'context-theme';
      themeInfo.textContent = connection.theme_title;
      contextInfo.appendChild(themeInfo);
    }
    
    // Add separator if both theme and goal are present
    if (connection.theme_title && connection.goal_title) {
      contextInfo.appendChild(document.createTextNode(' | '));
    }
    
    // Add goal info
    if (connection.goal_title) {
      const goalInfo = document.createElement('span');
      goalInfo.className = 'context-goal';
      goalInfo.textContent = connection.goal_title;
      contextInfo.appendChild(goalInfo);
    }
    
    // Add everything to the item (without similarity badge)
    item.appendChild(link);
    item.appendChild(contextInfo);
    strategiesList.appendChild(item);
  });
  
  similarStrategiesContainer.appendChild(strategiesList);
  container.appendChild(similarStrategiesContainer);
}

/**
 * Set up the cluster panel showing communities and topics
 * @param {Array} communities - Communities data
 */
export function setupClusterPanel(communities) {
  if (!_clusterPanel) return;
  
  _clusterPanel.innerHTML = '';
  
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
    
    _clusterPanel.appendChild(section);
  });
}