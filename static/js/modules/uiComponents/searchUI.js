// Search UI functionality
import { focusOnNode } from '../nodeInteraction.js';
import { getDOMReference } from './common.js';
import { sanitizeString } from '../utils.js';
import { searchNodes } from '../dataService.js';

// Track current search state
let currentSearchQuery = '';
let isSearching = false;
let searchTimeoutMessage = null;

/**
 * Show a status message
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, loading)
 * @param {HTMLElement} statusElement - Status element to update
 */
export function showStatus(message, type, statusElement) {
  if (!statusElement) return;
  
  // Hide standard status messages unless they're loading type
  if (message && (message.includes("loaded") || (message.includes("Loading") && type !== "loading"))) {
    statusElement.textContent = "";
    statusElement.className = "";
    return;
  }
  
  // Show error or loading messages
  if (type === "error" || type === "loading") {
    statusElement.textContent = message;
    statusElement.className = type;
  } else {
    statusElement.textContent = "";
    statusElement.className = "";
  }
}

/**
 * Create a loading indicator for search results
 * @param {string} message - Loading message to display
 * @param {boolean} isLongRunning - Whether this is a potentially long-running operation
 * @returns {HTMLElement} - The loading indicator element
 */
function createLoadingIndicator(message = 'Searching...', isLongRunning = false) {
  const container = document.createElement('div');
  container.className = 'search-loading-container';
  
  // Create spinner
  const spinner = document.createElement('div');
  spinner.className = 'search-spinner';
  container.appendChild(spinner);
  
  // Create message
  const messageElem = document.createElement('div');
  messageElem.className = 'search-loading-message';
  messageElem.textContent = message;
  container.appendChild(messageElem);
  
  // Add cancel button for long-running searches
  if (isLongRunning) {
    const cancelButton = document.createElement('button');
    cancelButton.className = 'search-cancel-button';
    cancelButton.textContent = 'Cancel';
    cancelButton.addEventListener('click', () => {
      // This will trigger the dataService to abort the active request
      // The onSearchProgress handler will update the UI
      triggerSearchCancel();
    });
    container.appendChild(cancelButton);
    
    // Add potential timeout message for long-running searches
    const timeoutMessage = document.createElement('div');
    timeoutMessage.className = 'search-timeout-message';
    timeoutMessage.textContent = 'Semantic search may take longer on resource-constrained systems';
    timeoutMessage.style.display = 'none';
    container.appendChild(timeoutMessage);
    
    // Store reference for later visibility toggling
    searchTimeoutMessage = timeoutMessage;
    
    // Show timeout message after 3 seconds
    setTimeout(() => {
      if (isSearching && searchTimeoutMessage) {
        searchTimeoutMessage.style.display = 'block';
      }
    }, 3000);
  }
  
  return container;
}

/**
 * Request cancellation of the current search
 */
function triggerSearchCancel() {
  // This will be picked up by the AbortController in dataService.js
  const searchInput = getDOMReference('searchInput');
  
  // Re-trigger search with empty query to force cancellation
  if (searchInput) {
    // Mark search as complete to avoid UI jumping
    isSearching = false;
    
    // Clear the input - this will trigger the input event handler
    searchInput.value = '';
    
    // Dispatch input event to trigger search cancellation
    searchInput.dispatchEvent(new Event('input'));
  }
}

/**
 * Handle search progress updates
 * @param {Object} progress - Search progress information
 */
function onSearchProgress(progress) {
  const searchResults = getDOMReference('searchResults');
  if (!searchResults) return;
  
  // Handle different progress states
  switch (progress.status) {
    case 'started':
      isSearching = true;
      
      // Clear results and show loading indicator
      while (searchResults.firstChild) {
        searchResults.removeChild(searchResults.firstChild);
      }
      
      // Check if this is likely a semantic search
      const query = progress.query || '';
      const isLikelySemantic = query.length > 0 && query.indexOf(' ') >= 0;
      
      // Add loading indicator
      searchResults.appendChild(createLoadingIndicator(
        'Searching...', 
        isLikelySemantic // Show cancel button for likely semantic searches
      ));
      searchResults.style.display = 'block';
      break;
      
    case 'progress':
      // Update loading message if available
      if (progress.message) {
        const messageElem = searchResults.querySelector('.search-loading-message');
        if (messageElem) {
          messageElem.textContent = progress.message;
        }
      }
      break;
      
    case 'cancelled':
      isSearching = false;
      
      // Hide timeout message
      if (searchTimeoutMessage) {
        searchTimeoutMessage.style.display = 'none';
        searchTimeoutMessage = null;
      }
      
      // Show cancelled message
      while (searchResults.firstChild) {
        searchResults.removeChild(searchResults.firstChild);
      }
      const cancelledMsg = document.createElement('div');
      cancelledMsg.className = 'search-cancelled-message';
      cancelledMsg.textContent = 'Search cancelled';
      searchResults.appendChild(cancelledMsg);
      break;
      
    case 'error':
      isSearching = false;
      
      // Hide timeout message
      if (searchTimeoutMessage) {
        searchTimeoutMessage.style.display = 'none';
        searchTimeoutMessage = null;
      }
      
      // Show error message
      while (searchResults.firstChild) {
        searchResults.removeChild(searchResults.firstChild);
      }
      const errorMsg = document.createElement('div');
      errorMsg.className = 'search-error-message';
      errorMsg.textContent = progress.message || 'Error performing search';
      searchResults.appendChild(errorMsg);
      break;
  }
}

