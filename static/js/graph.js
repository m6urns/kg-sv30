// Main graph module - coordinates all other modules
import { debounce } from './modules/utils.js';
import { loadGraphData, fetchCommunities, searchNodes, loadSampleData } from './modules/dataService.js';
import { createKnowledgeGraph } from './modules/visualization.js';
import { initializeNodeInteraction, focusOnNode, toggleFocusMode, isFocusModeEnabled } from './modules/nodeInteraction.js';
import { initializeUI, showStatus, displaySearchResults, setupClusterPanel } from './modules/uiComponents.js';

// Global state
let graphViz = null;

// DOM elements
const statusMessage = document.getElementById('status-message');
const searchInput = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');
const clusterPanel = document.getElementById('cluster-panel');
const graphContainer = document.getElementById('graph-container');

// URL parameters
const urlParams = new URLSearchParams(window.location.search);
const forceRegen = urlParams.get('regenerate') === 'true'; // Check for ?regenerate=true parameter

// Make graphViz available to modules that need it
window.graphViz = graphViz;

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
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
  initializeNodeInteraction(graphViz, graphContainer);
  
  // Set up the cluster panel
  setupClusters();
  
  // No auto-selection of nodes at startup
}

/**
 * Setup clusters panel
 */
async function setupClusters() {
  const communities = await fetchCommunities();
  
  // Store communities in the global graphViz object for access by keyword filtering
  if (window.graphViz) {
    window.graphViz.communities = communities;
  }
  
  setupClusterPanel(communities);
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  // Initialize UI components
  initializeUI(searchResults, searchInput, clusterPanel);
  
  // Initialize event listeners
  initializeEventListeners();
  
  // Ensure navigation buttons are created and visible at startup
  setTimeout(() => {
    const navButtons = document.getElementById('navigation-buttons');
    if (!navButtons || navButtons.style.display !== 'flex') {
      // If navigation buttons don't exist or aren't visible, reinitialize
      if (typeof window.initializeUniversalNavigation === 'function') {
        window.initializeUniversalNavigation();
      } else if (typeof initializeUniversalNavigation === 'function') {
        initializeUniversalNavigation();
      }
    }
  }, 500); // Short delay to ensure DOM is fully loaded
  
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
  
  // Load graph data - if regenerate parameter is true, use sample data to regenerate
  if (forceRegen) {
    showStatusMessage('Regenerating graph from sample data...', 'loading');
    loadSampleData(showStatusMessage, () => loadGraph());
  } else {
    // Always use saved data by default
    fetch('/api/load')
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          showStatusMessage('Loaded saved graph data', 'success');
          loadGraph();
        } else {
          // If no saved data exists yet, use sample data as a fallback
          showStatusMessage('No saved data found. Loading sample data...', 'loading');
          loadSampleData(showStatusMessage, () => loadGraph());
        }
      })
      .catch(error => {
        // On error, use sample data
        showStatusMessage('Error loading saved data. Loading sample data...', 'loading');
        loadSampleData(showStatusMessage, () => loadGraph());
      });
  }
});