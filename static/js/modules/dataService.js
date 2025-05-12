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

// Track active search requests to allow cancellation
let activeSearchController = null;
let searchCache = {};
const CACHE_MAX_SIZE = 20;  // Maximum number of cached search results
const CACHE_TTL = 5 * 60 * 1000;  // 5 minutes in milliseconds
const SEARCH_TIMEOUT = 12000;  // 12 seconds until client-side timeout

/**
 * Search nodes by query with improved cancellation and timeout handling
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {boolean} options.useCache - Whether to use cached results if available
 * @param {boolean} options.semantic - Force semantic search option
 * @param {Function} options.onProgress - Callback for search progress updates
 * @returns {Promise} - Promise for the enhanced search results with match information
 */
export async function searchNodes(query, options = {}) {
  const startTime = performance.now();
  let results = [];
  
  // Set default options
  const {
    useCache = true,
    semantic = 'auto',
    onProgress = null
  } = options;
  
  // Check if search is cached and not expired
  if (useCache && searchCache[query] && 
     (Date.now() - searchCache[query].timestamp < CACHE_TTL)) {
    // Use cached results but run in background for fresh results
    setTimeout(() => refreshCacheInBackground(query, options), 0);
    
    // Return cached results immediately
    return searchCache[query].results;
  }
  
  // Cancel any ongoing search
  if (activeSearchController) {
    activeSearchController.abort();
  }
  
  // Create a new abort controller for this search
  activeSearchController = new AbortController();
  const signal = activeSearchController.signal;
  
  // Set up client-side timeout
  const timeoutId = setTimeout(() => {
    if (activeSearchController) {
      activeSearchController.abort();
    }
  }, SEARCH_TIMEOUT);
  
  try {
    // Notify about search starting
    if (onProgress) {
      onProgress({
        status: 'started',
        query: query,
        message: 'Starting search...'
      });
    }
    
    // Build search URL with parameters
    const searchParams = new URLSearchParams();
    searchParams.append('q', query);
    if (semantic !== 'auto') {
      searchParams.append('semantic', semantic);
    }
    
    // Make the request with the abort signal
    const response = await fetch(`/api/search?${searchParams.toString()}`, {
      signal: signal,
      headers: {
        'X-Client-Timeout': SEARCH_TIMEOUT.toString()
      }
    });
    
    // Clear the timeout since the request completed
    clearTimeout(timeoutId);
    
    // Handle search progress based on response headers
    if (onProgress && response.headers.get('X-Search-Progress')) {
      onProgress({
        status: 'progress',
        query: query,
        message: response.headers.get('X-Search-Progress'),
        percent: parseInt(response.headers.get('X-Search-Percent') || '50')
      });
    }
    
    results = await response.json();
    
    // Calculate response time
    const endTime = performance.now();
    const responseTime = Math.round(endTime - startTime);
    
    // Notify about search completion
    if (onProgress) {
      onProgress({
        status: 'completed',
        query: query,
        message: `Found ${results.length} results`,
        responseTime: responseTime
      });
    }
    
    // Determine search type based on headers or response content
    let searchType = 'keyword';
    
    // Check for response headers indicating search type
    if (response.headers.get('X-Search-Progress')) {
      searchType = 'semantic';
    } else if (results.some(result => result.match_info && result.match_info.match_type === 'semantic')) {
      searchType = 'combined';
    }
    
    // Track search in analytics with search type
    trackSearch(query, results.length, responseTime, searchType);
    
    // Process results to add useful display information
    const processedResults = results.map(result => {
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
    
    // Cache the results
    updateSearchCache(query, processedResults);
    
    return processedResults;
    
  } catch (error) {
    // Clear the timeout if it's still active
    clearTimeout(timeoutId);
    
    // Check if this is an abort error (user cancelled or timeout)
    if (error.name === 'AbortError') {
      console.log('Search request was cancelled');
      
      // Notify about search cancellation
      if (onProgress) {
        onProgress({
          status: 'cancelled',
          query: query,
          message: 'Search was cancelled'
        });
      }
      
      // Return empty results for aborted search
      return [];
    }
    
    console.error('Search error:', error);
    
    // Notify about search error
    if (onProgress) {
      onProgress({
        status: 'error',
        query: query,
        message: `Error: ${error.message}`
      });
    }
    
    // Track error in analytics
    trackError('search_error', error.message, {
      query: query,
      context: 'searchNodes'
    });
    
    return [];
  } finally {
    // Clear the controller reference when done
    activeSearchController = null;
  }
}

/**
 * Update the search cache with new results
 * @param {string} query - The search query
 * @param {Array} results - The search results
 */
function updateSearchCache(query, results) {
  // Add/update cache entry
  searchCache[query] = {
    results: results,
    timestamp: Date.now()
  };
  
  // Trim cache if it gets too large
  const cacheKeys = Object.keys(searchCache);
  if (cacheKeys.length > CACHE_MAX_SIZE) {
    // Sort by age (oldest first)
    cacheKeys.sort((a, b) => searchCache[a].timestamp - searchCache[b].timestamp);
    
    // Remove oldest entries
    const keysToRemove = cacheKeys.slice(0, cacheKeys.length - CACHE_MAX_SIZE);
    keysToRemove.forEach(key => delete searchCache[key]);
  }
}

/**
 * Refresh cache in background without blocking UI
 * @param {string} query - The search query
 * @param {Object} options - Search options
 */
async function refreshCacheInBackground(query, options) {
  try {
    // Run a fresh search but don't use cache and don't update UI
    await searchNodes(query, {
      ...options,
      useCache: false,
      onProgress: null // Don't show progress for background refresh
    });
  } catch (error) {
    console.log('Background cache refresh failed:', error);
    // Failures here can be ignored as they don't affect the user experience
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