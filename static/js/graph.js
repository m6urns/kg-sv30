// Global variables
let graphViz = null;
let nodeViewHistory = []; // Added to track node navigation history

// DOM elements
const sampleBtn = document.getElementById('sample-btn');
const loadBtn = document.getElementById('load-btn');
const statusMessage = document.getElementById('status-message');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const clusterPanel = document.getElementById('cluster-panel');
const detailsPanel = document.getElementById('details-panel');
const graphContainer = document.getElementById('graph-container');

// Initialize event listeners
function initializeEventListeners() {
  // Sample data button
  sampleBtn.addEventListener('click', async () => {
    showStatus('Loading sample data...', 'loading');
    try {
      const response = await fetch('/api/process?generator=sample', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        showStatus('Sample data loaded successfully!', 'success');
        loadGraphData();
      } else {
        showStatus(`Error: ${data.error}`, 'error');
      }
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    }
  });
  
  // Load button
  loadBtn.addEventListener('click', async () => {
    showStatus('Loading saved graph data...', 'loading');
    try {
      const response = await fetch('/api/load');
      const data = await response.json();
      
      if (data.success) {
        showStatus('Graph data loaded successfully!', 'success');
        loadGraphData();
      } else {
        showStatus(`Error: ${data.error}`, 'error');
      }
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    }
  });
  
  // Search input
  searchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value.trim();
    if (!query) {
      searchResults.style.display = 'none';
      return;
    }
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const results = await response.json();
      
      displaySearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    }
  }, 300));
}

// Helper Functions
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = type;
}

// Add function to navigate back in history
function navigateBack() {
  if (nodeViewHistory.length > 1) {
    // Remove current node
    nodeViewHistory.pop();
    
    // Get previous node
    const previousNodeId = nodeViewHistory[nodeViewHistory.length - 1];
    
    // Remove it temporarily so it doesn't get added twice
    nodeViewHistory.pop();
    
    // Focus on the node - this will add it back to history
    focusOnNode(previousNodeId);
  }
}

// debounce function is now in utils.js

