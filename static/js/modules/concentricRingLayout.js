// concentricRingLayout.js
import { getNodeLevel } from './utils.js';

/**
 * Configuration for concentric ring layout
 */
export const ringConfig = {
  // Define radii for each level (as percentage of container)
  levels: {
    primary: 0.95,    // Theme nodes at 95% of container (was 0.9)
    secondary: 0.65,  // Goal nodes at 65% of container (was 0.6)
    tertiary: 0.35    // Strategy nodes at 35% of container (was 0.3)
  },
  // Angular positioning spacing for nodes in the same theme
  angleSpacing: {
    primary: 5,     // Degrees of minimum spacing between themes (was 30)
    secondary: 5,   // Degrees of minimum spacing between goals in same theme (was 5)
    tertiary: 1      // Degrees of minimum spacing between strategies in same goal (was 3)
  },
  // Snap back behavior
  snapBack: {
    enabled: false,
    strength: 0.5
  },
  // Ring constraint strength
  ringConstraint: {
    strength: 0.9
  }
};

/**
 * Pre-compute node positions for concentric ring layout
 * @param {Array} nodes - Array of node objects 
 * @param {Array} links - Array of link objects
 * @param {number} width - Container width
 * @param {number} height - Container height
 * @returns {Object} - Object with layout information
 */
export function computeConcentricLayout(nodes, links, width, height) {
    const center = { x: width / 2, y: height / 2 };
    const radius = Math.min(width, height) / 2 - 20;
    
    // Organize nodes by theme and level
    const themes = nodes.filter(n => getNodeLevel(n) === 'primary');
    const themeHierarchy = organizeThemeHierarchy(nodes, links);
    
    // Calculate angular sectors for each theme
    const themeAngles = assignThemeAngles(themes.length);
    
    // Position all nodes
    nodes.forEach(node => {
      const level = getNodeLevel(node);
      const ringRadius = radius * ringConfig.levels[level];
      
      if (level === 'primary') {
        // Theme nodes - evenly distributed around the circle
        const themeIndex = themes.findIndex(t => t.id === node.id);
        const angle = themeAngles[themeIndex].center;
        
        // Store target position for snap-back
        node.targetX = center.x + ringRadius * Math.cos(angle);
        node.targetY = center.y + ringRadius * Math.sin(angle);
        node.angle = angle;
        node.ringRadius = ringRadius;
        
        // Initialize position
        node.x = node.targetX;
        node.y = node.targetY;
        
        // Store theme information for child positioning
        node.angleRange = themeAngles[themeIndex];
      } else {
        // Goal and strategy nodes
        const { theme, position, totalSiblings, parentAngleRange } = findNodeHierarchyInfo(node, themeHierarchy, themeAngles, themes);
        if (theme) {
          // Distribute child nodes evenly within the theme's angular sector
          const angleRange = parentAngleRange.end - parentAngleRange.start;
          
          // Calculate angular position for this node
          let nodeAngle;
          if (totalSiblings === 1) {
            // If only one sibling, place in the center of the sector
            nodeAngle = (parentAngleRange.start + parentAngleRange.end) / 2;
          } else {
            // Distribute multiple siblings evenly within the sector
            const step = angleRange / (totalSiblings - 1);
            nodeAngle = parentAngleRange.start + step * position;
          }
          
          // Store target position for snap-back
          node.targetX = center.x + ringRadius * Math.cos(nodeAngle);
          node.targetY = center.y + ringRadius * Math.sin(nodeAngle);
          node.angle = nodeAngle;
          node.ringRadius = ringRadius;
          node.parentTheme = theme.id;
          
          // Initialize position
          node.x = node.targetX;
          node.y = node.targetY;
        }
      }
    });
    
    return {
      center,
      radius,
      themeAngles,
      themeHierarchy
    };
  }

/**
 * Organize nodes into a theme hierarchy
 * @param {Array} nodes - Array of node objects
 * @param {Array} links - Array of link objects
 * @returns {Object} - Theme hierarchy structure
 */
function organizeThemeHierarchy(nodes, links) {
  const hierarchy = {};
  
  // Get all theme nodes
  const themes = nodes.filter(n => getNodeLevel(n) === 'primary');
  
  themes.forEach(theme => {
    // Find goals connected to this theme
    const goals = links
      .filter(l => {
        const target = l.target.id ? l.target.id : l.target;
        const source = l.source.id ? l.source.id : l.source;
        return l.type === 'part_of_theme' && target === theme.id;
      })
      .map(l => {
        const sourceId = l.source.id ? l.source.id : l.source;
        return nodes.find(n => n.id === sourceId);
      })
      .filter(n => n); // Filter out undefined nodes
      
    // For each goal, find its strategies
    const goalStrategies = {};
    goals.forEach(goal => {
      const strategies = links
        .filter(l => {
          const target = l.target.id ? l.target.id : l.target;
          const source = l.source.id ? l.source.id : l.source;
          return l.type === 'part_of_goal' && target === goal.id;
        })
        .map(l => {
          const sourceId = l.source.id ? l.source.id : l.source;
          return nodes.find(n => n.id === sourceId);
        })
        .filter(n => n); // Filter out undefined nodes
      goalStrategies[goal.id] = strategies;
    });
    
    hierarchy[theme.id] = {
      theme,
      goals,
      strategies: goalStrategies
    };
  });
  
  return hierarchy;
}

