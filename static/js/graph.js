// Global variables
let graphViz = null;

// Helper function for node sizing
function getNodeSize(d) {
  let size = 5;
  if (d.type === 'topic') {
    size = 10 + (d.size || 1) / 2;
    if (size > 25) size = 25; // cap maximum size
  }
  // Make central topics larger
  if (d.is_central) {
    size *= 1.5;
  }
  return size;
}

// DOM elements
const sampleBtn = document.getElementById('sample-btn');
const loadBtn = document.getElementById('load-btn');
const statusMessage = document.getElementById('status-message');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const clusterPanel = document.getElementById('cluster-panel');
const detailsPanel = document.getElementById('details-panel');
const graphContainer = document.getElementById('graph-container');

// Initialize event listeners
function initializeEventListeners() {
  // Sample data button
  sampleBtn.addEventListener('click', async () => {
    showStatus('Loading sample data...', 'loading');
    try {
      const response = await fetch('/api/process?generator=sample', { method: 'POST' });
      const data = await response.json();
      
      if (data.success) {
        showStatus('Sample data loaded successfully!', 'success');
        loadGraphData();
      } else {
        showStatus(`Error: ${data.error}`, 'error');
      }
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    }
  });
  
  // Load button
  loadBtn.addEventListener('click', async () => {
    showStatus('Loading saved graph data...', 'loading');
    try {
      const response = await fetch('/api/load');
      const data = await response.json();
      
      if (data.success) {
        showStatus('Graph data loaded successfully!', 'success');
        loadGraphData();
      } else {
        showStatus(`Error: ${data.error}`, 'error');
      }
    } catch (error) {
      showStatus(`Error: ${error.message}`, 'error');
    }
  });
  
  // Search input
  searchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value.trim();
    if (!query) {
      searchResults.style.display = 'none';
      return;
    }
    
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const results = await response.json();
      
      displaySearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    }
  }, 300));
}

// Helper Functions
function showStatus(message, type) {
  statusMessage.textContent = message;
  statusMessage.className = type;
}