function displaySearchResults(results) {
  searchResults.innerHTML = '';
  
  if (results.length === 0) {
    searchResults.innerHTML = '<p class="p-2">No results found</p>';
    searchResults.style.display = 'block';
    return;
  }
  
  const ul = document.createElement('ul');
  
  results.forEach(result => {
    const li = document.createElement('li');
    li.textContent = result.label;
    li.addEventListener('click', async () => {
      // Fetch the detailed node data from the API instead of using the search result
      try {
        const response = await fetch(`/api/node/${result.id}`);
        const data = await response.json();
        
        if (data.node) {
          // Hide search results
          searchResults.style.display = 'none';
          searchInput.value = '';
          
          // Display node details in the details panel
          displayNodeDetails(data);
          
          // If a graph visualization exists, focus on the node in the graph
          if (graphViz) {
            const graphNode = graphViz.nodes.find(n => n.id === result.id);
            if (graphNode) {
              // Center the view on this node
              const transform = d3.zoomIdentity
                .translate(graphContainer.clientWidth / 2 - graphNode.x, graphContainer.clientHeight / 2 - graphNode.y);
              
              graphViz.svg.transition()
                .duration(750)
                .call(graphViz.zoom.transform, transform);
              
              // Highlight this node in the graph
              graphViz.nodeElements
                .attr('stroke-width', d => d.is_central ? 2 : 1.5)
                .attr('r', d => calculateNodeSize(d));
              
              // Highlight the selected node
              graphViz.nodeElements
                .filter(d => d.id === result.id)
                .attr('stroke-width', 3)
                .attr('r', d => calculateNodeSize(d) * 1.3);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching node details:', error);
      }
    });
    ul.appendChild(li);
  });
  
  searchResults.appendChild(ul);
  searchResults.style.display = 'block';
}

// Helper function to display node details in the details panel
function displayNodeDetails(data) {
  // Add node to history if it's different from the most recent
  const nodeId = data.node.id;
  if (nodeViewHistory.length === 0 || nodeViewHistory[nodeViewHistory.length - 1] !== nodeId) {
    nodeViewHistory.push(nodeId);
    
    // Limit history size
    if (nodeViewHistory.length > 50) {
      nodeViewHistory.shift();
    }
  }
  
  detailsPanel.innerHTML = '';
  
  // Add back button if there's history
  if (nodeViewHistory.length > 1) {
    const navBar = document.createElement('div');
    navBar.className = 'node-navigation-bar';
    
    const backButton = document.createElement('button');
    backButton.id = 'node-back-button';
    backButton.className = 'node-navigation-button';
    backButton.innerHTML = '&larr; Back';
    backButton.onclick = navigateBack;
    
    navBar.appendChild(backButton);
    detailsPanel.appendChild(navBar);
  }
  
  // Create header
  const header = document.createElement('h2');
  header.textContent = data.node.label;
  detailsPanel.appendChild(header);
  
  // Create content based on node type
  if (data.node.type === 'topic') {
    // Show topic keywords
    const keywords = document.createElement('p');
    keywords.innerHTML = '<strong>Keywords:</strong> ' + 
                       (data.node.keywords || []).join(', ');
    detailsPanel.appendChild(keywords);
    
    // Show overview/description if available
    if (data.node.description || data.node.overview) {
      const description = document.createElement('p');
      description.className = 'node-description theme-description';
      description.textContent = data.node.overview || data.node.description;
      detailsPanel.appendChild(description);
    }
    
    // Show community
    if (data.node.community_label) {
      const community = document.createElement('p');
      community.innerHTML = '<strong>Cluster:</strong> ' + 
                         data.node.community_label;
      detailsPanel.appendChild(community);
    }
    
    // Show related topics
    const relatedTopics = data.connections
      .filter(conn => conn.node.type === 'topic')
      .map(conn => conn.node);
    
    if (relatedTopics.length > 0) {
      const topicsTitle = document.createElement('h3');
      topicsTitle.textContent = 'Related Topics:';
      detailsPanel.appendChild(topicsTitle);
      
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
      
      detailsPanel.appendChild(topicsList);
    }
    
    // Show related documents (goals)
    const docsTitle = document.createElement('h3');
    docsTitle.textContent = 'Related Goals:';
    detailsPanel.appendChild(docsTitle);
    
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
    
    detailsPanel.appendChild(docList);
  } 
  // Handle goal nodes with strategies (document nodes with has_strategy_links)
  else if (data.node.type === 'document' && (data.node.has_strategy_links || data.node.display_type === 'strategy_list') && data.node.strategy_entries) {
    // Show document text/description
    const text = document.createElement('p');
    text.textContent = data.node.text;
    text.className = 'node-description goal-description';
    detailsPanel.appendChild(text);
    
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
      detailsPanel.appendChild(topicInfo);
    }
    
    // Show strategies
    const strategiesTitle = document.createElement('h3');
    strategiesTitle.textContent = 'Strategies:';
    detailsPanel.appendChild(strategiesTitle);
    
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
    
    detailsPanel.appendChild(strategiesList);
  }
  // Strategy nodes
  else if (data.node.type === 'strategy') {
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
    
    detailsPanel.appendChild(strategyContainer);
    
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
    
    detailsPanel.appendChild(relationshipsContainer);
    
    // Display similar strategies if available
    if (data.node.connections && data.node.connections.length > 0) {
      displaySimilarStrategies(data.node, detailsPanel);
    }
  }
  // Default handling for other node types
  else {
    // Show document text
    const text = document.createElement('p');
    text.textContent = data.node.text;
    text.className = 'node-description';
    detailsPanel.appendChild(text);
    
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
    
    detailsPanel.appendChild(relationshipsContainer);
  }
}

// Function to display similar strategies panel
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
    
    // Format the similarity score as a percentage
    const similarityScore = Math.round(connection.weight * 100);
    
    // Use the display_label if available, otherwise use the node_label
    link.textContent = connection.node_label;
    link.href = '#';
    link.dataset.nodeId = connection.node_id;
    
    // Add click handler to navigate to the connected strategy
    link.onclick = (e) => {
      e.preventDefault();
      focusOnNode(connection.node_id);
    };
    
    // Create similarity badge
    const similarityBadge = document.createElement('span');
    similarityBadge.className = 'similarity-badge';
    similarityBadge.textContent = `${similarityScore}% similar`;
    
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
    
    // Add everything to the item
    item.appendChild(link);
    item.appendChild(similarityBadge);
    item.appendChild(contextInfo);
    strategiesList.appendChild(item);
  });
  
  similarStrategiesContainer.appendChild(strategiesList);
  container.appendChild(similarStrategiesContainer);
  
  // Add some styling
  const style = document.createElement('style');
  style.textContent = `
    .similar-strategies-container {
      margin-top: 20px;
      padding-top: 15px;
      border-top: 2px solid #e6e6e6;
    }
    
    .similar-strategies-header {
      font-size: 16px;
      margin-bottom: 12px;
      color: #333;
      font-weight: bold;
    }
    
    .similar-strategies-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .similar-strategy-item {
      padding: 12px 0;
      border-bottom: 1px solid #f0f0f0;
      position: relative;
    }
    
    .similar-strategy-item:last-child {
      border-bottom: none;
    }
    
    .similar-strategy-link {
      color: #0066cc;
      text-decoration: none;
      display: block;
      font-size: 14px;
      font-weight: 500;
      margin-right: 60px;
    }
    
    .similar-strategy-link:hover {
      text-decoration: underline;
    }
    
    .similarity-badge {
      position: absolute;
      right: 0;
      top: 12px;
      background-color: #e6f2ff;
      color: #0066cc;
      border-radius: 12px;
      padding: 2px 8px;
      font-size: 12px;
      font-weight: bold;
    }
    
    .similar-strategy-context {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
    
    .context-theme, .context-goal {
      color: #555;
    }
    
    .empty-connections {
      color: #888;
      font-style: italic;
      padding: 8px 0;
    }
  `;
  
  document.head.appendChild(style);
}

