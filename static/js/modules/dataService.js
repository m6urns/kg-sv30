// Data service for fetching graph data
import { sanitizeString } from './utils.js';
import { trackSearch, trackError } from './analytics.js';

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
  const startTime = performance.now();
  
  try {
    const response = await fetch(`/api/node/${nodeId}`);
    const data = await response.json();
    
    // Calculate response time for performance tracking
    const responseTime = Math.round(performance.now() - startTime);
    
    // Track node details view in analytics
    if (data && data.node) {
      // Import here to avoid circular dependency
      import('./analytics.js').then(analytics => {
        analytics.trackNodeInteraction(nodeId, 'node_details_view', {
          type: data.node.type || 'unknown',
          responseTime: responseTime,
          connectionCount: data.connections ? data.connections.length : 0
        });
      });
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching node details:', error);
    
    // Track error in analytics
    trackError('api_error', error.message, {
      endpoint: `node/${nodeId}`,
      context: 'fetchNodeDetails'
    });
    
    return null;
  }
}

/**
 * Search nodes by query
 * @param {string} query - Search query
 * @returns {Promise} - Promise for the enhanced search results with match information
 */
export async function searchNodes(query) {
  const startTime = performance.now();
  let results = [];
  
  try {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    results = await response.json();
    
    // Calculate response time
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);
    
    // Track search in analytics
    trackSearch(query, results.length, responseTime);
    
    // Process results to add useful display information
    return results.map(result => {
      // Handle client-side sanitization for critical display fields
      // This will decode pre-escaped HTML entities if they exist
      if (result.label) {
        result.label = sanitizeString(result.label);
      }
      
      // Add a display-friendly version of match info if available
      if (result.match_info) {
        // Get the highest priority match for display summary
        const priorityOrder = {
          "high": 3,
          "medium": 2,
          "low": 1
        };
        
        // Sort matches by priority
        const sortedMatches = [...result.match_info.matches].sort((a, b) => {
          return priorityOrder[b.priority] - priorityOrder[a.priority];
        });
        
        // Handle each match text - properly decode pre-escaped HTML entities
        sortedMatches.forEach(match => {
          if (match.text) {
            match.text = sanitizeString(match.text);
          }
        });
        
        // Add a summary of where the match was found
        const matchFields = sortedMatches.map(match => sanitizeString(match.field));
        result.match_summary = `Found in: ${matchFields.join(', ')}`;
        
        // Add match score for display
        result.match_score = result.match_info.score;
        
        // Add the best match for immediate display
        if (sortedMatches.length > 0) {
          const bestMatch = sortedMatches[0];
          result.best_match = {
            field: sanitizeString(bestMatch.field),
            text: sanitizeString(bestMatch.text)
          };
        }
      }
      
      return result;
    });
  } catch (error) {
    console.error('Search error:', error);
    
    // Track error in analytics
    trackError('search_error', error.message, {
      query: query,
      context: 'searchNodes'
    });
    
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