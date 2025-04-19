// Force simulation layout algorithms for the graph
import { getNodeLevel } from './utils.js';

/**
 * Configuration for the force layout levels
 */
export const levelConfig = {
  // Main node repulsion strength by level
  chargeStrength: {
    primary: -500,     // Even stronger repulsion for theme nodes
    secondary: -300,   // Stronger for goal nodes
    tertiary: -100     // Increased for strategy nodes to reduce bunching
  },
  // Additional repulsion between nodes of the same level
  levelRepulsionStrength: {
    primary: 2.0,      // Much stronger theme node repulsion
    secondary: 1.0,    // Increased goal node repulsion
    tertiary: 0.5      // Significantly increased strategy repulsion
  },
  // Maximum distance for level-specific repulsion to apply
  repulsionDistance: {
    primary: 600,      // Increased theme repulsion distance
    secondary: 400,    // Increased goal repulsion distance
    tertiary: 200      // Significantly increased strategy repulsion distance
  },
  // Radial positioning parameters - increased separation
  radialPositioning: {
    enabled: true,
    primary: 650,      // Themes positioned further out
    secondary: 400,    // Goals in a wider middle layer
    tertiary: 180      // Strategies spread out more in center
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
  let nodes;
  
  function force(alpha) {
    // For each node
    for (const node of nodes) {
      if (node.community === undefined) continue;
      
      // Find other nodes in same community
      const cluster = nodes.filter(n => n.community === node.community);
      if (cluster.length === 0) continue;
      
      // Calculate cluster center
      const clusterX = d3.mean(cluster, d => d.x);
      const clusterY = d3.mean(cluster, d => d.y);
      
      // Apply force toward cluster center
      node.vx += (clusterX - node.x) * alpha * strength;
      node.vy += (clusterY - node.y) * alpha * strength;
    }
  }
  
  force.initialize = function(_nodes) {
    nodes = _nodes;
  };
  
  return force;
}

/**
 * Creates a force for repulsion between nodes in different communities
 * @param {number} strength - Repulsion strength
 * @returns {Function} - Force function
 */
export function interCommunityRepulsion(strength = 1.5) {
  let nodes;
  
  function force(alpha) {
    // Loop through all pairs of nodes from different communities
    for (let i = 0; i < nodes.length; i++) {
      const nodeA = nodes[i];
      // Skip if node has no community
      if (nodeA.community === undefined) continue;
      
      for (let j = i + 1; j < nodes.length; j++) {
        const nodeB = nodes[j];
        // Skip if node has no community or is from the same community
        if (nodeB.community === undefined || nodeA.community === nodeB.community) continue;
        
        // Only apply strong repulsion to primary (theme) nodes
        let repulsionStrength = strength;
        if (getNodeLevel(nodeA) !== 'primary' || getNodeLevel(nodeB) !== 'primary') {
          repulsionStrength *= 0.3; // Much weaker repulsion for non-theme nodes
        }
        
        // Calculate distance between nodes
        const dx = nodeA.x - nodeB.x;
        const dy = nodeA.y - nodeB.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Skip if too far apart (optimization)
        if (distance > 800) continue;
        
        // Calculate repulsion force - stronger when nodes are from different communities
        const repulsion = repulsionStrength * alpha * Math.min(1.0, 800 / (distance * distance));
        
        // Apply force
        nodeA.vx += dx * repulsion;
        nodeA.vy += dy * repulsion;
        nodeB.vx -= dx * repulsion;
        nodeB.vy -= dy * repulsion;
      }
    }
  }
  
  force.initialize = function(_nodes) {
    nodes = _nodes;
  };
  
  return force;
}

/**
 * Create a D3 drag behavior for the graph
 * @param {Object} simulation - D3 force simulation
 * @returns {Object} - D3 drag behavior
 */
export function createDragBehavior(simulation) {
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