function focusOnNode(nodeId) {
  if (!graphViz) return;
  
  // Find the node in the visualization
  const node = graphViz.nodes.find(n => n.id === nodeId);
  if (!node) return;
  
  // Highlight the node
  highlightNode(node);
  
  // Center the view on this node
  const transform = d3.zoomIdentity
    .translate(graphContainer.clientWidth / 2 - node.x, graphContainer.clientHeight / 2 - node.y);
  
  graphViz.svg.transition()
    .duration(750)
    .call(graphViz.zoom.transform, transform);
  
  // Show node details
  showNodeDetails(node);
}

function highlightNode(node) {
  // Reset all nodes
  graphViz.nodeElements
    .attr('stroke-width', d => d.is_central ? 2 : 1.5)
    .attr('r', d => calculateNodeSize(d));
  
  // Highlight selected node
  graphViz.nodeElements
    .filter(d => d.id === node.id)
    .attr('stroke-width', 3)
    .attr('r', d => calculateNodeSize(d) * 1.3);
}

async function setupClusterPanel() {
  try {
    const response = await fetch('/api/communities');
    const communities = await response.json();
    
    clusterPanel.innerHTML = '';
    
    communities.forEach(community => {
      const section = document.createElement('div');
      section.className = 'community-section';
      
      // Create header with community label
      const header = document.createElement('h3');
      header.textContent = community.label;
      header.style.color = graphViz ? graphViz.colorScale(community.id) : '#000';
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
      
      clusterPanel.appendChild(section);
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
  }
}

async function showNodeDetails(node) {
  try {
    const response = await fetch(`/api/node/${node.id}`);
    const data = await response.json();
    
    // Use our new displayNodeDetails function to show the node details
    displayNodeDetails(data);
  } catch (error) {
    console.error('Error fetching node details:', error);
  }
}

// Graph Visualization
function createKnowledgeGraph(data, container) {
  // Clear existing SVG
  container.innerHTML = '';
  
  const width = container.clientWidth;
  const height = container.clientHeight || 600;
  
  // Create SVG container
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const g = svg.append('g');
  
  // Set up zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 8])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
  svg.call(zoom);
  
  // Create tooltip
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);
  
  // Generate color scale for communities
  const communities = [...new Set(data.nodes
    .filter(d => d.community !== undefined)
    .map(d => d.community))];
  
  const colorScale = d3.scaleOrdinal()
    .domain(communities)
    .range(d3.schemeCategory10);

  const levelConfig = {
    // Main node repulsion strength by level
    chargeStrength: {
      primary: -500,     // Even stronger repulsion for theme nodes
      secondary: -300,   // Stronger for goal nodes
      tertiary: -100     // Increased for strategy nodes to reduce bunching
    },
    // Additional repulsion between nodes of the same level
    levelRepulsionStrength: {
      primary: 2.0,      // Much stronger theme node repulsion
      secondary: 1.0,    // Increased goal node repulsion
      tertiary: 0.5      // Significantly increased strategy repulsion
    },
    // Maximum distance for level-specific repulsion to apply
    repulsionDistance: {
      primary: 600,      // Increased theme repulsion distance
      secondary: 400,    // Increased goal repulsion distance
      tertiary: 200      // Significantly increased strategy repulsion distance
    },
    // Radial positioning parameters - increased separation
    radialPositioning: {
      enabled: true,
      primary: 650,      // Themes positioned further out
      secondary: 400,    // Goals in a wider middle layer
      tertiary: 180      // Strategies spread out more in center
    }
  };
  

  // Helper function to get node level
  function getNodeLevel(node) {
    if (node.level) {
      return node.level; // Use explicit level if available
    }
    // Fall back to depth
    if (node.depth === 0) return 'primary';
    if (node.depth === 1) return 'secondary';
    if (node.depth === 2) return 'tertiary';
    return 'other';
  }

  const simulation = d3.forceSimulation(data.nodes)
  .force('link', d3.forceLink(data.links)
    .id(d => d.id)
    .distance(d => {
      // Adjust link distance based on the levels of connected nodes
      const sourceLevel = getNodeLevel(d.source);
      const targetLevel = getNodeLevel(d.target);
      
      // Hierarchical links (parent-child relationships)
      if (d.type === 'part_of_theme' || d.type === 'part_of_goal') {
        return 180; // Longer links for hierarchical relationships
      }
      
      // Similar content links - make these weaker to prevent bunching
      if (d.type === 'similar_content') {
        return 120; // Medium length for similarity links
      }
      
      // Links between different levels
      if (sourceLevel !== targetLevel) {
        return 200; // Longer links between different levels
      }
      
      // Default link distance
      return 100;
    })
    .strength(d => {
      // Reduce strength of similarity links to prevent tight clustering
      if (d.type === 'similar_content') {
        return 0.1 * (d.weight || 0.5); // Weaker connection based on similarity weight
      }
      
      // Maintain stronger hierarchical connections
      if (d.type === 'part_of_theme' || d.type === 'part_of_goal') {
        return 0.7; // Stronger parent-child connections
      }
      
      return 0.4; // Default strength
    })
  )
  .force('charge', d3.forceManyBody()
    .strength(d => {
      // Get node level
      const level = getNodeLevel(d);
      
      // Return configured strength
      return levelConfig.chargeStrength[level] || -100;
    })
    .distanceMin(10)
    .distanceMax(500) // Increased maximum distance
  )
  .force('center', d3.forceCenter(width / 2, height / 2))
  .force('collision', d3.forceCollide()
    .radius(d => calculateNodeSize(d) + 15) // Increased collision radius
    .strength(0.9) // Stronger collision prevention
  )
  // Enhanced radial positioning force
  .force('radial', d3.forceRadial()
    .radius(d => {
      if (!levelConfig.radialPositioning.enabled) return null;
      
      const level = getNodeLevel(d);
      
      // Add slight randomness to break symmetry
      const jitter = (Math.random() - 0.5) * 30;
      
      return (levelConfig.radialPositioning[level] || 250) + jitter;
    })
    .x(width / 2)
    .y(height / 2)
    .strength(0.5) // Increased strength
  )
  // Add custom repulsion for each level
  .force('primaryRepulsion', levelRepulsion('primary'))
  .force('secondaryRepulsion', levelRepulsion('secondary'))
  .force('tertiaryRepulsion', levelRepulsion('tertiary'))
  .force('cluster', forceCluster(0.05))
  .force('interCommunityRepulsion', interCommunityRepulsion(1.5));


// Modify the custom levelRepulsion function to use the configured strengths (around line 334)
function levelRepulsion(targetLevel) {
  let nodes;
  
  function force(alpha) {
    // Skip if no strength configured for this level
    if (!levelConfig.levelRepulsionStrength[targetLevel]) return;
    
    const strength = levelConfig.levelRepulsionStrength[targetLevel];
    const maxDistance = levelConfig.repulsionDistance[targetLevel] || 150;
    
    // Get only the nodes of the target level
    const levelNodes = nodes.filter(n => getNodeLevel(n) === targetLevel);
    
    // Apply repulsion between each pair of level nodes
    for (let i = 0; i < levelNodes.length; i++) {
      const nodeA = levelNodes[i];
      
      for (let j = i + 1; j < levelNodes.length; j++) {
        const nodeB = levelNodes[j];
        
        // Calculate distance between nodes
        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Skip if nodes are too far apart (optimization)
        if (distance > maxDistance) continue;
        
        // Calculate repulsion force, stronger when closer
        const force = strength * alpha / Math.max(distance, 1);
        
        // Apply force
        nodeA.vx += dx * force;
        nodeA.vy += dy * force;
        nodeB.vx -= dx * force;
        nodeB.vy -= dy * force;
      }
    }
  }
  
  force.initialize = function(_nodes) {
    nodes = _nodes;
  };
  
  return force;
}

  // Define forces with community clustering
  // const simulation = d3.forceSimulation(data.nodes)
  //   .force('link', d3.forceLink(data.links).id(d => d.id).distance(100))
  //   .force('charge', d3.forceManyBody()
  //     .strength(d => {
  //       // Get node level (primary, secondary, tertiary)
  //       const level = getNodeLevel(d);
        
  //       // Return configured strength for this level, or default value
  //       return levelConfig.chargeStrength[level] || -300;
  //     })
  //   )
  //   .force('center', d3.forceCenter(width / 2, height / 2))
  //   .force('collision', d3.forceCollide().radius(d => calculateNodeSize(d) + 10))
  //   // Add custom repulsion for each level
  //   .force('primaryRepulsion', levelRepulsion('primary'))
  //   .force('secondaryRepulsion', levelRepulsion('secondary'))
  //   .force('tertiaryRepulsion', levelRepulsion('tertiary'))
  //   .force('cluster', forceCluster());

  // // Custom force function to apply additional repulsion between nodes of a specific level
  // function levelRepulsion(targetLevel) {
  //   let nodes;
    
  //   function force(alpha) {
  //     // Skip if no strength configured for this level
  //     if (!levelConfig.levelRepulsionStrength[targetLevel]) return;
      
  //     const strength = levelConfig.levelRepulsionStrength[targetLevel];
  //     const maxDistance = levelConfig.repulsionDistance[targetLevel] || 150;
      
  //     // Get only the nodes of the target level
  //     const levelNodes = nodes.filter(n => getNodeLevel(n) === targetLevel);
      
  //     // Apply repulsion between each pair of level nodes
  //     for (let i = 0; i < levelNodes.length; i++) {
  //       const nodeA = levelNodes[i];
        
  //       for (let j = i + 1; j < levelNodes.length; j++) {
  //         const nodeB = levelNodes[j];
          
  //         // Calculate distance between nodes
  //         const dx = nodeA.x - nodeB.x;
  //         const dy = nodeA.y - nodeB.y;
  //         const distance = Math.sqrt(dx * dx + dy * dy);
          
  //         // Skip if nodes are too far apart (optimization)
  //         if (distance > maxDistance) continue;
          
  //         // Calculate repulsion force
  //         const force = strength * alpha / distance;
          
  //         // Apply force
  //         nodeA.vx += dx * force;
  //         nodeA.vy += dy * force;
  //         nodeB.vx -= dx * force;
  //         nodeB.vy -= dy * force;
  //       }
  //     }
  //   }
    
  //   force.initialize = function(_nodes) {
  //     nodes = _nodes;
  //   };
    
  //   return force;
  // }
  
  // Draw links
  const link = g.selectAll('.link')
    .data(data.links)
    .enter()
    .append('line')
    .attr('class', 'link')
    .attr('stroke-width', d => Math.sqrt(d.weight || 1) * 2)
    .attr('stroke', getLinkColor);
  
  // Draw nodes
  const node = g.selectAll('.node')
    .data(data.nodes)
    .enter()
    .append('circle')
    .attr('class', d => `node ${d.is_central ? 'central-node' : ''}`)
    .attr('r', calculateNodeSize)
    .attr('fill', getNodeColor)
    .call(drag(simulation))
    .on('mouseover', showTooltip)
    .on('mouseout', hideTooltip)
    .on('click', nodeClicked);
  
  // Add node labels
  const label = g.selectAll('.label')
    .data(data.nodes)
    .enter()
    .append('text')
    .attr('class', 'label')
    .text(d => d.label ? (d.label.length > 15 ? d.label.substring(0, 15) + '...' : d.label) : '')
    .attr('font-size', 10)
    .attr('dx', 12)
    .attr('dy', 4);
  
  // Add community labels
  const communityLabels = g.selectAll('.community-label')
    .data(communities)
    .enter()
    .append('text')
    .attr('class', 'community-label')
    .text(d => {
      // Find a node in this community to get the label
      const communityNode = data.nodes.find(node => node.community === d);
      return communityNode ? communityNode.community_label : `Cluster ${d}`;
    })
    .attr('font-size', 15)
    .attr('font-weight', 'bold')
    .attr('fill', d => colorScale(d))
    .attr('opacity', 0.7);
  
  // Update positions on simulation tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    
    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);
    
    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);
    
    // Update community label positions to center of each community
    communityLabels.each(function(communityId) {
      const communityNodes = data.nodes.filter(n => n.community === communityId);
      if (communityNodes.length > 0) {
        const centerX = d3.mean(communityNodes, d => d.x);
        const centerY = d3.mean(communityNodes, d => d.y);
        d3.select(this)
          .attr('x', centerX)
          .attr('y', centerY);
      }
    });
  });

  function getNodeColor(d) {
    // All nodes should use their community color
    if (d.community !== undefined) {
      return colorScale(d.community);
    }
    
    // Fallback colors for nodes without a community
    if (d.type === 'topic') {
      return '#6baed6'; // Blue for themes
    } else if (d.type === 'document') {
      return '#fd8d3c'; // Orange for goals
    } else if (d.type === 'strategy') {
      return '#74c476'; // Green for strategies
    }
    
    // Default for any other node types
    return '#cccccc';
  }
  
  // Replace the getLinkColor function with this:
  function getLinkColor(d) {
    // For hierarchical links, use the parent's community color
    if (d.type === 'part_of_theme' || d.type === 'part_of_goal') {
      // For links from goals to themes or strategies to goals,
      // use the community color of the target node (parent)
      if (d.target && d.target.community !== undefined) {
        return colorScale(d.target.community);
      }
    }
    
    // For similar_content links, use a distinct color
    if (d.type === 'similar_content') return '#787878'; // Purple for similarity links
    
    // For related_to links between nodes in the same community, use community color
    if (d.source.community !== undefined && 
        d.target.community !== undefined && 
        d.source.community === d.target.community) {
      return colorScale(d.source.community);
    }
    
    // For links between different communities, use light blue
    return '#9ecae1';
  }
  
  function showTooltip(event, d) {
    let content = `<strong>${d.label || d.id}</strong><br/>`;
    
    if (d.type === 'topic') {
      content += `<strong>Keywords:</strong> ${(d.keywords || []).join(', ')}<br/>`;
      if (d.community_label) {
        content += `<strong>Cluster:</strong> ${d.community_label}<br/>`;
      }
      if (d.docs) {
        content += `<strong>Documents:</strong> ${d.docs.length}`;
      }
      if (d.is_central) {
        content += `<br/><em>Central topic in this cluster</em>`;
      }
    } else if (d.type === 'strategy') {
      // For strategy nodes, show a shortened version of the text
      content += `${d.text ? d.text.substring(0, 100) + (d.text.length > 100 ? '...' : '') : ''}`;
      // Add similarity connections count if available
      if (d.connections && d.connections.length > 0) {
        content += `<br/><em>Has ${d.connections.length} similar strategies</em>`;
      }
    } else {
      content += `${d.text ? d.text.substring(0, 100) + (d.text.length > 100 ? '...' : '') : ''}`;
    }
    
    tooltip.transition()
      .duration(200)
      .style('opacity', .9);
    
    tooltip.html(content)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 28) + 'px');
  }
  
  function hideTooltip() {
    tooltip.transition()
      .duration(500)
      .style('opacity', 0);
  }
  
  function nodeClicked(event, d) {
    // Show details panel with node information
    showNodeDetails(d);
    
    // Highlight this node
    highlightNode(d);
  }
  
  // Force to cluster nodes by community
  function forceCluster() {
    const strength = 0.6;
    let nodes;
    
    function force(alpha) {
      // For each node
      for (const node of nodes) {
        if (node.community === undefined) continue;
        
        // Find other nodes in same community
        const cluster = nodes.filter(n => n.community === node.community);
        if (cluster.length === 0) continue;
        
        // Calculate cluster center
        const clusterX = d3.mean(cluster, d => d.x);
        const clusterY = d3.mean(cluster, d => d.y);
        
        // Apply force toward cluster center
        node.vx += (clusterX - node.x) * alpha * strength;
        node.vy += (clusterY - node.y) * alpha * strength;
      }
    }
    
    force.initialize = function(_nodes) {
      nodes = _nodes;
    }
    
    return force;
  }

  function interCommunityRepulsion(strength = 1.5) {
    let nodes;
    
    function force(alpha) {
      // Loop through all pairs of nodes from different communities
      for (let i = 0; i < nodes.length; i++) {
        const nodeA = nodes[i];
        // Skip if node has no community
        if (nodeA.community === undefined) continue;
        
        for (let j = i + 1; j < nodes.length; j++) {
          const nodeB = nodes[j];
          // Skip if node has no community or is from the same community
          if (nodeB.community === undefined || nodeA.community === nodeB.community) continue;
          
          // Only apply strong repulsion to primary (theme) nodes
          let repulsionStrength = strength;
          if (getNodeLevel(nodeA) !== 'primary' || getNodeLevel(nodeB) !== 'primary') {
            repulsionStrength *= 0.3; // Much weaker repulsion for non-theme nodes
          }
          
          // Calculate distance between nodes
          const dx = nodeA.x - nodeB.x;
          const dy = nodeA.y - nodeB.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Skip if too far apart (optimization)
          if (distance > 800) continue;
          
          // Calculate repulsion force - stronger when nodes are from different communities
          const repulsion = repulsionStrength * alpha * Math.min(1.0, 800 / (distance * distance));
          
          // Apply force
          nodeA.vx += dx * repulsion;
          nodeA.vy += dy * repulsion;
          nodeB.vx -= dx * repulsion;
          nodeB.vy -= dy * repulsion;
        }
      }
    }
    
    force.initialize = function(_nodes) {
      nodes = _nodes;
    };
    
    return force;
  }
  
  function drag(simulation) {
    function dragstarted(event) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }
    
    function dragged(event) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }
    
    function dragended(event) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }
    
    return d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended);
  }
  
  return {
    simulation,
    svg,
    zoom,
    g,
    nodes: data.nodes,
    links: data.links,
    nodeElements: node,
    linkElements: link,
    labelElements: label,
    communities: communities,
    colorScale: colorScale
  };
}

