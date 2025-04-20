// forceSimulation.js
import { getNodeLevel } from './utils.js';

/**
 * Configuration for the force layout levels
 */
export const levelConfig = {
  // Main node repulsion strength by level
  chargeStrength: {
    primary: -100,     // Reduced for ring layout
    secondary: -75,    // Reduced for ring layout
    tertiary: -50      // Reduced for ring layout
  },
  // Additional repulsion between nodes of the same level
  levelRepulsionStrength: {
    primary: 1.0,      // Reduced for ring layout
    secondary: 0.8,    // Reduced for ring layout
    tertiary: 0.5      // Reduced for ring layout
  },
  // Maximum distance for level-specific repulsion to apply
  repulsionDistance: {
    primary: 100,      // Reduced for ring layout
    secondary: 75,     // Reduced for ring layout
    tertiary: 50       // Reduced for ring layout
  },
  // Radial positioning parameters - not used in ring layout
  radialPositioning: {
    enabled: false, // Disabled for ring layout
    primary: 0,
    secondary: 0,
    tertiary: 0
  }
};

/**
 * Creates a custom force for repelling nodes of the same level
 * @param {string} targetLevel - Level to apply repulsion to
 * @returns {Function} - Force function
 */
export function levelRepulsion(targetLevel) {
  let nodes;
  
  function force(alpha) {
    // Skip if no strength configured for this level
    if (!levelConfig.levelRepulsionStrength[targetLevel]) return;
    
    const strength = levelConfig.levelRepulsionStrength[targetLevel];
    const maxDistance = levelConfig.repulsionDistance[targetLevel] || 150;
    
    // Get only the nodes of the target level
    const levelNodes = nodes.filter(n => getNodeLevel(n) === targetLevel);
    
    // Apply repulsion between each pair of level nodes
    for (let i = 0; i < levelNodes.length; i++) {
      const nodeA = levelNodes[i];
      
      for (let j = i + 1; j < levelNodes.length; j++) {
        const nodeB = levelNodes[j];
        
        // Only apply repulsion if nodes are on the same ring
        if (nodeA.ringRadius !== nodeB.ringRadius) continue;
        
        // Calculate distance between nodes
        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Skip if nodes are too far apart (optimization)
        if (distance > maxDistance) continue;
        
        // Calculate repulsion force, stronger when closer
        const force = strength * alpha / Math.max(distance, 1);
        
        // Apply force
        nodeA.vx += dx * force;
        nodeA.vy += dy * force;
        nodeB.vx -= dx * force;
        nodeB.vy -= dy * force;
      }
    }
  }
  
  force.initialize = function(_nodes) {
    nodes = _nodes;
  };
  
  return force;
}

/**
 * Creates a force to cluster nodes by community
 * @param {number} strength - Clustering strength
 * @returns {Function} - Force function
 */
export function forceCluster(strength = 0.6) {
  // Disable for ring layout
  return function() {};
}

/**
 * Creates a force for repulsion between nodes in different communities
 * @param {number} strength - Repulsion strength
 * @returns {Function} - Force function
 */
export function interCommunityRepulsion(strength = 1.5) {
  // Disable for ring layout
  return function() {};
}

/**
 * Create a D3 drag behavior for the graph
 * @param {Object} simulation - D3 force simulation
 * @returns {Object} - D3 drag behavior
 */
export function createDragBehavior(simulation) {
  // This will be overridden by createRingDragBehavior for ring layout
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }
  
  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }
  
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    event.subject.fx = null;
    event.subject.fy = null;
  }
  
  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}