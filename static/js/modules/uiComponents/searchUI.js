// Search UI functionality
import { focusOnNode } from '../nodeInteraction.js';
import { getDOMReference } from './common.js';
import { sanitizeString } from '../utils.js';

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
        matchSummaryDiv.textContent = result.match_summary || 'Match found';
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
        
        // Add special class for semantic matches
        if (result.match_info.match_type === 'semantic') {
          previewDiv.className += ' semantic-preview';
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