// Load graph data and initialize visualization
async function loadGraphData() {
  try {
    const response = await fetch('/api/graph');
    const data = await response.json();
    
    if (data.error) {
      showStatus(data.error, 'error');
      return;
    }
    
    // Create graph visualization
    graphViz = createKnowledgeGraph(data, graphContainer);
    
    // Set up the cluster panel
    setupClusterPanel();
    
    showStatus('Graph visualization loaded!', 'success');
  } catch (error) {
    showStatus(`Error loading graph: ${error.message}`, 'error');
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Handle HTTPS specific issues
  if (window.location.protocol === 'https:') {
    console.log('Running over HTTPS protocol');
    
    // Ensure calculateNodeSize function exists
    if (typeof calculateNodeSize !== 'function') {
      console.warn('calculateNodeSize not found, defining fallback function');
      // Create fallback function if the one from utils.js didn't load
      window.calculateNodeSize = function(d) {
        let size = 5;
        if (d.type === 'topic') {
          size = 10 + (d.size || 1) / 2;
          if (size > 25) size = 25;
        }
        if (d.is_central) size *= 1.5;
        return size;
      };
    }
    
    // Ensure debounce function exists
    if (typeof debounce !== 'function') {
      console.warn('debounce not found, defining fallback function');
      // Create fallback function if the one from utils.js didn't load
      window.debounce = function(func, wait) {
        let timeout;
        return function(...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(this, args), wait);
        };
      };
    }
  }
  
  initializeEventListeners();
  
  // Try to load saved data if available
  fetch('/api/load')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showStatus('Loaded saved graph data', 'success');
        loadGraphData();
      } else {
        // If no saved data, automatically load sample data
        showStatus('No saved data found. Loading sample data...', 'loading');
        sampleBtn.click();
      }
    })
    .catch(error => {
      // On error, automatically load sample data
      showStatus('Error loading saved data. Loading sample data...', 'loading');
      sampleBtn.click();
    });
});