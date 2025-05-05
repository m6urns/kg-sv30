// Utility functions for the Strategic Vision Navigator

/**
 * Calculate node size based on node type and properties
 * @param {Object} d - The node data object
 * @returns {number} - The calculated node size
 */
export function calculateNodeSize(d) {
  if (d.type === 'topic') {
    // Theme nodes (level 0)
    let size = 10 + (d.size || 1) / 2;
    if (size > 25) size = 25;
    if (d.is_central) size *= 1.5;
    return size;
  } else if (d.type === 'document') {
    // Goal nodes (level 1) - make these larger
    return 15; // Increase from the default value
  } else if (d.type === 'strategy') {
    // Strategy nodes (level 2)
    return 6; // Slightly larger than the default for better visibility
  }
  
  // Default for any other node types
  return 5;
}

/**
 * Debounce function to limit how often a function can be called
 * @param {Function} func - The function to debounce
 * @param {number} wait - The delay in milliseconds
 * @returns {Function} - The debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

/**
 * Get color for a link based on its type and connected nodes
 * @param {Object} d - The link data object
 * @param {Function} colorScale - D3 color scale function
 * @returns {string} - The color for the link
 */
export function getLinkColor(d, colorScale) {
  // For hierarchical links, use the parent's community color
  if (d.type === 'part_of_theme' || d.type === 'part_of_goal') {
    // For links from goals to themes or strategies to goals,
    // use the community color of the target node (parent)
    if (d.target && d.target.community !== undefined && colorScale) {
      return colorScale(d.target.community);
    }
  }
  
  // For similar_content links, use a distinct color
  if (d.type === 'similar_content') return '#787878'; // Purple for similarity links
  
  // For related_to links between nodes in the same community, use community color
  if (d.source && d.target && 
      d.source.community !== undefined && 
      d.target.community !== undefined && 
      d.source.community === d.target.community && 
      colorScale) {
    return colorScale(d.source.community);
  }
  
  // For links between different communities, use light blue
  return '#9ecae1';
}

/**
 * Get color for a node based on its community and type
 * @param {Object} d - The node data object
 * @param {Function} colorScale - D3 color scale function
 * @returns {string} - The color for the node
 */
export function getNodeColor(d, colorScale) {
  // All nodes should use their community color
  if (d.community !== undefined && colorScale) {
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

/**
 * Get level of a node (primary/secondary/tertiary)
 * @param {Object} node - The node data object
 * @returns {string} - The level name
 */
export function getNodeLevel(node) {
  if (node.level) {
    return node.level; // Use explicit level if available
  }
  // Fall back to depth
  if (node.depth === 0) return 'primary';
  if (node.depth === 1) return 'secondary';
  if (node.depth === 2) return 'tertiary';
  return 'other';
}

/**
 * Sanitize a string to prevent XSS attacks while properly displaying special characters
 * @param {string} str - The string to sanitize
 * @returns {string} - Sanitized string
 */
export function sanitizeString(str) {
  if (!str) return '';
  
  // Handle non-string inputs
  if (typeof str !== 'string') {
    str = String(str);
  }
  
  // First, decode HTML entities if present
  if (str.includes('&') && str.includes(';')) {
    // Create a temporary element in memory to decode entities
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<!DOCTYPE html><html><body>${str}</body></html>`, 'text/html');
    str = doc.body.textContent || '';
  }
  
  // Then sanitize with DOMPurify to ensure no XSS - strip all HTML tags
  return DOMPurify.sanitize(str, {
    ALLOWED_TAGS: [], // No HTML tags allowed
    ALLOWED_ATTR: [], // No attributes allowed
    KEEP_CONTENT: true // Keep the content of removed tags
  });
}