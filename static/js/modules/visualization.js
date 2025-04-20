// visualization.js
import { getNodeColor, getNodeLevel, calculateNodeSize } from './utils.js';
import { createDragBehavior } from './forceSimulation.js';
import { computeConcentricLayout, forceRingConstraint, forceSnapBack, forceThemeSeparation, createRingDragBehavior, ringConfig } from './concentricRingLayout.js';
import { nodeClicked, showTooltip, hideTooltip } from './nodeInteraction.js';

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
  });

  // Set initial alpha to a higher value for better positioning
  simulation.alpha(1).restart();

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
    layoutData: layoutData
  };
}