/**
 * Perform a search with the given query
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Promise for search results 
 */
export async function performSearch(query) {
  if (!query || query.trim() === '') {
    const searchResults = getDOMReference('searchResults');
    if (searchResults) {
      searchResults.style.display = 'none';
    }
    
    // Reset search state
    isSearching = false;
    currentSearchQuery = '';
    
    // Hide timeout message if visible
    if (searchTimeoutMessage) {
      searchTimeoutMessage.style.display = 'none';
      searchTimeoutMessage = null;
    }
    
    return [];
  }
  
  // Save current query
  currentSearchQuery = query.trim();
  
  // Show loading immediately
  onSearchProgress({
    status: 'started',
    query: query
  });
  
  // Perform search with progress reporting
  const results = await searchNodes(query, {
    onProgress: onSearchProgress
  });
  
  // Clear searching state
  isSearching = false;
  
  // Hide timeout message if visible
  if (searchTimeoutMessage) {
    searchTimeoutMessage.style.display = 'none';
    searchTimeoutMessage = null;
  }
  
  // Display results
  displaySearchResults(results);
  
  return results;
}

/**
 * Display search results in the UI with enhanced match information
 * @param {Array} results - Enhanced search result items
 */
export function displaySearchResults(results) {
  const searchResults = getDOMReference('searchResults');
  const searchInput = getDOMReference('searchInput');
  
  if (!searchResults || !searchInput) return;
  
  // Safely clear the search results
  while (searchResults.firstChild) {
    searchResults.removeChild(searchResults.firstChild);
  }
  
  if (results.length === 0) {
    // Use DOM manipulation instead of innerHTML
    searchResults.textContent = ''; // Clear safely
    const noResultsP = document.createElement('p');
    noResultsP.className = 'p-2';
    noResultsP.textContent = 'No results found';
    searchResults.appendChild(noResultsP);
    searchResults.style.display = 'block';
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
      
      // Check if this is a semantic match and style differently
      if (result.match_info.match_type === 'semantic') {
        matchSummaryDiv.className += ' semantic-match';
        matchSummaryDiv.textContent = '✨ Semantic match: ' + (result.match_summary || 'Similar content found');
      } else {
        matchSummaryDiv.className += ' keyword-match';
        matchSummaryDiv.textContent = '🔎 Keyword match: ' + (result.match_summary || 'Exact text found');
      }
      
      li.appendChild(matchSummaryDiv);
      
      // Show a preview of the matching content
      let previewText = '';
      
      // First try to get preview from best_match
      if (result.best_match && result.best_match.text) {
        previewText = result.best_match.text;
      } 
      // If no best_match but we have match_info with matches, use the first match's text
      else if (result.match_info.matches && result.match_info.matches.length > 0 && result.match_info.matches[0].text) {
        previewText = result.match_info.matches[0].text;
      }
      // If semantic match but no specific text, try to get text from node
      else if (result.match_info.match_type === 'semantic') {
        // Try to find best text field based on node type
        if (result.type === 'strategy' && result.text) {
          previewText = result.text;
        } else if (result.type === 'topic' && result.description) {
          previewText = result.description;
        } else if (result.text) {
          previewText = result.text;
        } else {
          // No good text field found, use label
          previewText = result.label;
        }
      }
      
      if (previewText) {
        // Create container for match preview
        const previewDiv = document.createElement('div');
        previewDiv.className = 'match-preview';
        
        const query = searchInput.value.trim().toLowerCase();
        
        // If text is long, create a snippet
        if (previewText.length > 150) {
          // For semantic matches, we might not find the exact query text
          // so just take the first 150 chars
          if (result.match_info.match_type === 'semantic') {
            previewText = previewText.substring(0, 150) + '...';
          } else {
            // For keyword matches, try to center on the match
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
        }
        
        previewDiv.textContent = previewText;
        
        // Add special class based on match type
        if (result.match_info.match_type === 'semantic') {
          previewDiv.className += ' semantic-preview';
        } else {
          previewDiv.className += ' keyword-preview';
        }
        
        li.appendChild(previewDiv);
      }
    }
    
    li.addEventListener('click', async () => {
      try {
        // Hide search results
        searchResults.style.display = 'none';
        searchInput.value = '';
        
        // Focus on the node in the graph
        // This will trigger displayNodeDetails which adds to our unified navigation
        focusOnNode(result.id);
      } catch (error) {
        console.error('Error fetching node details:', error);
      }
    });
    
    ul.appendChild(li);
  });
  
  searchResults.appendChild(ul);
  searchResults.style.display = 'block';
}