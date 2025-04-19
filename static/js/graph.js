// Main graph module - coordinates all other modules
import { debounce } from './modules/utils.js';
import { loadGraphData, fetchCommunities, searchNodes, loadSampleData, loadSavedData } from './modules/dataService.js';
import { createKnowledgeGraph } from './modules/visualization.js';
import { initializeNodeInteraction, focusOnNode } from './modules/nodeInteraction.js';
import { initializeUI, showStatus, displaySearchResults, setupClusterPanel } from './modules/uiComponents.js';

// Global state
let graphViz = null;

// DOM elements
const sampleBtn = document.getElementById('sample-btn');
const loadBtn = document.getElementById('load-btn');
const statusMessage = document.getElementById('status-message');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const clusterPanel = document.getElementById('cluster-panel');
const detailsPanel = document.getElementById('details-panel');
const graphContainer = document.getElementById('graph-container');

// Make graphViz available to modules that need it
window.graphViz = graphViz;

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
  // Sample data button
  sampleBtn.addEventListener('click', () => {
    loadSampleData(showStatusMessage, () => loadGraph());
  });
  
  // Load button
  loadBtn.addEventListener('click', () => {
    loadSavedData(showStatusMessage, () => loadGraph());
  });
  
  // Search input
  searchInput.addEventListener('input', debounce(async (e) => {
    const query = e.target.value.trim();
    if (!query) {
      searchResults.style.display = 'none';
      return;
    }
    
    const results = await searchNodes(query);
    displaySearchResults(results);
  }, 300));
}

/**
 * Show a status message
 * @param {string} message - Message to display
 * @param {string} type - Message type (success, error, loading)
 */
function showStatusMessage(message, type) {
  showStatus(message, type, statusMessage);
}

/**
 * Load and initialize the graph
 */
async function loadGraph() {
  const data = await loadGraphData(onGraphDataLoaded, showStatusMessage);
  if (!data) return;
}

/**
 * Handle successful graph data loading
 * @param {Object} data - Graph data with nodes and links
 */
function onGraphDataLoaded(data) {
  // Create graph visualization
  graphViz = createKnowledgeGraph(data, graphContainer);
  
  // Make graphViz available to modules that need it
  window.graphViz = graphViz;
  
  // Initialize node interaction with dependencies
  initializeNodeInteraction(graphViz, graphContainer, detailsPanel);
  
  // Set up the cluster panel
  setupClusters();
}

/**
 * Setup clusters panel
 */
async function setupClusters() {
  const communities = await fetchCommunities();
  setupClusterPanel(communities);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI components
  initializeUI(detailsPanel, searchResults, searchInput, clusterPanel);
  
  // Initialize event listeners
  initializeEventListeners();
  
  // HTTPS specific fallbacks for utils
  if (window.location.protocol === 'https:') {
    console.log('Running over HTTPS protocol');
    
    // Ensure calculateNodeSize function exists
    if (typeof calculateNodeSize !== 'function') {
      console.warn('calculateNodeSize not found, defining fallback function');
      window.calculateNodeSize = function(d) {
        let size = 5;
        if (d.type === 'topic') {
          size = 10 + (d.size || 1) / 2;
          if (size > 25) size = 25;
        }
        if (d.is_central) size *= 1.5;
        return size;
      };
    }
    
    // Ensure debounce function exists
    if (typeof debounce !== 'function') {
      console.warn('debounce not found, defining fallback function');
      window.debounce = function(func, wait) {
        let timeout;
        return function(...args) {
          clearTimeout(timeout);
          timeout = setTimeout(() => func.apply(this, args), wait);
        };
      };
    }
  }
  
  // Try to load saved data if available
  fetch('/api/load')
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showStatusMessage('Loaded saved graph data', 'success');
        loadGraph();
      } else {
        // If no saved data, automatically load sample data
        showStatusMessage('No saved data found. Loading sample data...', 'loading');
        sampleBtn.click();
      }
    })
    .catch(error => {
      // On error, automatically load sample data
      showStatusMessage('Error loading saved data. Loading sample data...', 'loading');
      sampleBtn.click();
    });
});