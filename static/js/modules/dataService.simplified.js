// Simplified data service that uses static files directly when possible

/**
 * Load graph data directly from static file
 * @param {Function} onSuccess - Success callback for loaded graph
 * @param {Function} showStatus - Function to display status messages
 * @returns {Promise} - Promise for the data loading
 */
export async function loadGraphData(onSuccess, showStatus) {
  try {
    // Load directly from static file instead of API
    const response = await fetch('/static/graph_data.json');
    const data = await response.json();
    
    if (onSuccess) {
      onSuccess(data);
    }
    
    showStatus('Graph visualization loaded!', 'success');
    return data;
  } catch (error) {
    showStatus(`Error loading graph: ${error.message}`, 'error');
    return null;
  }
}

/**
 * Fetch communities data from the static graph data
 * @returns {Promise} - Promise for the communities data
 */
export async function fetchCommunities() {
  try {
    // Load graph data directly and extract communities
    const response = await fetch('/static/graph_data.json');
    const graphData = await response.json();
    
    // Extract communities from the graph data
    const communities = {};
    
    for (const node of graphData.nodes) {
      if (node.type === 'topic' && 'community' in node) {
        const commId = node.community;
        if (!(commId in communities)) {
          communities[commId] = {
            id: commId,
            label: node.community_label || `Cluster ${commId}`,
            topics: [],
            central_topics: []
          };
        }
        
        const topicInfo = {
          id: node.id,
          label: node.label,
          keywords: node.keywords || [],
          size: node.size || 1
        };
        
        communities[commId].topics.push(topicInfo);
        
        if (node.is_central) {
          communities[commId].central_topics.push(topicInfo);
        }
      }
    }
    
    return Object.values(communities);
  } catch (error) {
    console.error('Error fetching communities:', error);
    return [];
  }
}

/**
 * Fetch node details from the static graph data
 * @param {string} nodeId - ID of the node to fetch
 * @returns {Promise} - Promise for the node data
 */
export async function fetchNodeDetails(nodeId) {
  try {
    // Load graph data directly and find the specific node
    const response = await fetch('/static/graph_data.json');
    const graphData = await response.json();
    
    // Find the node
    let foundNode = null;
    for (const node of graphData.nodes) {
      if (node.id === nodeId) {
        foundNode = node;
        break;
      }
    }
    
    if (!foundNode) {
      console.error(`Node not found: ${nodeId}`);
      return null;
    }
    
    // Get connected nodes
    const connected = [];
    for (const link of graphData.links) {
      if (link.source === nodeId) {
        const targetNode = graphData.nodes.find(n => n.id === link.target);
        if (targetNode) {
          connected.push({
            node: targetNode,
            relationship: link.type || 'related_to'
          });
        }
      } else if (link.target === nodeId) {
        const sourceNode = graphData.nodes.find(n => n.id === link.source);
        if (sourceNode) {
          connected.push({
            node: sourceNode,
            relationship: link.type || 'related_to'
          });
        }
      }
    }
    
    return {
      node: foundNode,
      connections: connected
    };
  } catch (error) {
    console.error('Error fetching node details:', error);
    return null;
  }
}

/**
 * Search nodes by query - uses the API since this requires more complex processing
 * @param {string} query - Search query
 * @returns {Promise} - Promise for the search results
 */
export async function searchNodes(query) {
  try {
    // Use the API for search operations
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    return await response.json();
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

/**
 * Load sample data - this function is simplified since we don't regenerate in production
 * @param {Function} showStatus - Function to display status
 * @param {Function} onSuccess - Callback on success
 */
export async function loadSampleData(showStatus, onSuccess) {
  showStatus('Loading static data...', 'loading');
  try {
    // Simply load the static file instead of using an API to regenerate
    const response = await fetch('/static/graph_data.json');
    await response.json(); // Just to validate the JSON is valid
    
    showStatus('Data loaded successfully!', 'success');
    if (onSuccess) onSuccess();
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

/**
 * Load saved graph data - simplified as we just load static file
 * @param {Function} showStatus - Function to display status
 * @param {Function} onSuccess - Callback on success
 */
export async function loadSavedData(showStatus, onSuccess) {
  loadSampleData(showStatus, onSuccess); // Reuse the same function as they're now identical
}