// Node interaction module for handling node highlighting and interactions
import { calculateNodeSize, getLinkColor, sanitizeString } from './utils.js';
import { fetchNodeDetails } from './dataService.js';

// Variables for tracking node interaction state
let _graphViz = null;
let _nodeViewHistory = [];
let _nodeForwardHistory = []; // For forward navigation
let _graphContainer = null;
let _focusModeEnabled = true; // Focus mode enabled by default

/**
 * Initialize the node interaction module
 * @param {Object} graphViz - The graph visualization object
 * @param {HTMLElement} graphContainer - The graph container element
 */
export function initializeNodeInteraction(graphViz, graphContainer) {
  _graphViz = graphViz;
  _graphContainer = graphContainer;
  _nodeViewHistory = [];
  _nodeForwardHistory = [];
  
  // Make the focusOnNode function accessible globally for the unified navigation
  window.focusOnNode = focusOnNode;
  
  // Store node interaction module for potential reference
  window.nodeInteraction = {
    focusOnNode: focusOnNode,
    navigateBack: navigateBack,
    navigateForward: navigateForward,
    highlightNode: highlightNode,
    highlightConnections: highlightConnections
  };
}

/**
 * Toggle focus mode on or off
 * @param {boolean} enabled - Whether focus mode should be enabled
 */
export function toggleFocusMode(enabled) {
  _focusModeEnabled = enabled;
  
  // If we have a selected node, update the focus
  if (_graphViz && _graphViz.toggleFocusMode) {
    const currentNodeId = _nodeViewHistory.length > 0 ? 
      _nodeViewHistory[_nodeViewHistory.length - 1] : null;
    
    _graphViz.toggleFocusMode(enabled, currentNodeId);
  }
  
  return _focusModeEnabled;
}

/**
 * Get current focus mode state
 * @returns {boolean} - True if focus mode is enabled
 */
export function isFocusModeEnabled() {
  return _focusModeEnabled;
}

/**
 * Focus on a node by ID
 * @param {string} nodeId - ID of the node to focus on
 * @param {boolean} fromNavigation - Whether this focus comes from navigation (back/forward)
 */
export function focusOnNode(nodeId, fromNavigation = false) {
  if (!_graphViz) return;
  
  // Find the node in the visualization
  const node = _graphViz.nodes.find(n => n.id === nodeId);
  if (!node) return;
  
  // Remove the clearing of forward history to preserve it for universal navigation
  // Previously: if (!fromNavigation) { _nodeForwardHistory = []; }
  
  // Highlight the node
  highlightNode(node);
  
  // Highlight connections for this node
  highlightConnections(node);
  
  // Apply focus mode if enabled
  if (_graphViz && _graphViz.toggleFocusMode && _focusModeEnabled) {
    _graphViz.toggleFocusMode(true, node.id);
  }
  
  // Center the view on this node
  const transform = d3.zoomIdentity
    .translate(_graphContainer.clientWidth / 2 - node.x, _graphContainer.clientHeight / 2 - node.y);
  
  _graphViz.svg.transition()
    .duration(750)
    .call(_graphViz.zoom.transform, transform);
  
  // Show node details
  showNodeDetails(node);
}

/**
 * Highlight a node in the visualization
 * @param {Object} node - The node to highlight
 */
export function highlightNode(node) {
  if (!_graphViz) return;
  
  // Reset all nodes
  _graphViz.nodeElements
    .attr('stroke-width', d => d.is_central ? 2 : 1.5)
    .attr('r', d => calculateNodeSize(d));
  
  // Highlight selected node
  _graphViz.nodeElements
    .filter(d => d.id === node.id)
    .attr('stroke-width', 3)
    .attr('r', d => calculateNodeSize(d) * 1.3);
}

/**
 * Highlight connections for a node
 * @param {Object} node - The node whose connections to highlight
 */
export function highlightConnections(node) {
  // Skip if graphViz is not initialized
  if (!_graphViz) return;
  
  // Reset all links to their original appearance
  _graphViz.linkElements
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', d => Math.sqrt(d.weight || 1) * 2)
    .attr('stroke', function(d) {
      // Use a direct fixed color if we have any issues with the dynamic color
      try {
        return getLinkColor(d, _graphViz.colorScale); 
      } catch (e) {
        // Fallback colors based on link type
        if (d.type === 'similar_content') return '#787878';
        return '#9ecae1';
      }
    })
    .attr('stroke-dasharray', null); // Clear any dashed lines
  
  // If the node is not a strategy, we're done
  if (node.type !== 'strategy') return;
  
  // Find all links connected to this strategy node
  const connectedLinks = _graphViz.linkElements.filter(d => {
    const sourceId = d.source.id || d.source;
    const targetId = d.target.id || d.target;
    return (sourceId === node.id || targetId === node.id);
  });
  
  // Apply more visible highlighting to connected links
  connectedLinks
    .attr('stroke', '#222222') // Darker gray
    // .attr('stroke-opacity', 1) // Fully opaque
    // .attr('stroke-width', d => (Math.sqrt(d.weight || 1) * 2) + 1.5); // Thicker lines
  
  // Find all similar_content links
  const similarityLinks = connectedLinks.filter(d => d.type === 'similar_content');
  
  // Apply special highlighting to similarity links
  similarityLinks
    // .attr('stroke', '#ff5500') // Bright orange for similarity links
    // .attr('stroke-dasharray', '5,3'); // Dashed line pattern
    .attr('stroke', '#222222') // Bright orange for similarity links
}

/**
 * Handle node click event
 * @param {Event} event - The click event
 * @param {Object} d - The clicked node data
 */