function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function displaySearchResults(results) {
  searchResults.innerHTML = '';
  
  if (results.length === 0) {
    searchResults.innerHTML = '<p class="p-2">No results found</p>';
    searchResults.style.display = 'block';
    return;
  }
  
  const ul = document.createElement('ul');
  
  results.forEach(result => {
    const li = document.createElement('li');
    li.textContent = result.label;
    li.addEventListener('click', async () => {
      // Fetch the detailed node data from the API instead of using the search result
      try {
        const response = await fetch(`/api/node/${result.id}`);
        const data = await response.json();
        
        if (data.node) {
          // Hide search results
          searchResults.style.display = 'none';
          searchInput.value = '';
          
          // Display node details in the details panel
          displayNodeDetails(data);
          
          // If a graph visualization exists, focus on the node in the graph
          if (graphViz) {
            const graphNode = graphViz.nodes.find(n => n.id === result.id);
            if (graphNode) {
              // Center the view on this node
              const transform = d3.zoomIdentity
                .translate(graphContainer.clientWidth / 2 - graphNode.x, graphContainer.clientHeight / 2 - graphNode.y);
              
              graphViz.svg.transition()
                .duration(750)
                .call(graphViz.zoom.transform, transform);
              
              // Highlight this node in the graph
              graphViz.nodeElements
                .attr('stroke-width', d => d.is_central ? 2 : 1.5)
                .attr('r', d => {
                  // Inline node sizing logic to avoid the getNodeSize reference error
                  let size = 5;
                  if (d.type === 'topic') {
                    size = 10 + (d.size || 1) / 2;
                    if (size > 25) size = 25;
                  }
                  if (d.is_central) size *= 1.5;
                  return size;
                });
              
              // Highlight the selected node
              graphViz.nodeElements
                .filter(d => d.id === result.id)
                .attr('stroke-width', 3)
                .attr('r', d => {
                  // Inline node sizing logic again
                  let size = 5;
                  if (d.type === 'topic') {
                    size = 10 + (d.size || 1) / 2;
                    if (size > 25) size = 25;
                  }
                  if (d.is_central) size *= 1.5;
                  return size * 1.3;
                });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching node details:', error);
      }
    });
    ul.appendChild(li);
  });
  
  searchResults.appendChild(ul);
  searchResults.style.display = 'block';
}

// Helper function to display node details in the details panel
function displayNodeDetails(data) {
  detailsPanel.innerHTML = '';
  
  // Create header
  const header = document.createElement('h2');
  header.textContent = data.node.label;
  detailsPanel.appendChild(header);
  
  // Create content based on node type
  if (data.node.type === 'topic') {
    // Show topic keywords
    const keywords = document.createElement('p');
    keywords.innerHTML = '<strong>Keywords:</strong> ' + 
                       (data.node.keywords || []).join(', ');
    detailsPanel.appendChild(keywords);
    
    // Show community
    if (data.node.community_label) {
      const community = document.createElement('p');
      community.innerHTML = '<strong>Cluster:</strong> ' + 
                         data.node.community_label;
      detailsPanel.appendChild(community);
    }
    
    // Show related topics
    const relatedTopics = data.connections
      .filter(conn => conn.node.type === 'topic')
      .map(conn => conn.node);
    
    if (relatedTopics.length > 0) {
      const topicsTitle = document.createElement('h3');
      topicsTitle.textContent = 'Related Topics:';
      detailsPanel.appendChild(topicsTitle);
      
      const topicsList = document.createElement('ul');
      relatedTopics.forEach(topic => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.textContent = topic.label;
        link.href = '#';
        link.onclick = (e) => {
          e.preventDefault();
          focusOnNode(topic.id);
        };
        item.appendChild(link);
        topicsList.appendChild(item);
      });
      
      detailsPanel.appendChild(topicsList);
    }
    
    // Show related documents
    const docsTitle = document.createElement('h3');
    docsTitle.textContent = 'Related Document Segments:';
    detailsPanel.appendChild(docsTitle);
    
    const docList = document.createElement('ul');
    const relatedDocs = data.connections
      .filter(conn => conn.node.type === 'document')
      .map(conn => conn.node);
    
    relatedDocs.forEach(doc => {
      const item = document.createElement('li');
      const link = document.createElement('a');
      link.textContent = doc.label;
      link.href = '#';
      link.onclick = (e) => {
        e.preventDefault();
        focusOnNode(doc.id);
      };
      item.appendChild(link);
      docList.appendChild(item);
    });
    
    detailsPanel.appendChild(docList);
  } else {
    // Show document text
    const text = document.createElement('p');
    text.textContent = data.node.text;
    detailsPanel.appendChild(text);
    
    // Show related topic
    const topic = data.connections
      .find(conn => conn.node.type === 'topic' && 
                 conn.relationship === 'belongs_to');
    
    if (topic) {
      const topicInfo = document.createElement('p');
      topicInfo.innerHTML = '<strong>Topic:</strong> ';
      
      const link = document.createElement('a');
      link.textContent = topic.node.label;
      link.href = '#';
      link.onclick = (e) => {
        e.preventDefault();
        focusOnNode(topic.node.id);
      };
      
      topicInfo.appendChild(link);
      detailsPanel.appendChild(topicInfo);
    }
  }
}

function focusOnNode(nodeId) {
  if (!graphViz) return;
  
  // Find the node in the visualization
  const node = graphViz.nodes.find(n => n.id === nodeId);
  if (!node) return;
  
  // Highlight the node
  highlightNode(node);
  
  // Center the view on this node
  const transform = d3.zoomIdentity
    .translate(graphContainer.clientWidth / 2 - node.x, graphContainer.clientHeight / 2 - node.y);
  
  graphViz.svg.transition()
    .duration(750)
    .call(graphViz.zoom.transform, transform);
  
  // Show node details
  showNodeDetails(node);
}

function highlightNode(node) {
  // Reset all nodes
  graphViz.nodeElements
    .attr('stroke-width', d => d.is_central ? 2 : 1.5)
    .attr('r', d => {
      // Inline node sizing logic to avoid the getNodeSize reference error
      let size = 5;
      if (d.type === 'topic') {
        size = 10 + (d.size || 1) / 2;
        if (size > 25) size = 25;
      }
      if (d.is_central) size *= 1.5;
      return size;
    });
  
  // Highlight selected node
  graphViz.nodeElements
    .filter(d => d.id === node.id)
    .attr('stroke-width', 3)
    .attr('r', d => {
      // Inline node sizing logic again
      let size = 5;
      if (d.type === 'topic') {
        size = 10 + (d.size || 1) / 2;
        if (size > 25) size = 25;
      }
      if (d.is_central) size *= 1.5;
      return size * 1.3;
    });
}

async function setupClusterPanel() {
  try {
    const response = await fetch('/api/communities');
    const communities = await response.json();
    
    clusterPanel.innerHTML = '';
    
    communities.forEach(community => {
      const section = document.createElement('div');
      section.className = 'community-section';
      
      // Create header with community label
      const header = document.createElement('h3');
      header.textContent = community.label;
      header.style.color = graphViz ? graphViz.colorScale(community.id) : '#000';
      section.appendChild(header);
      
      // Create entry points list for central topics
      if (community.central_topics && community.central_topics.length > 0) {
        const entriesTitle = document.createElement('h4');
        entriesTitle.textContent = 'Key Topics:';
        section.appendChild(entriesTitle);
        
        const entriesList = document.createElement('ul');
        community.central_topics.forEach(topic => {
          const item = document.createElement('li');
          const link = document.createElement('a');
          link.textContent = topic.label;
          link.href = '#';
          link.onclick = (e) => {
            e.preventDefault();
            focusOnNode(topic.id);
          };
          item.appendChild(link);
          entriesList.appendChild(item);
        });
        section.appendChild(entriesList);
      }
      
      clusterPanel.appendChild(section);
    });
  } catch (error) {
    console.error('Error fetching communities:', error);
  }
}

async function showNodeDetails(node) {
  try {
    const response = await fetch(`/api/node/${node.id}`);
    const data = await response.json();
    
    // Use our new displayNodeDetails function to show the node details
    displayNodeDetails(data);
  } catch (error) {
    console.error('Error fetching node details:', error);
  }
}

// Graph Visualization
function createKnowledgeGraph(data, container) {
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
  
  const colorScale = d3.scaleOrdinal()
    .domain(communities)
    .range(d3.schemeCategory10);
  
  // Define forces with community clustering
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.links).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(width / 2, height / 2))
    .force('collision', d3.forceCollide().radius(d => getNodeSize(d) + 10))
    .force('cluster', forceCluster());
  
  // Draw links
  const link = g.selectAll('.link')
    .data(data.links)
    .enter()
    .append('line')
    .attr('class', 'link')
    .attr('stroke-width', d => Math.sqrt(d.weight || 1) * 2)
    .attr('stroke', getLinkColor);
  
  // Draw nodes
  const node = g.selectAll('.node')
    .data(data.nodes)
    .enter()
    .append('circle')
    .attr('class', d => `node ${d.is_central ? 'central-node' : ''}`)
    .attr('r', getNodeSize)
    .attr('fill', getNodeColor)
    .call(drag(simulation))
    .on('mouseover', showTooltip)
    .on('mouseout', hideTooltip)
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
    .attr('font-size', 16)
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
  
  // Helper functions
  function getNodeSize(d) {
    let size = 5;
    if (d.type === 'topic') {
      size = 10 + (d.size || 1) / 2;
      if (size > 25) size = 25; // cap maximum size
    }
    // Make central topics larger
    if (d.is_central) {
      size *= 1.5;
    }
    return size;
  }
  
  function getNodeColor(d) {
    if (d.type === 'topic') {
      // Color by community for topics
      return d.community !== undefined ? colorScale(d.community) : '#6baed6';
    }
    return '#fd8d3c'; // Document nodes
  }
  
  function getLinkColor(d) {
    if (d.type === 'belongs_to') return '#bdbdbd';
    
    // For related_to links, blend the colors of the communities
    if (d.source.community !== undefined && 
        d.target.community !== undefined && 
        d.source.community === d.target.community) {
      return colorScale(d.source.community);
    }
    
    return '#9ecae1';
  }
  
  function showTooltip(event, d) {
    let content = `<strong>${d.label || d.id}</strong><br/>`;
    
    if (d.type === 'topic') {
      content += `<strong>Keywords:</strong> ${(d.keywords || []).join(', ')}<br/>`;
      if (d.community_label) {
        content += `<strong>Cluster:</strong> ${d.community_label}<br/>`;
      }
      if (d.docs) {
        content += `<strong>Documents:</strong> ${d.docs.length}`;
      }
      if (d.is_central) {
        content += `<br/><em>Central topic in this cluster</em>`;
      }
    } else {
      content += `${d.text ? d.text.substring(0, 100) + '...' : ''}`;
    }
    
    tooltip.transition()
      .duration(200)
      .style('opacity', .9);
    
    tooltip.html(content)
      .style('left', (event.pageX + 10) + 'px')
      .style('top', (event.pageY - 28) + 'px');
  }
  
  function hideTooltip() {
    tooltip.transition()
      .duration(500)
      .style('opacity', 0);
  }
  
  function nodeClicked(event, d) {
    // Show details panel with node information
    showNodeDetails(d);
    
    // Highlight this node
    highlightNode(d);
  }
  
  // Force to cluster nodes by community
  function forceCluster() {
    const strength = 0.15;
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
    }
    
    return force;
  }
  
  function drag(simulation) {
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

// Load graph data and initialize visualization
async function loadGraphData() {
  try {
    const response = await fetch('/api/graph');
    const data = await response.json();
    
    if (data.error) {
      showStatus(data.error, 'error');
      return;
    }
    
    // Create graph visualization
    graphViz = createKnowledgeGraph(data, graphContainer);
    
    // Set up the cluster panel
    setupClusterPanel();
    
    showStatus('Graph visualization loaded!', 'success');
  } catch (error) {
    showStatus(`Error loading graph: ${error.message}`, 'error');
  }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  initializeEventListeners();
  
  // Try to load saved data if available
  fetch('/api/load')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showStatus('Loaded saved graph data', 'success');
        loadGraphData();
      } else {
        // If no saved data, automatically load sample data
        showStatus('No saved data found. Loading sample data...', 'loading');
        sampleBtn.click();
      }
    })
    .catch(error => {
      // On error, automatically load sample data
      showStatus('Error loading saved data. Loading sample data...', 'loading');
      sampleBtn.click();
    });
});