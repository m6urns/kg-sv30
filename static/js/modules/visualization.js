// visualization.js
import { getNodeColor, getNodeLevel, calculateNodeSize } from './utils.js';
import { createDragBehavior } from './forceSimulation.js';
import { computeConcentricLayout, forceRingConstraint, forceSnapBack, forceThemeSeparation, createRingDragBehavior, ringConfig } from './concentricRingLayout.js';
import { nodeClicked, showTooltip, hideTooltip } from './nodeInteraction.js';

// Track focus mode state
let focusModeEnabled = true; // Enabled by default

/**
 * Create a knowledge graph visualization
 * @param {Object} data - Graph data with nodes and links
 * @param {HTMLElement} container - The container to render the graph in
 * @returns {Object} - The graph visualization object
 */
export function createKnowledgeGraph(data, container) {
  // Clear existing SVG
  container.innerHTML = '';
  
  const width = container.clientWidth;
  const height = container.clientHeight || 600;
  
  // Create SVG container
  const svg = d3.select(container)
    .append('svg')
    .attr('width', width)
    .attr('height', height);
  
  const g = svg.append('g');
  
  // Set up zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 8])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });
  
  svg.call(zoom);
  
  // Set initial zoom level (50% zoom out = scale of 0.5)
  const initialScale = 0.6;
  const initialTransform = d3.zoomIdentity
    .translate(width/2, height/2)  // Move to center
    .scale(initialScale)           // Apply 50% zoom out
    .translate(-width/2, -height/2); // Move back by adjusted amount
    
  // Apply the initial transform
  svg.call(zoom.transform, initialTransform);
  
  // Create tooltip
  const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .style('opacity', 0);
  
  // Generate color scale for communities
  const communities = [...new Set(data.nodes
    .filter(d => d.community !== undefined)
    .map(d => d.community))];
  
  // Use a wider range of colors than the default d3.schemeCategory10
  const combinedColorScheme = [
    ...d3.schemeCategory10,       // 10 colors
    ...d3.schemePaired,           // 12 colors
    ...d3.schemeSet2,             // 8 colors
    ...d3.schemeSet3,             // 12 colors
    ...d3.schemeTableau10         // 10 colors
  ];
  
  // Create a color scale with the expanded color palette
  const colorScale = d3.scaleOrdinal()
    .domain(communities)
    .range(combinedColorScheme);

  // Define the local implementation of getLinkColor function right after colorScale
  const localGetLinkColor = function(d) {
    // For hierarchical links, use the parent's community color
    if (d.type === 'part_of_theme' || d.type === 'part_of_goal') {
      // For links from goals to themes or strategies to goals,
      // use the community color of the target node (parent)
      if (d.target && d.target.community !== undefined) {
        return colorScale(d.target.community);
      }
    }
    
    // For similar_content links, use a distinct color
    if (d.type === 'similar_content') return '#787878'; // Purple for similarity links
    
    // For related_to links between nodes in the same community, use community color
    if (d.source.community !== undefined && 
        d.target.community !== undefined && 
        d.source.community === d.target.community) {
      return colorScale(d.source.community);
    }
    
    // For links between different communities, use light blue
    return '#9ecae1';
  };

  // Compute concentric ring layout
  const layoutData = computeConcentricLayout(data.nodes, data.links, width, height);

  // Split links into hierarchical and non-hierarchical (informational) groups
  const hierarchicalLinks = data.links.filter(link => 
    link.type === 'part_of_theme' || link.type === 'part_of_goal'
  );
  
  const informationalLinks = data.links.filter(link => 
    link.type !== 'part_of_theme' && link.type !== 'part_of_goal'
  );
  
  const simulation = d3.forceSimulation(data.nodes)
    // Use only hierarchical links for primary layout force
    .force('hierarchicalLinks', d3.forceLink(hierarchicalLinks)
      .id(d => d.id)
      .distance(d => 100) // Consistent distance for tree structure
      .strength(0.9) // Stronger tree structure forces
    )
    // Add informational links with zero strength for layout (they'll still be displayed)
    .force('informationalLinks', d3.forceLink(informationalLinks)
      .id(d => d.id)
      .distance(200)
      .strength(0) // No force from these links - purely visual
    )
    .force('ringConstraint', forceRingConstraint(layoutData.center.x, layoutData.center.y))
    .force('themeSeparation', forceThemeSeparation(layoutData))
    .force('snapBack', forceSnapBack())
    .force('collision', d3.forceCollide()
      .radius(d => calculateNodeSize(d) + 20) // Increased collision radius for better separation
      .strength(0.9) // Stronger collision avoidance
    );
  
  // Draw link path function that curves for strategy links
  function linkPath(d) {
    const sourceLevel = getNodeLevel(d.source);
    const targetLevel = getNodeLevel(d.target);
    
    // For strategy-to-strategy links, create curved paths through center
    if (sourceLevel === 'tertiary' && targetLevel === 'tertiary' && d.type === 'similar_content') {
      // Get control points through center
      const sourceAngle = Math.atan2(d.source.y - layoutData.center.y, d.source.x - layoutData.center.x);
      const targetAngle = Math.atan2(d.target.y - layoutData.center.y, d.target.x - layoutData.center.x);
      
      // Control point at center with offset to create curve
      const controlRadius = layoutData.radius * 0.2; // 20% of radius
      const controlAngle = (sourceAngle + targetAngle) / 2;
      const controlX = layoutData.center.x + controlRadius * Math.cos(controlAngle);
      const controlY = layoutData.center.y + controlRadius * Math.sin(controlAngle);
      
      // Create quadratic Bezier curve
      return `M${d.source.x},${d.source.y}Q${controlX},${controlY} ${d.target.x},${d.target.y}`;
    }
    
    // Regular straight lines for hierarchical links
    return `M${d.source.x},${d.source.y}L${d.target.x},${d.target.y}`;
  }

  // Draw links as paths instead of lines
  const link = g.selectAll('.link')
    .data(data.links)
    .enter()
    .append('path')
    .attr('class', 'link')
    .attr('stroke-width', d => Math.sqrt(d.weight || 1) * 2)
    .attr('stroke', localGetLinkColor)
    .attr('fill', 'none');
  
  // Draw ring guides
  const rings = g.selectAll('.ring-guide')
    .data(['primary', 'secondary', 'tertiary'])
    .enter()
    .append('circle')
    .attr('class', 'ring-guide')
    .attr('cx', layoutData.center.x)
    .attr('cy', layoutData.center.y)
    .attr('r', d => layoutData.radius * ringConfig.levels[d])
    .attr('fill', 'none')
    .attr('stroke', '#ddd')
    .attr('stroke-dasharray', '5,5')
    .attr('opacity', 0.5);
  
  // Draw nodes
  const node = g.selectAll('.node')
    .data(data.nodes)
    .enter()
    .append('circle')
    .attr('class', d => `node ${d.is_central ? 'central-node' : ''}`)
    .attr('r', d => calculateNodeSize(d))
    .attr('fill', d => getNodeColor(d, colorScale))
    .call(createRingDragBehavior(simulation, layoutData))
    .on('mouseover', (event, d) => showTooltip(event, d, tooltip))
    .on('mouseout', () => hideTooltip(tooltip))
    .on('click', nodeClicked);
  
  // Add node labels
  const label = g.selectAll('.label')
    .data(data.nodes)
    .enter()
    .append('text')
    .attr('class', 'label')
    .text(d => d.label ? (d.label.length > 15 ? d.label.substring(0, 15) + '...' : d.label) : '')
    .attr('font-size', 10)
    .attr('dx', 12)
    .attr('dy', 4);
    
  // Create theme cluster labels for primary nodes
  // Group nodes by their community
  const communityGroups = {};
  data.nodes.forEach(node => {
    if (node.type === 'topic' && node.community !== undefined) {
      if (!communityGroups[node.community]) {
        communityGroups[node.community] = [];
      }
      communityGroups[node.community].push(node);
    }
  });
  
  // Create community label elements with initial positions
  const communityLabels = {};
  Object.entries(communityGroups).forEach(([communityId, nodes]) => {
    // Find the centroid position for this group
    let sumX = 0, sumY = 0;
    nodes.forEach(node => {
      sumX += node.x;
      sumY += node.y;
    });
    
    const avgX = sumX / nodes.length;
    const avgY = sumY / nodes.length;
    
    // Get community label from first node or use ID
    const labelText = nodes[0].community_label || `Cluster ${communityId}`;
    
    // Find an actual node for this community to use exact same color
    const primaryNode = nodes.find(n => n.type === 'topic');
    
    // Use the same node color determination as applied to the nodes
    let nodeColor;
    if (primaryNode) {
      // Check actual node on the graph that will be rendered with this color
      const primaryDOMNode = node.filter(d => d.id === primaryNode.id).node();
      if (primaryDOMNode) {
        // Get computed fill color from DOM node
        nodeColor = d3.select(primaryDOMNode).attr('fill');
      } else {
        // Fall back to function that's used to color nodes
        nodeColor = getNodeColor(primaryNode, colorScale);
      }
    } else {
      // Fallback to color scale directly if no primary node
      nodeColor = colorScale(communityId);
    }
    
    const labelElement = g.append('text')
      .attr('class', 'community-label')
      .attr('x', avgX)
      .attr('y', avgY - 25) // Positioned above the centroid
      .attr('text-anchor', 'middle')
      .attr('fill', nodeColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 0.7)
      .attr('opacity', 0.9)
      .text(labelText);
      
    // Store the label element and its nodes for updating
    communityLabels[communityId] = {
      element: labelElement,
      nodes: nodes
    };
  });
  
  // Update positions on simulation tick
  simulation.on('tick', () => {
    link
      .attr('d', linkPath);
    
    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);
    
    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);
    
    // Update community label positions based on node movement
    Object.values(communityLabels).forEach(community => {
      let sumX = 0, sumY = 0;
      community.nodes.forEach(node => {
        sumX += node.x;
        sumY += node.y;
      });
      
      const avgX = sumX / community.nodes.length;
      const avgY = sumY / community.nodes.length;
      
      community.element
        .attr('x', avgX)
        .attr('y', avgY - 25);
    });
  });

  // Set initial alpha to position nodes, with much faster cooldown
  simulation.alpha(1)
    .alphaDecay(0.03) // Much faster initial cooldown (default is 0.0228)
    .velocityDecay(0.6) // Much higher velocity dampening (default is 0.4)
    .restart();
    
  // After initial layout, cool down and stop the simulation
  setTimeout(() => {
    simulation.alpha(0.1).alphaDecay(0.1).restart();
    
    // After 2 seconds, stop the simulation entirely
    setTimeout(() => {
      simulation.alpha(0).stop();
    }, 2000);
  }, 3000);

  /**
   * Toggle focus mode which shows only selected node and its connected nodes with smarter hierarchy traversal
   * @param {boolean} enabled - Whether focus mode should be enabled
   * @param {string|null} focusNodeId - ID of the node to focus on (if null, no filtering is applied)
   */
  function toggleFocusMode(enabled, focusNodeId = null) {
    focusModeEnabled = enabled;
    
    if (!enabled) {
      // Show all nodes and links
      node.style('opacity', 1);
      link.style('opacity', 0.6);
      label.style('opacity', 1);
      return;
    }
    
    if (!focusNodeId) return;
    
    // Find the selected node
    const focusNode = data.nodes.find(n => n.id === focusNodeId);
    if (!focusNode) return;
    
    // Get node level (primary/secondary/tertiary)
    const focusNodeLevel = getNodeLevel(focusNode);
    
    // Find all nodes that should be visible based on connectivity and hierarchy
    const connectedNodeIds = new Set();
    connectedNodeIds.add(focusNodeId);
    
    // Helper function to get a node by its ID
    const getNodeById = (id) => data.nodes.find(n => n.id === id);
    
    // First pass: Find direct connections and mark them
    const firstHopNodeIds = new Set(); // Direct neighbors
    
    data.links.forEach(l => {
      const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
      const targetId = typeof l.target === 'object' ? l.target.id : l.target;
      
      if (sourceId === focusNodeId) {
        firstHopNodeIds.add(targetId);
        connectedNodeIds.add(targetId);
      } else if (targetId === focusNodeId) {
        firstHopNodeIds.add(sourceId);
        connectedNodeIds.add(sourceId);
      }
    });
    
    // Apply different filtering strategies based on node level
    if (focusNodeLevel === 'primary') {
      // For primary nodes (themes), show all connected goals and their strategies
      firstHopNodeIds.forEach(hopNodeId => {
        const hopNode = getNodeById(hopNodeId);
        if (!hopNode) return;
        
        // If this is a goal (secondary), also show its strategies
        if (getNodeLevel(hopNode) === 'secondary') {
          // Find strategies connected to this goal
          data.links.forEach(l => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            
            if ((sourceId === hopNodeId || targetId === hopNodeId) && l.type === 'part_of_goal') {
              const strategyId = sourceId === hopNodeId ? targetId : sourceId;
              const strategyNode = getNodeById(strategyId);
              
              if (strategyNode && getNodeLevel(strategyNode) === 'tertiary') {
                connectedNodeIds.add(strategyId);
              }
            }
          });
        }
      });
      
      // Also show other themes that have related strategies
      const connectedStrategies = new Set();
      
      // First, collect all strategies connected to this theme's goals
      data.links.forEach(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        
        // For each goal connected to this theme
        if ((sourceId === focusNodeId || targetId === focusNodeId) && l.type === 'part_of_theme') {
          const goalId = sourceId === focusNodeId ? targetId : sourceId;
          
          // Find all strategies for this goal
          data.links.forEach(stratLink => {
            const stratSourceId = typeof stratLink.source === 'object' ? stratLink.source.id : stratLink.source;
            const stratTargetId = typeof stratLink.target === 'object' ? stratLink.target.id : stratLink.target;
            
            if ((stratSourceId === goalId || stratTargetId === goalId) && stratLink.type === 'part_of_goal') {
              const strategyId = stratSourceId === goalId ? stratTargetId : stratSourceId;
              connectedStrategies.add(strategyId);
            }
          });
        }
      });
      
      // For each connected strategy, check for similar content links
      connectedStrategies.forEach(strategyId => {
        data.links.forEach(simLink => {
          const simSourceId = typeof simLink.source === 'object' ? simLink.source.id : simLink.source;
          const simTargetId = typeof simLink.target === 'object' ? simLink.target.id : simLink.target;
          
          if ((simSourceId === strategyId || simTargetId === strategyId) && simLink.type === 'similar_content') {
            // Get the other strategy in this similarity link
            const otherStrategyId = simSourceId === strategyId ? simTargetId : simSourceId;
            connectedNodeIds.add(otherStrategyId);
            
            // Find its goal and theme
            data.links.forEach(goalLink => {
              const goalSourceId = typeof goalLink.source === 'object' ? goalLink.source.id : goalLink.source;
              const goalTargetId = typeof goalLink.target === 'object' ? goalLink.target.id : goalLink.target;
              
              if ((goalSourceId === otherStrategyId || goalTargetId === otherStrategyId) && goalLink.type === 'part_of_goal') {
                const otherGoalId = goalSourceId === otherStrategyId ? goalTargetId : goalSourceId;
                connectedNodeIds.add(otherGoalId);
                
                // Find theme for this goal
                data.links.forEach(themeLink => {
                  const themeSourceId = typeof themeLink.source === 'object' ? themeLink.source.id : themeLink.source;
                  const themeTargetId = typeof themeLink.target === 'object' ? themeLink.target.id : themeLink.target;
                  
                  if ((themeSourceId === otherGoalId || themeTargetId === otherGoalId) && themeLink.type === 'part_of_theme') {
                    const otherThemeId = themeSourceId === otherGoalId ? themeTargetId : themeSourceId;
                    connectedNodeIds.add(otherThemeId);
                  }
                });
              }
            });
          }
        });
      });
    }
    else if (focusNodeLevel === 'secondary') {
      // For secondary nodes (goals), show connected theme and all strategies
      // Also show related goals from similar strategies
      
      // First, find the theme this goal belongs to
      firstHopNodeIds.forEach(hopNodeId => {
        const hopNode = getNodeById(hopNodeId);
        if (hopNode && getNodeLevel(hopNode) === 'primary') {
          // This is the theme, already added to connectedNodeIds
          
          // Now find all strategies for this goal (already in firstHopNodeIds)
          const strategies = Array.from(firstHopNodeIds).filter(id => {
            const node = getNodeById(id);
            return node && getNodeLevel(node) === 'tertiary';
          });
          
          // For each strategy, find similar strategies and their goals/themes
          strategies.forEach(strategyId => {
            data.links.forEach(simLink => {
              const simSourceId = typeof simLink.source === 'object' ? simLink.source.id : simLink.source;
              const simTargetId = typeof simLink.target === 'object' ? simLink.target.id : simLink.target;
              
              if ((simSourceId === strategyId || simTargetId === strategyId) && simLink.type === 'similar_content') {
                // Get the other strategy in this similarity link
                const otherStrategyId = simSourceId === strategyId ? simTargetId : simSourceId;
                connectedNodeIds.add(otherStrategyId);
                
                // Find its goal and theme
                data.links.forEach(goalLink => {
                  const goalSourceId = typeof goalLink.source === 'object' ? goalLink.source.id : goalLink.source;
                  const goalTargetId = typeof goalLink.target === 'object' ? goalLink.target.id : goalLink.target;
                  
                  if ((goalSourceId === otherStrategyId || goalTargetId === otherStrategyId) && goalLink.type === 'part_of_goal') {
                    const otherGoalId = goalSourceId === otherStrategyId ? goalTargetId : goalSourceId;
                    connectedNodeIds.add(otherGoalId);
                    
                    // Find theme for this goal
                    data.links.forEach(themeLink => {
                      const themeSourceId = typeof themeLink.source === 'object' ? themeLink.source.id : themeLink.source;
                      const themeTargetId = typeof themeLink.target === 'object' ? themeLink.target.id : themeLink.target;
                      
                      if ((themeSourceId === otherGoalId || themeTargetId === otherGoalId) && themeLink.type === 'part_of_theme') {
                        const otherThemeId = themeSourceId === otherGoalId ? themeTargetId : themeSourceId;
                        connectedNodeIds.add(otherThemeId);
                      }
                    });
                  }
                });
              }
            });
          });
        }
      });
    }
    else if (focusNodeLevel === 'tertiary') {
      // For tertiary nodes (strategies), show a simplified view:
      // - The selected strategy node
      // - Its direct parent goal and theme
      // - Directly similar strategies with their parent goals and themes
      
      // STEP 1: Find the direct parent goal and theme of the selected strategy
      let directGoalId = null;
      let directThemeId = null;
      
      // Find the parent goal
      firstHopNodeIds.forEach(hopNodeId => {
        const hopNode = getNodeById(hopNodeId);
        if (!hopNode) return;
        
        if (getNodeLevel(hopNode) === 'secondary') {
          directGoalId = hopNodeId;
          
          // Find theme of this goal
          data.links.forEach(l => {
            const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
            const targetId = typeof l.target === 'object' ? l.target.id : l.target;
            
            if ((sourceId === hopNodeId || targetId === hopNodeId) && l.type === 'part_of_theme') {
              const themeId = sourceId === hopNodeId ? targetId : sourceId;
              const themeNode = getNodeById(themeId);
              
              if (themeNode && getNodeLevel(themeNode) === 'primary') {
                directThemeId = themeId;
                connectedNodeIds.add(themeId);
              }
            }
          });
        }
      });
      
      // STEP 2: Find directly similar strategies and their parent goals and themes
      // Find all similar_content links for the focus node
      const similarStrategyLinks = data.links.filter(l => {
        const sourceId = typeof l.source === 'object' ? l.source.id : l.source;
        const targetId = typeof l.target === 'object' ? l.target.id : l.target;
        return (sourceId === focusNodeId || targetId === focusNodeId) && l.type === 'similar_content';
      });
      
      // For each directly similar strategy
      similarStrategyLinks.forEach(l => {
        // Get the other strategy node ID
        const similarStrategyId = typeof l.source === 'object' ? 
          (l.source.id === focusNodeId ? (typeof l.target === 'object' ? l.target.id : l.target) : l.source.id) :
          (l.source === focusNodeId ? (typeof l.target === 'object' ? l.target.id : l.target) : l.source);
        
        // Add the similar strategy to visible nodes
        connectedNodeIds.add(similarStrategyId);
        
        // Find its parent goal
        data.links.forEach(link => {
          const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
          const targetId = typeof link.target === 'object' ? link.target.id : link.target;
          
          if ((sourceId === similarStrategyId || targetId === similarStrategyId) && link.type === 'part_of_goal') {
            const goalId = sourceId === similarStrategyId ? targetId : sourceId;
            connectedNodeIds.add(goalId);
            
            // Find the theme connected to this goal
            data.links.forEach(goalLink => {
              const goalSourceId = typeof goalLink.source === 'object' ? goalLink.source.id : goalLink.source;
              const goalTargetId = typeof goalLink.target === 'object' ? goalLink.target.id : goalLink.target;
              
              if ((goalSourceId === goalId || goalTargetId === goalId) && goalLink.type === 'part_of_theme') {
                const themeId = goalSourceId === goalId ? goalTargetId : goalSourceId;
                connectedNodeIds.add(themeId);
              }
            });
          }
        });
      });
    }
    
    // Hide nodes that aren't in our connected set
    node.style('opacity', d => connectedNodeIds.has(d.id) ? 1 : 0.1);
    
    // Show links that connect any nodes in our visible set, with special rules
    link.style('opacity', d => {
      const sourceId = typeof d.source === 'object' ? d.source.id : d.source;
      const targetId = typeof d.target === 'object' ? d.target.id : d.target;
      const sourceNode = getNodeById(sourceId);
      const targetNode = getNodeById(targetId);
      
      // For tertiary nodes (strategies), be very specific about which links to show
      if (focusNodeLevel === 'tertiary') {
        // ONLY show these specific link types:
        
        // 1. Direct links from the selected strategy to its parent goal
        if ((sourceId === focusNodeId || targetId === focusNodeId) && 
            d.type === 'part_of_goal') {
          return 0.8;
        }
        
        // 2. Similarity links (orange dashed lines) from selected strategy to other strategies
        if ((sourceId === focusNodeId || targetId === focusNodeId) && 
            d.type === 'similar_content') {
          return 0.8;
        }
        
        // Find all similar strategies
        const similarStrategyIds = new Set();
        
        // Find all similarity links from the focus node
        data.links.forEach(l => {
          if (l.type !== 'similar_content') return;
          
          const simSourceId = typeof l.source === 'object' ? l.source.id : l.source;
          const simTargetId = typeof l.target === 'object' ? l.target.id : l.target;
          
          if (simSourceId === focusNodeId) {
            similarStrategyIds.add(simTargetId);
          } else if (simTargetId === focusNodeId) {
            similarStrategyIds.add(simSourceId);
          }
        });
        
        // Show links from similar strategies to their parent goals
        if (d.type === 'part_of_goal') {
          const linkSourceId = typeof d.source === 'object' ? d.source.id : d.source;
          const linkTargetId = typeof d.target === 'object' ? d.target.id : d.target;
          
          // If either end is a similar strategy, show this link
          if (similarStrategyIds.has(linkSourceId) || similarStrategyIds.has(linkTargetId)) {
            return 0.8;
          }
          
          // Also show the link from the focus node to its parent goal
          if (linkSourceId === focusNodeId || linkTargetId === focusNodeId) {
            return 0.8;
          }
        }
        
        // Find all goal IDs (both direct parent and parents of similar strategies)
        const goalIds = new Set();
        
        // First, add the direct parent goal of the focus node
        data.links.forEach(l => {
          if (l.type !== 'part_of_goal') return;
          
          const linkSourceId = typeof l.source === 'object' ? l.source.id : l.source;
          const linkTargetId = typeof l.target === 'object' ? l.target.id : l.target;
          
          // If this link connects to the focus node, add the goal ID
          if (linkSourceId === focusNodeId) {
            goalIds.add(linkTargetId);
          } else if (linkTargetId === focusNodeId) {
            goalIds.add(linkSourceId);
          }
          
          // For each similar strategy, add its parent goal too
          similarStrategyIds.forEach(stratId => {
            if (linkSourceId === stratId) {
              goalIds.add(linkTargetId);
            } else if (linkTargetId === stratId) {
              goalIds.add(linkSourceId);
            }
          });
        });
        
        // Show links from goals to their themes
        if (d.type === 'part_of_theme') {
          const linkSourceId = typeof d.source === 'object' ? d.source.id : d.source;
          const linkTargetId = typeof d.target === 'object' ? d.target.id : d.target;
          
          // If either end is one of our collected goals, show this link
          if (goalIds.has(linkSourceId) || goalIds.has(linkTargetId)) {
            return 0.8;
          }
        }
        
        // Show all similarity links
        if (d.type === 'similar_content') {
          const linkSourceId = typeof d.source === 'object' ? d.source.id : d.source;
          const linkTargetId = typeof d.target === 'object' ? d.target.id : d.target;
          
          // If the link involves the focus node or any similar strategy
          if (linkSourceId === focusNodeId || linkTargetId === focusNodeId) {
            return 0.8;
          }
        }
        
        // Hide ALL other links
        return 0.1;
      } 
      // Default behavior for other node levels
      else {
        // If both ends of the link are in the connected set, show it
        if (connectedNodeIds.has(sourceId) && connectedNodeIds.has(targetId)) {
          return 0.8;
        }
        
        // If one end is the focus node, always show it
        if (sourceId === focusNodeId || targetId === focusNodeId) {
          return 0.8;
        }
        
        return 0.1;
      }
    });
    
    // Hide labels for non-relevant nodes
    label.style('opacity', d => connectedNodeIds.has(d.id) ? 1 : 0);
  }

  // Return graph object with all required components
  return {
    simulation,
    svg,
    zoom,
    g,
    nodes: data.nodes,
    links: data.links,
    nodeElements: node,
    linkElements: link,
    labelElements: label,
    communities: communities,
    colorScale: colorScale,
    layoutData: layoutData,
    toggleFocusMode // Export the focus mode function
  };
}