export function nodeClicked(event, d) {
  // Prevent default behavior to avoid any graph destabilization
  event.preventDefault();
  event.stopPropagation();
  
  // Show details panel with node information
  // This will update the unified navigation history through displayNodeDetails
  showNodeDetails(d);
  
  // Highlight this node
  highlightNode(d);
  
  // Highlight connections for this node
  highlightConnections(d);
  
  // Apply focus mode if enabled
  if (_graphViz && _graphViz.toggleFocusMode && _focusModeEnabled) {
    _graphViz.toggleFocusMode(true, d.id);
  }
  
  // If the graph has a simulation, completely stop it to prevent reorganization
  if (_graphViz && _graphViz.simulation) {
    // Stop the simulation entirely when clicking a node
    _graphViz.simulation.alpha(0).alphaTarget(0).stop();
  }
}

/**
 * Navigate back in node history (legacy function - should be handled by unified navigation)
 * Kept for backwards compatibility
 */
export function navigateBack() {
  // The new implementation will be handled by the universal navigation bar
  // but we keep this for compatibility with existing code
  if (_nodeViewHistory.length > 1) {
    // Get current node and add to forward history
    const currentNodeId = _nodeViewHistory[_nodeViewHistory.length - 1];
    _nodeForwardHistory.push(currentNodeId);
    
    // Remove current node from history
    _nodeViewHistory.pop();
    
    // Get previous node
    const previousNodeId = _nodeViewHistory[_nodeViewHistory.length - 1];
    
    // Remove it temporarily so it doesn't get added twice
    _nodeViewHistory.pop();
    
    // Focus on the node - this will add it back to history
    focusOnNode(previousNodeId, true);
  }
}

/**
 * Navigate forward in node history (legacy function - should be handled by unified navigation)
 * Kept for backwards compatibility
 */
export function navigateForward() {
  // The new implementation will be handled by the universal navigation bar
  // but we keep this for compatibility with existing code
  if (_nodeForwardHistory.length > 0) {
    // Get node from forward history
    const nextNodeId = _nodeForwardHistory.pop();
    
    // Focus on the node - this will add it to view history
    focusOnNode(nextNodeId, true);
  }
}

/**
 * Check if forward navigation is possible
 * @returns {boolean} - True if forward navigation is possible
 */
export function canNavigateForward() {
  return _nodeForwardHistory.length > 0;
}

/**
 * Show tooltip for a node
 * @param {Event} event - The mouseover event
 * @param {Object} d - The node data
 * @param {Object} tooltip - The D3 tooltip element
 */
export function showTooltip(event, d, tooltip) {
  // Using sanitizeString imported at the top of the file

  // Sanitize and decode labels and content
  const nodeLabel = sanitizeString(d.label || d.id);
  let content = `<strong>${nodeLabel}</strong><br/>`;
  
  if (d.type === 'topic') {
    // Process keywords - decode each one if needed
    const decodedKeywords = (d.keywords || []).map(k => sanitizeString(k)).join(', ');
    content += `<strong>Keywords:</strong> ${decodedKeywords}<br/>`;
    
    if (d.community_label) {
      content += `<strong>Cluster:</strong> ${sanitizeString(d.community_label)}<br/>`;
    }
    if (d.docs) {
      content += `<strong>Documents:</strong> ${d.docs.length}`;
    }
    if (d.is_central) {
      content += `<br/><em>Central topic in this cluster</em>`;
    }
  } else if (d.type === 'strategy') {
    // For strategy nodes, show a decoded/sanitized shortened version of the text
    const decodedText = sanitizeString(d.text || '');
    content += `${decodedText ? decodedText.substring(0, 100) + (decodedText.length > 100 ? '...' : '') : ''}`;
    
    // Add similarity connections count if available
    if (d.connections && d.connections.length > 0) {
      content += `<br/><em>Has ${d.connections.length} similar strategies</em>`;
    }
  } else {
    // For any other node type, decode the text for display
    const decodedText = sanitizeString(d.text || '');
    content += `${decodedText ? decodedText.substring(0, 100) + (decodedText.length > 100 ? '...' : '') : ''}`;
  }
  
  tooltip.transition()
    .duration(200)
    .style('opacity', .9);
  
  tooltip.html(content)
    .style('left', (event.pageX + 10) + 'px')
    .style('top', (event.pageY - 28) + 'px');
}

/**
 * Hide tooltip
 * @param {Object} tooltip - The D3 tooltip element
 */
export function hideTooltip(tooltip) {
  tooltip.transition()
    .duration(500)
    .style('opacity', 0);
}

/**
 * Fetch and display node details
 * @param {Object} node - The node to show details for
 */
export async function showNodeDetails(node) {
  try {
    const data = await fetchNodeDetails(node.id);
    
    // Pass data to UI component for rendering
    if (window.displayNodeDetails) {
      window.displayNodeDetails(data, _nodeViewHistory);
    }
  } catch (error) {
    console.error('Error fetching node details:', error);
  }
}

/**
 * Get the node view history
 * @returns {Array} - Array of node IDs in history
 */
export function getNodeViewHistory() {
  return _nodeViewHistory;
}

/**
 * Add a node to view history
 * @param {string} nodeId - ID of the node to add to history
 */
export function addToNodeViewHistory(nodeId) {
  if (_nodeViewHistory.length === 0 || _nodeViewHistory[_nodeViewHistory.length - 1] !== nodeId) {
    _nodeViewHistory.push(nodeId);
    
    // Limit history size
    if (_nodeViewHistory.length > 50) {
      _nodeViewHistory.shift();
    }
  }
  
  // Note: We're no longer clearing forward history to maintain consistency with
  // the unified navigation system. If someone clicks back and then clicks a new node,
  // they should still be able to navigate forward to where they were originally.
}