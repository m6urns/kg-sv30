// Data service for fetching graph data

/**
 * Load graph data from the API
 * @param {Function} onSuccess - Success callback for loaded graph
 * @param {Function} showStatus - Function to display status messages
 * @returns {Promise} - Promise for the data loading
 */
export async function loadGraphData(onSuccess, showStatus) {
  try {
    const response = await fetch('/api/graph');
    const data = await response.json();
    
    if (data.error) {
      showStatus(data.error, 'error');
      return null;
    }
    
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
 * Fetch communities data for the cluster panel
 * @returns {Promise} - Promise for the communities data
 */
export async function fetchCommunities() {
  try {
    const response = await fetch('/api/communities');
    return await response.json();
  } catch (error) {
    console.error('Error fetching communities:', error);
    return [];
  }
}

/**
 * Fetch node details by ID
 * @param {string} nodeId - ID of the node to fetch
 * @returns {Promise} - Promise for the node data
 */
export async function fetchNodeDetails(nodeId) {
  try {
    const response = await fetch(`/api/node/${nodeId}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching node details:', error);
    return null;
  }
}

/**
 * Search nodes by query
 * @param {string} query - Search query
 * @returns {Promise} - Promise for the search results
 */
export async function searchNodes(query) {
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    return await response.json();
  } catch (error) {
    console.error('Search error:', error);
    return [];
  }
}

/**
 * Load sample data
 * @param {Function} showStatus - Function to display status
 * @param {Function} onSuccess - Callback on success
 */
export async function loadSampleData(showStatus, onSuccess) {
  showStatus('Loading sample data...', 'loading');
  try {
    const response = await fetch('/api/process?generator=sample', { method: 'POST' });
    const data = await response.json();
    
    if (data.success) {
      showStatus('Sample data loaded successfully!', 'success');
      if (onSuccess) onSuccess();
    } else {
      showStatus(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}

/**
 * Load saved graph data
 * @param {Function} showStatus - Function to display status
 * @param {Function} onSuccess - Callback on success
 */
export async function loadSavedData(showStatus, onSuccess) {
  showStatus('Loading saved graph data...', 'loading');
  try {
    const response = await fetch('/api/load');
    const data = await response.json();
    
    if (data.success) {
      showStatus('Graph data loaded successfully!', 'success');
      if (onSuccess) onSuccess();
    } else {
      showStatus(`Error: ${data.error}`, 'error');
    }
  } catch (error) {
    showStatus(`Error: ${error.message}`, 'error');
  }
}