// Filtering panel module for displaying nodes filtered by keywords
import { focusOnNode } from '../nodeInteraction.js';
import { getDOMReference } from './common.js';

/**
 * Render the filtered nodes view based on a keyword and community ID
 * @param {string} keyword - The keyword to filter by
 * @param {string|number} communityId - The ID of the community the keyword is from
 */
export function renderFilteredNodesView(keyword, communityId) {
  const filteredNodesPanel = getDOMReference('filteredNodesPanel');
  
  if (!filteredNodesPanel || !window.graphViz || !window.graphViz.nodes) return;
  
  // Clear previous content
  filteredNodesPanel.innerHTML = '';
  
  // Create content container with padding
  const contentContainer = document.createElement('div');
  contentContainer.className = 'nav-padding-container';
  contentContainer.style.padding = '20px';
  contentContainer.style.paddingBottom = '150px';
  filteredNodesPanel.appendChild(contentContainer);
  
  // Create header with filter information
  const header = document.createElement('div');
  header.className = 'filtered-header';
  
  // Create title showing what we're filtering by
  const title = document.createElement('h3');
  title.textContent = `Nodes containing "${keyword}"`;
  title.style.marginTop = '10px';
  header.appendChild(title);
  
  // Add subtitle showing the community
  const community = window.graphViz.communities.find(c => c.id === communityId);
  if (community) {
    const subtitle = document.createElement('p');
    subtitle.className = 'filter-subtitle';
    subtitle.textContent = `From cluster: ${community.label || communityId}`;
    if (window.graphViz.colorScale) {
      subtitle.style.color = window.graphViz.colorScale(communityId);
    }
    header.appendChild(subtitle);
  }
  
  contentContainer.appendChild(header);
  
  // Filter the nodes to find those with the keyword
  const filteredNodes = window.graphViz.nodes.filter(node => {
    // Check if node has keywords and if our target keyword is in there
    if (node.keywords && Array.isArray(node.keywords)) {
      return node.keywords.includes(keyword);
    }
    // Also check in content/text fields for the keyword
    if (node.text && typeof node.text === 'string') {
      return node.text.toLowerCase().includes(keyword.toLowerCase());
    }
    if (node.content && typeof node.content === 'string') {
      return node.content.toLowerCase().includes(keyword.toLowerCase());
    }
    return false;
  });
  
  // Group the filtered nodes by type (theme, goal, strategy)
  const groupedNodes = {
    topic: [], // Themes
    document: [], // Goals
    strategy: [] // Strategies
  };
  
  filteredNodes.forEach(node => {
    if (groupedNodes[node.type]) {
      groupedNodes[node.type].push(node);
    }
  });
  
  // Create sections for each node type
  const types = [
    { key: 'topic', label: 'Themes', className: 'theme-item' },
    { key: 'document', label: 'Goals', className: 'goal-item' },
    { key: 'strategy', label: 'Strategies', className: 'strategy-item' }
  ];
  
  types.forEach(type => {
    const nodes = groupedNodes[type.key];
    
    if (nodes.length > 0) {
      // Create section for this node type
      const section = document.createElement('div');
      section.className = 'node-info-section';
      
      const sectionTitle = document.createElement('h3');
      sectionTitle.textContent = type.label;
      section.appendChild(sectionTitle);
      
      // Create list of nodes
      const nodesList = document.createElement('ul');
      nodesList.className = 'hierarchy-list';
      
      nodes.forEach(node => {
        const item = document.createElement('li');
        item.className = type.className;
        
        const link = document.createElement('a');
        link.textContent = node.label;
        link.href = '#';
        link.onclick = (e) => {
          e.preventDefault();
          // The focusOnNode will trigger displayNodeDetails which will add to our unified navigation
          focusOnNode(node.id);
        };
        
        item.appendChild(link);
        
        // Add text excerpt showing the keyword in context
        let excerptText = '';
        if (node.text) {
          excerptText = extractExcerptWithKeyword(node.text, keyword);
        } else if (node.content) {
          excerptText = extractExcerptWithKeyword(node.content, keyword);
        } else if (node.description || node.overview) {
          excerptText = extractExcerptWithKeyword(node.description || node.overview, keyword);
        }
        
        if (excerptText) {
          const excerpt = document.createElement('div');
          excerpt.className = 'keyword-excerpt';
          excerpt.innerHTML = excerptText;
          item.appendChild(excerpt);
        }
        
        nodesList.appendChild(item);
      });
      
      section.appendChild(nodesList);
      contentContainer.appendChild(section);
    }
  });
  
  // If no nodes were found, show a message
  if (filteredNodes.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-connections';
    emptyMessage.textContent = `No nodes found containing "${keyword}"`;
    contentContainer.appendChild(emptyMessage);
  } else {
    // Add summary text
    const summary = document.createElement('p');
    summary.className = 'filter-summary';
    summary.textContent = `Found ${filteredNodes.length} nodes containing "${keyword}"`;
    contentContainer.insertBefore(summary, contentContainer.children[1]);
  }
}

