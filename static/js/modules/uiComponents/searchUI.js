// Search UI functionality
import { focusOnNode } from '../nodeInteraction.js';
import { getDOMReference } from './common.js';

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
  const searchResults = getDOMReference('searchResults');
  const searchInput = getDOMReference('searchInput');
  
  if (!searchResults || !searchInput) return;
  
  searchResults.innerHTML = '';
  
  if (results.length === 0) {
    searchResults.innerHTML = '<p class="p-2">No results found</p>';
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
      matchSummaryDiv.textContent = result.match_summary || 'Match found';
      li.appendChild(matchSummaryDiv);
      
      // If we have a best match with text content, show a preview
      if (result.best_match && result.best_match.text) {
        // Create container for match preview
        const previewDiv = document.createElement('div');
        previewDiv.className = 'match-preview';
        
        // Get a relevant snippet of text with the match context
        let previewText = result.best_match.text;
        const query = searchInput.value.trim().toLowerCase();
        
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