/**
 * Find a node's position within its theme hierarchy
 * @param {Object} node - Node to find
 * @param {Object} hierarchy - Theme hierarchy structure
 * @param {Array} themeAngles - Angular sectors for themes
 * @param {Array} themes - Array of theme nodes
 * @returns {Object} - Node's hierarchical position info
 */
function findNodeHierarchyInfo(node, hierarchy, themeAngles, themes) {
  for (const themeId in hierarchy) {
    const { theme, goals, strategies } = hierarchy[themeId];
    const themeIndex = themes.findIndex(t => t.id === theme.id);
    const parentAngleRange = themeAngles[themeIndex];
    
    if (getNodeLevel(node) === 'secondary') {
      // Check if it's a goal in this theme
      const index = goals.findIndex(g => g.id === node.id);
      if (index >= 0) {
        return { theme, position: index, totalSiblings: goals.length, parentAngleRange };
      }
    } else if (getNodeLevel(node) === 'tertiary') {
      // Check if it's a strategy in this theme
      for (const goalId in strategies) {
        const index = strategies[goalId].findIndex(s => s.id === node.id);
        if (index >= 0) {
          const allStrategies = Object.values(strategies).flat();
          const absoluteIndex = allStrategies.findIndex(s => s.id === node.id);
          return { theme, position: absoluteIndex, totalSiblings: allStrategies.length, parentAngleRange };
        }
      }
    }
  }
  
  return { theme: null, position: 0, totalSiblings: 0, parentAngleRange: null };
}

/**
 * Assign angular sectors to each theme
 * @param {number} themeCount - Number of themes
 * @returns {Array} - Array of angular sectors for each theme
 */
function assignThemeAngles(themeCount) {
    const angles = [];
    const fullCircle = Math.PI * 2;
    const angleStep = fullCircle / themeCount;  // Equal division around the circle
    
    for (let i = 0; i < themeCount; i++) {
      const baseAngle = i * angleStep;
      
      // We don't need large gaps between themes
      const minGap = (ringConfig.angleSpacing.primary * Math.PI) / 180;
      
      angles.push({
        center: baseAngle,
        start: baseAngle - (angleStep / 2) + minGap,
        end: baseAngle + (angleStep / 2) - minGap
      });
    }
    
    return angles;
  }

/**
 * Create a force that keeps nodes confined to their rings
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @returns {Function} - Force function
 */
export function forceRingConstraint(centerX, centerY) {
  let nodes;
  
  function force(alpha) {
    nodes.forEach(node => {
      if (node.ringRadius === undefined) return;
      
      // Calculate current distance from center
      const dx = node.x - centerX;
      const dy = node.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);
      
      // Apply force to keep node on its ring
      if (distance !== node.ringRadius) {
        // Calculate position on ring at current angle
        const targetX = centerX + node.ringRadius * Math.cos(angle);
        const targetY = centerY + node.ringRadius * Math.sin(angle);
        
        // Apply force toward ring position with increased strength
        node.vx += (targetX - node.x) * alpha * ringConfig.ringConstraint.strength;
        node.vy += (targetY - node.y) * alpha * ringConfig.ringConstraint.strength;
      }
    });
  }
  
  force.initialize = function(_nodes) {
    nodes = _nodes;
  };
  
  return force;
}

/**
 * Create a force that makes nodes snap back to their original positions
 * @returns {Function} - Force function
 */
export function forceSnapBack() {
  let nodes;
  
  function force(alpha) {
    if (!ringConfig.snapBack.enabled) return;
    
    nodes.forEach(node => {
      if (node.targetX === undefined || node.targetY === undefined) return;
      
      // Only apply when node is not being dragged
      if (node.fx === null && node.fy === null) {
        // Apply force toward original position with increased strength
        node.vx += (node.targetX - node.x) * alpha * ringConfig.snapBack.strength;
        node.vy += (node.targetY - node.y) * alpha * ringConfig.snapBack.strength;
      }
    });
  }
  
  force.initialize = function(_nodes) {
    nodes = _nodes;
  };
  
  return force;
}

/**
 * Create constrained drag behavior for rings
 * @param {Object} simulation - D3 force simulation
 * @param {Object} layoutData - Layout data from computeConcentricLayout
 * @returns {Object} - D3 drag behavior
 */
export function createRingDragBehavior(simulation, layoutData) {
  function dragstarted(event) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    const node = event.subject;
    
    // Store original position for snap back
    node.originalX = node.x;
    node.originalY = node.y;
    node.dragging = true;
  }
  
  function dragged(event) {
    const node = event.subject;
    const center = layoutData.center;
    
    // Calculate angle from center for ring constraint
    const dx = event.x - center.x;
    const dy = event.y - center.y;
    const angle = Math.atan2(dy, dx);
    
    // Keep node on its ring
    const ringRadius = node.ringRadius || layoutData.radius;
    node.x = center.x + ringRadius * Math.cos(angle);
    node.y = center.y + ringRadius * Math.sin(angle);
    
    // Reset velocity
    node.vx = 0;
    node.vy = 0;
    
    // Fix position while dragging
    node.fx = node.x;
    node.fy = node.y;
  }
  
  function dragended(event) {
    if (!event.active) simulation.alphaTarget(0);
    const node = event.subject;
    
    // Let node snap back by removing drag state
    node.dragging = false;
    node.fx = null;
    node.fy = null;
    
    // Trigger snap back force
    simulation.alpha(0.5).restart();
  }
  
  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}