/**
 * Extract a text excerpt that contains the keyword, highlighting the keyword
 * @param {string} text - The full text to extract from
 * @param {string} keyword - The keyword to highlight
 * @param {number} contextWords - Number of words to include before and after the keyword
 * @returns {string} HTML string with the excerpt and highlighted keyword
 */
export function extractExcerptWithKeyword(text, keyword, contextWords = 8) {
  if (!text || typeof text !== 'string') return '';
  
  // Case insensitive search with word boundaries
  const lowerText = text.toLowerCase();
  const lowerKeyword = keyword.toLowerCase();
  
  // Find the keyword with word boundaries if possible
  const wordBoundaryRegex = new RegExp(`\\b${lowerKeyword}\\b`, 'i');
  const match = text.match(wordBoundaryRegex);
  
  // If no word boundary match, fall back to simple indexOf
  let keywordIndex;
  let matchedKeyword;
  
  if (match && match.index !== undefined) {
    keywordIndex = match.index;
    matchedKeyword = match[0]; // The actual matched text with correct case
  } else {
    keywordIndex = lowerText.indexOf(lowerKeyword);
    // If still not found, give up
    if (keywordIndex === -1) return '';
    matchedKeyword = text.substring(keywordIndex, keywordIndex + lowerKeyword.length);
  }
  
  // Split the text into words
  const words = text.split(/\s+/);
  const allText = words.join(' '); // Normalize spaces
  
  // Find which word contains our keyword
  let charCount = 0;
  let keywordWordIndex = -1;
  
  for (let i = 0; i < words.length; i++) {
    const nextCharCount = charCount + words[i].length + (i > 0 ? 1 : 0); // +1 for space
    
    if (keywordIndex >= charCount && keywordIndex < nextCharCount) {
      keywordWordIndex = i;
      break;
    }
    
    charCount = nextCharCount;
  }
  
  if (keywordWordIndex === -1) return ''; // Couldn't find the word somehow
  
  // Determine start and end word indices for the excerpt
  const startWordIndex = Math.max(0, keywordWordIndex - contextWords);
  const endWordIndex = Math.min(words.length, keywordWordIndex + contextWords + 1);
  
  // Extract the relevant words
  const excerptWords = words.slice(startWordIndex, endWordIndex);
  
  // Add ellipsis indicators
  let excerpt = excerptWords.join(' ');
  if (startWordIndex > 0) excerpt = '... ' + excerpt;
  if (endWordIndex < words.length) excerpt = excerpt + ' ...';
  
  // Escape HTML to prevent XSS
  excerpt = excerpt
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Find the keyword in the escaped excerpt to highlight it
  // We need to find where it is in the excerpt, not the original text
  const excerptLower = excerpt.toLowerCase();
  const escapedKeywordLower = matchedKeyword.toLowerCase()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
  
  // Look for the keyword with word boundaries in the escaped excerpt
  const excerptKeywordMatch = new RegExp(`\\b${escapedKeywordLower}\\b`, 'i');
  const excerptMatch = excerptLower.match(excerptKeywordMatch);
  
  // If we can't find it with word boundaries, look for it without them
  let excerptKeywordIndex;
  if (excerptMatch && excerptMatch.index !== undefined) {
    excerptKeywordIndex = excerptMatch.index;
  } else {
    excerptKeywordIndex = excerptLower.indexOf(escapedKeywordLower);
    if (excerptKeywordIndex === -1) {
      // If still can't find, just return the escaped excerpt without highlighting
      return excerpt;
    }
  }
  
  // Get the original case version of the keyword from the excerpt
  const excerptKeyword = excerpt.substring(
    excerptKeywordIndex, 
    excerptKeywordIndex + escapedKeywordLower.length
  );
  
  // Insert the span tags around the keyword
  const beforeKeyword = excerpt.substring(0, excerptKeywordIndex);
  const afterKeyword = excerpt.substring(excerptKeywordIndex + excerptKeyword.length);
  
  return beforeKeyword + 
         '<span class="keyword-highlight">' + excerptKeyword + '</span>' + 
         afterKeyword;
}