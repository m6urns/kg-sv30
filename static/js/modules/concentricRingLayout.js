// concentricRingLayout.js
import { getNodeLevel } from './utils.js';

/**
 * Configuration for concentric ring layout
 */
export const ringConfig = {
  // Define radii for each level (as percentage of container)
  levels: {
    primary: 2.0,    // Theme nodes at 95% of container
    secondary: 1.75,  // Goal nodes at 85% of container
    tertiary: 1.50    // Strategy nodes at 50% of container
  },
  // Angular positioning spacing for nodes in the same theme
  angleSpacing: {
    primary: 40,      // Degrees of minimum spacing between themes (increased)
    secondary: 12,    // Degrees of minimum spacing between goals in same theme
    tertiary: 4       // Degrees of minimum spacing between strategies in same goal
  },
  // Snap back behavior
  snapBack: {
    enabled: false,
    strength: 0.7
  },
  // Ring constraint strength
  ringConstraint: {
    strength: 0.98    // Increased strength to enforce ring positioning
  },
  // Theme separation force
  themeSeparation: {
    enabled: true,    // Enable separation force between themes
    strength: 0.6     // Increased strength to prevent theme mixing
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
    
    // First, assign theme information to all nodes
    // This ensures every node knows which theme it belongs to
    nodes.forEach(node => {
      const level = getNodeLevel(node);
      if (level === 'primary') {
        // Theme nodes - already know their theme
        const themeIndex = themes.findIndex(t => t.id === node.id);
        node.themeId = node.id;
        node.themeAngle = themeAngles[themeIndex].center;
        node.themeAngleRange = themeAngles[themeIndex];
      } else {
        // For goals and strategies, find their theme
        for (const themeId in themeHierarchy) {
          const { theme, goals, strategies } = themeHierarchy[themeId];
          
          if (level === 'secondary' && goals.some(g => g.id === node.id)) {
            // It's a goal in this theme
            node.themeId = theme.id;
            const themeIndex = themes.findIndex(t => t.id === theme.id);
            node.themeAngle = themeAngles[themeIndex].center;
            node.themeAngleRange = themeAngles[themeIndex];
            break;
          } else if (level === 'tertiary') {
            // Check if it's a strategy in any goal of this theme
            let found = false;
            for (const goalId in strategies) {
              if (strategies[goalId].some(s => s.id === node.id)) {
                node.themeId = theme.id;
                const themeIndex = themes.findIndex(t => t.id === theme.id);
                node.themeAngle = themeAngles[themeIndex].center;
                node.themeAngleRange = themeAngles[themeIndex];
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
      }
    });
    
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
        const hierarchyInfo = findNodeHierarchyInfo(node, themeHierarchy, themeAngles, themes);
        if (hierarchyInfo.theme) {
          const { theme, position, totalSiblings, parentAngleRange, themeCenter } = hierarchyInfo;
          
          // Use the exact angle calculated from hierarchy
          const nodeAngle = parentAngleRange.center;
          
          // Store target position for snap-back
          node.targetX = center.x + ringRadius * Math.cos(nodeAngle);
          node.targetY = center.y + ringRadius * Math.sin(nodeAngle);
          node.angle = nodeAngle;
          node.ringRadius = ringRadius;
          node.parentTheme = theme.id;
          node.themeCenter = themeCenter; // Store theme center angle for constraints
          
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
        // Strict adherence to theme's angular range
        const themeAngleWidth = parentAngleRange.end - parentAngleRange.start;
        
        // Calculate this goal's position within the theme
        // Each goal gets an equal portion of the theme's angular sector
        let goalStart, goalEnd;
        
        if (goals.length === 1) {
          // If there's only one goal, place it at the center of the theme's sector
          goalStart = parentAngleRange.start;
          goalEnd = parentAngleRange.end;
        } else {
          // Divide theme sector equally among goals
          const goalAngleStep = themeAngleWidth / goals.length;
          goalStart = parentAngleRange.start + (index * goalAngleStep);
          goalEnd = goalStart + goalAngleStep;
        }
        
        // Center position for this goal
        const goalCenter = (goalStart + goalEnd) / 2;
        
        return { 
          theme, 
          position: index, 
          totalSiblings: goals.length,
          themeCenter: parentAngleRange.center, // Store theme center for constraint use
          parentAngleRange: {
            start: goalStart,
            end: goalEnd,
            center: goalCenter
          } 
        };
      }
    } else if (getNodeLevel(node) === 'tertiary') {
      // Find which goal this strategy belongs to
      let goalId = null;
      let strategyIndex = -1;
      
      for (const gId in strategies) {
        const strats = strategies[gId];
        const index = strats.findIndex(s => s.id === node.id);
        if (index >= 0) {
          goalId = gId;
          strategyIndex = index;
          break;
        }
      }
      
      if (goalId) {
        // Find the parent goal
        const goalIndex = goals.findIndex(g => g.id === goalId);
        if (goalIndex >= 0) {
          const parentGoal = goals[goalIndex];
          const goalStrategies = strategies[goalId];
          
          // Calculate the goal's angular position
          const themeAngleWidth = parentAngleRange.end - parentAngleRange.start;
          let goalStart, goalEnd;
          
          if (goals.length === 1) {
            // If only one goal, it spans the entire theme sector
            goalStart = parentAngleRange.start;
            goalEnd = parentAngleRange.end;
          } else {
            // Each goal gets an equal slice of the theme sector
            const goalAngleStep = themeAngleWidth / goals.length;
            goalStart = parentAngleRange.start + (goalIndex * goalAngleStep);
            goalEnd = goalStart + goalAngleStep;
          }
          
          // Calculate strategy position within goal sector
          let stratStart, stratEnd;
          
          if (goalStrategies.length === 1) {
            // If only one strategy, place at center of goal's angular sector
            stratStart = goalStart;
            stratEnd = goalEnd;
          } else {
            // Divide goal sector among strategies
            const stratAngleStep = (goalEnd - goalStart) / goalStrategies.length;
            stratStart = goalStart + (strategyIndex * stratAngleStep);
            stratEnd = stratStart + stratAngleStep;
          }
          
          const stratCenter = (stratStart + stratEnd) / 2;
          
          return { 
            theme, 
            position: strategyIndex, 
            totalSiblings: goalStrategies.length,
            parentGoal: parentGoal,
            themeCenter: parentAngleRange.center, // Store theme center
            parentAngleRange: {
              start: stratStart,
              end: stratEnd,
              center: stratCenter
            } 
          };
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
    
    // Start from the top (negative y-axis, PI * 3/2) rather than right (positive x-axis, 0)
    const startAngle = Math.PI * 1.5;
    
    for (let i = 0; i < themeCount; i++) {
      // Distribute evenly around the circle starting from the top
      const baseAngle = startAngle + (i * angleStep);
      
      // Ensure angle is between 0 and 2π
      const normalizedAngle = baseAngle % fullCircle;
      
      // Define minimum gap between themes
      const minGap = (ringConfig.angleSpacing.primary * Math.PI) / 180;
      
      angles.push({
        center: normalizedAngle,
        start: normalizedAngle - (angleStep / 2) + minGap,
        end: normalizedAngle + (angleStep / 2) - minGap
      });
    }
    
    return angles;
  }

/**
 * Create a force that keeps nodes confined to their rings and theme sectors
 * @param {number} centerX - Center X coordinate
 * @param {number} centerY - Center Y coordinate
 * @returns {Function} - Force function
 */
export function forceRingConstraint(centerX, centerY) {
  let nodes;
  
  // Helper function to normalize angle to [0, 2π]
  function normalizeAngle(angle) {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
  }
  
  // Helper function to check if an angle is within a sector
  function isAngleInSector(angle, sectorStart, sectorEnd) {
    angle = normalizeAngle(angle);
    sectorStart = normalizeAngle(sectorStart);
    sectorEnd = normalizeAngle(sectorEnd);
    
    // Handle the case where the sector crosses the 0/2π boundary
    if (sectorStart > sectorEnd) {
      return angle >= sectorStart || angle <= sectorEnd;
    }
    
    return angle >= sectorStart && angle <= sectorEnd;
  }
  
  function force(alpha) {
    nodes.forEach(node => {
      if (node.ringRadius === undefined) return;
      
      // Calculate current distance from center and angle
      const dx = node.x - centerX;
      const dy = node.y - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const currentAngle = Math.atan2(dy, dx);
      
      // Get theme sector constraints if available
      let targetAngle = currentAngle;
      const level = getNodeLevel(node);
      
      // First, constrain to ring radius
      if (Math.abs(distance - node.ringRadius) > 1) {
        // Calculate position on ring at current angle
        const targetX = centerX + node.ringRadius * Math.cos(currentAngle);
        const targetY = centerY + node.ringRadius * Math.sin(currentAngle);
        
        // Apply force toward ring position
        node.vx += (targetX - node.x) * alpha * ringConfig.ringConstraint.strength;
        node.vy += (targetY - node.y) * alpha * ringConfig.ringConstraint.strength;
      }
      
      // For all nodes, enforce angular constraints based on theme
      if (node.themeAngleRange) {
        const sectorStart = node.themeAngleRange.start;
        const sectorEnd = node.themeAngleRange.end;
        const sectorCenter = node.themeAngleRange.center;
        
        // Check if node is outside its theme sector
        if (!isAngleInSector(currentAngle, sectorStart, sectorEnd)) {
          // Apply a force to pull node back into its sector
          // Use the sector's center angle as a target
          targetAngle = sectorCenter;
            
          // Calculate position on ring at target angle
          const targetX = centerX + node.ringRadius * Math.cos(targetAngle);
          const targetY = centerY + node.ringRadius * Math.sin(targetAngle);
          
          // Apply stronger force to keep node within its theme sector
          const sectorConstraintStrength = level === 'primary' ? 1.5 : 1.2;
          node.vx += (targetX - node.x) * alpha * sectorConstraintStrength;
          node.vy += (targetY - node.y) * alpha * sectorConstraintStrength;
        }
      }
      
      // For theme nodes, add an even stronger force to maintain exact angular position
      if (level === 'primary' && node.angle !== undefined) {
        // Primary theme nodes should stay exactly at their assigned positions
        const targetX = centerX + node.ringRadius * Math.cos(node.angle);
        const targetY = centerY + node.ringRadius * Math.sin(node.angle);
        
        // Apply stronger force for primary nodes
        node.vx += (targetX - node.x) * alpha * 1.8;
        node.vy += (targetY - node.y) * alpha * 1.8;
      }
      
      // For child nodes, add a force to keep them near their theme's center angle
      else if ((level === 'secondary' || level === 'tertiary') && node.themeCenter !== undefined) {
        // Calculate an angular force toward the theme center
        // This helps keep hierarchies organized around their themes
        const angularForce = 0.1; // Gentle pull toward theme center
        
        // Calculate a point slightly biased toward the theme center
        const biasAngle = currentAngle + angularForce * (node.themeCenter - currentAngle);
        const biasX = centerX + node.ringRadius * Math.cos(biasAngle);
        const biasY = centerY + node.ringRadius * Math.sin(biasAngle);
        
        // Apply a gentle force in that direction
        node.vx += (biasX - node.x) * alpha * 0.2;
        node.vy += (biasY - node.y) * alpha * 0.2;
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
 * Create a force that maintains separation between theme tree clusters
 * @param {Object} layoutData - Layout data from computeConcentricLayout
 * @returns {Function} - Force function
 */
export function forceThemeSeparation(layoutData) {
  let nodes;
  
  // Helper function to normalize angle to [0, 2π]
  function normalizeAngle(angle) {
    while (angle < 0) angle += Math.PI * 2;
    while (angle >= Math.PI * 2) angle -= Math.PI * 2;
    return angle;
  }
  
  // Helper to calculate angular distance
  function angularDistance(angle1, angle2) {
    angle1 = normalizeAngle(angle1);
    angle2 = normalizeAngle(angle2);
    
    let diff = Math.abs(angle1 - angle2);
    if (diff > Math.PI) {
      diff = 2 * Math.PI - diff;
    }
    return diff;
  }
  
  function force(alpha) {
    if (!ringConfig.themeSeparation.enabled) return;
    
    // Group all nodes by their theme
    const nodesByTheme = {};
    
    nodes.forEach(node => {
      const themeId = node.themeId || node.parentTheme;
      if (themeId) {
        if (!nodesByTheme[themeId]) {
          nodesByTheme[themeId] = [];
        }
        nodesByTheme[themeId].push(node);
      }
    });
    
    // For each theme, compare with every other theme
    const themeIds = Object.keys(nodesByTheme);
    
    for (let i = 0; i < themeIds.length; i++) {
      const themeIdA = themeIds[i];
      const themeNodesA = nodesByTheme[themeIdA];
      
      // Find the theme node (primary level)
      const themeNodeA = themeNodesA.find(n => getNodeLevel(n) === 'primary');
      if (!themeNodeA) continue;
      
      for (let j = i + 1; j < themeIds.length; j++) {
        const themeIdB = themeIds[j];
        const themeNodesB = nodesByTheme[themeIdB];
        
        // Find the other theme node
        const themeNodeB = themeNodesB.find(n => getNodeLevel(n) === 'primary');
        if (!themeNodeB) continue;
        
        // Measure angular distance between themes
        const angleA = Math.atan2(
          themeNodeA.y - layoutData.center.y,
          themeNodeA.x - layoutData.center.x
        );
        
        const angleB = Math.atan2(
          themeNodeB.y - layoutData.center.y,
          themeNodeB.x - layoutData.center.x
        );
        
        const angDist = angularDistance(angleA, angleB);
        
        // If theme angular distance is less than minimum, apply separation force
        const minSeparation = (ringConfig.angleSpacing.primary * Math.PI) / 180;
        if (angDist < minSeparation) {
          // Determine which direction to push each theme
          let pushAngleA, pushAngleB;
          
          // Calculate angular direction to push themes apart
          // This needs to account for the circle's topology
          const clockwiseDist = normalizeAngle(angleB - angleA);
          const counterClockwiseDist = normalizeAngle(angleA - angleB);
          
          if (clockwiseDist < counterClockwiseDist) {
            // B is clockwise from A, so push A counter-clockwise and B clockwise
            pushAngleA = normalizeAngle(angleA - Math.PI/2);
            pushAngleB = normalizeAngle(angleB + Math.PI/2);
          } else {
            // A is clockwise from B, so push A clockwise and B counter-clockwise
            pushAngleA = normalizeAngle(angleA + Math.PI/2);
            pushAngleB = normalizeAngle(angleB - Math.PI/2);
          }
          
          // Calculate force magnitude - stronger when themes are closer
          const forceMagnitude = (minSeparation - angDist) / minSeparation;
          const pushStrength = ringConfig.themeSeparation.strength * alpha * forceMagnitude * 5;
          
          // Apply force to all nodes in theme A
          themeNodesA.forEach(node => {
            // Scale force by node level (stronger for primary nodes)
            let nodeStrength = pushStrength;
            if (getNodeLevel(node) === 'primary') nodeStrength *= 1.5;
            else if (getNodeLevel(node) === 'secondary') nodeStrength *= 1.0;
            else nodeStrength *= 0.8;
            
            node.vx += Math.cos(pushAngleA) * nodeStrength;
            node.vy += Math.sin(pushAngleA) * nodeStrength;
          });
          
          // Apply force to all nodes in theme B
          themeNodesB.forEach(node => {
            // Scale force by node level
            let nodeStrength = pushStrength;
            if (getNodeLevel(node) === 'primary') nodeStrength *= 1.5;
            else if (getNodeLevel(node) === 'secondary') nodeStrength *= 1.0;
            else nodeStrength *= 0.8;
            
            node.vx += Math.cos(pushAngleB) * nodeStrength;
            node.vy += Math.sin(pushAngleB) * nodeStrength;
          });
        }
        
        // Add direct node-to-node repulsion between different themes
        // This helps prevent individual nodes from crossing theme boundaries
        const secondaryTertiaryRepulsion = 0.8; // Strength of repulsion
        const maxRepulsionDist = layoutData.radius * 0.3; // Only apply to nearby nodes
        
        // Check each pair of nodes from different themes and apply repulsion
        if (angDist < Math.PI/2) { // Only apply to themes that are somewhat close
          // Secondary and tertiary nodes of theme A vs theme B
          themeNodesA.forEach(nodeA => {
            // Skip theme nodes - they're handled by the above angular force
            if (getNodeLevel(nodeA) === 'primary') return;
            
            themeNodesB.forEach(nodeB => {
              if (getNodeLevel(nodeB) === 'primary') return;
              
              // Calculate direct distance between nodes
              const dx = nodeB.x - nodeA.x;
              const dy = nodeB.y - nodeA.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              // Only apply repulsion to nodes that are close enough
              if (distance < maxRepulsionDist && distance > 0) {
                // Normalize direction vector
                const nx = dx / distance;
                const ny = dy / distance;
                
                // Calculate repulsion force (stronger when closer)
                const repulsionForce = (1 - distance / maxRepulsionDist) * secondaryTertiaryRepulsion * alpha;
                
                // Apply repulsion
                nodeA.vx -= nx * repulsionForce;
                nodeA.vy -= ny * repulsionForce;
                nodeB.vx += nx * repulsionForce;
                nodeB.vy += ny * repulsionForce;
              }
            });
          });
        }
      }
    }
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
    // Use a minimal alpha target to prevent graph destabilization
    if (!event.active) simulation.alphaTarget(0.05).alphaDecay(0.1).restart();
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
    
    // Stop all velocity
    node.vx = 0;
    node.vy = 0;
    
    // Fix node in position while dragging
    node.fx = node.x;
    node.fy = node.y;
    
    // Use minimal alpha to limit movement of other nodes
    simulation.alpha(0.01).velocityDecay(0.8);
    
    // Fix positions of nodes in the same theme to minimize movement
    if (node.themeId) {
      const themeId = node.themeId;
      simulation.nodes().forEach(n => {
        if (n.themeId === themeId || n.parentTheme === themeId) {
          // Dampen velocity of theme-related nodes
          n.vx *= 0.5;
          n.vy *= 0.5;
        }
      });
    }
  }
  
  function dragended(event) {
    // Immediately set alpha target to 0 to stop the simulation
    if (!event.active) simulation.alphaTarget(0);
    const node = event.subject;
    
    // Let node snap back by removing drag state
    node.dragging = false;
    node.fx = null;
    node.fy = null;
    
    // Use a minimal alpha for almost no movement after drag
    simulation.alpha(0.02).alphaDecay(0.2).velocityDecay(0.8).restart();
    
    // Quickly cool down the simulation
    setTimeout(() => {
      simulation.alpha(0).stop();
    }, 300);
  }
  
  return d3.drag()
    .on('start', dragstarted)
    .on('drag', dragged)
    .on('end', dragended);
}