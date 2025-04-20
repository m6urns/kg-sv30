// Graph visualization module
import { getNodeColor, getNodeLevel, calculateNodeSize } from './utils.js';
import { forceCluster, interCommunityRepulsion, levelRepulsion, createDragBehavior, levelConfig } from './forceSimulation.js';
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
  // Combine multiple color schemes to get more distinct colors
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

  // Create the force simulation
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.links)
      .id(d => d.id)
      .distance(d => {
        // Adjust link distance based on the levels of connected nodes
        const sourceLevel = getNodeLevel(d.source);
        const targetLevel = getNodeLevel(d.target);
        
        // Hierarchical links (parent-child relationships)
        if (d.type === 'part_of_theme' || d.type === 'part_of_goal') {
          return 180; // Longer links for hierarchical relationships
        }
        
        // Similar content links - make these weaker to prevent bunching
        if (d.type === 'similar_content') {
          return 120; // Medium length for similarity links
        }
        
        // Links between different levels
        if (sourceLevel !== targetLevel) {
          return 200; // Longer links between different levels
        }
        
        // Default link distance
        return 100;
      })
      .strength(d => {
        // Reduce strength of similarity links to prevent tight clustering
        if (d.type === 'similar_content') {
          return 0.1 * (d.weight || 0.5); // Weaker connection based on similarity weight
        }
        
        // Maintain stronger hierarchical connections
        if (d.type === 'part_of_theme' || d.type === 'part_of_goal') {
          return 0.7; // Stronger parent-child connections
        }
        
        return 0.4; // Default strength
      })
    )
    .force('charge', d3.forceManyBody()
      .strength(d => {
        // Get node level
        const level = getNodeLevel(d);
        
        // Return configured strength
        return levelConfig.chargeStrength[level] || -100;
      })
      .distanceMin(10)
      .distanceMax(500) // Increased maximum distance
    )
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide()
      .radius(d => calculateNodeSize(d) + 15) // Increased collision radius
      .strength(0.9) // Stronger collision prevention
    )
    // Enhanced radial positioning force
    .force('radial', d3.forceRadial()
      .radius(d => {
        if (!levelConfig.radialPositioning.enabled) return null;
        
        const level = getNodeLevel(d);
        
        // Add slight randomness to break symmetry
        const jitter = (Math.random() - 0.5) * 30;
        
        return (levelConfig.radialPositioning[level] || 250) + jitter;
      })
      .x(width / 2)
      .y(height / 2)
      .strength(0.5) // Increased strength
    )
    // Add custom repulsion for each level
    .force('primaryRepulsion', levelRepulsion('primary'))
    .force('secondaryRepulsion', levelRepulsion('secondary'))
    .force('tertiaryRepulsion', levelRepulsion('tertiary'))
    .force('cluster', forceCluster(0.05))
    .force('interCommunityRepulsion', interCommunityRepulsion(1.5));

  // Draw links
  const link = g.selectAll('.link')
    .data(data.links)
    .enter()
    .append('line')
    .attr('class', 'link')
    .attr('stroke-width', d => Math.sqrt(d.weight || 1) * 2)
    .attr('stroke', localGetLinkColor);
  
  // Draw nodes
  const node = g.selectAll('.node')
    .data(data.nodes)
    .enter()
    .append('circle')
    .attr('class', d => `node ${d.is_central ? 'central-node' : ''}`)
    .attr('r', d => calculateNodeSize(d))
    .attr('fill', d => getNodeColor(d, colorScale))
    .call(createDragBehavior(simulation))
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
  
  // Add community labels
  const communityLabels = g.selectAll('.community-label')
    .data(communities)
    .enter()
    .append('text')
    .attr('class', 'community-label')
    .text(d => {
      // Find a node in this community to get the label
      const communityNode = data.nodes.find(node => node.community === d);
      return communityNode ? communityNode.community_label : `Cluster ${d}`;
    })
    .attr('font-size', 15)
    .attr('font-weight', 'bold')
    .attr('fill', d => colorScale(d))
    .attr('opacity', 0.7);
  
  // Update positions on simulation tick
  simulation.on('tick', () => {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);
    
    node
      .attr('cx', d => d.x)
      .attr('cy', d => d.y);
    
    label
      .attr('x', d => d.x)
      .attr('y', d => d.y);
    
    // Update community label positions to center of each community
    communityLabels.each(function(communityId) {
      const communityNodes = data.nodes.filter(n => n.community === communityId);
      if (communityNodes.length > 0) {
        const centerX = d3.mean(communityNodes, d => d.x);
        const centerY = d3.mean(communityNodes, d => d.y);
        d3.select(this)
          .attr('x', centerX)
          .attr('y', centerY);
      }
    });
  });

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
    colorScale: colorScale
  };
}