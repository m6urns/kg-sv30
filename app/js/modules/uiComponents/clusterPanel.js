// Cluster panel module for displaying theme clusters
import { focusOnNode } from '../nodeInteraction.js';
import { navigateToView } from './navigation.js';
import { renderFilteredNodesView } from './filterPanel.js';
import { VIEW_TYPE, getDOMReference } from './common.js';

/**
 * Setup the cluster panel with community data
 * @param {Array} communities - Array of community data objects
 */
export function setupClusterPanel(communities) {
  const clusterPanel = getDOMReference('clusterPanel');
  if (!clusterPanel) return;
  
  clusterPanel.innerHTML = '';
  
  // Create a padding container
  const paddingContainer = document.createElement('div');
  paddingContainer.className = 'clusters-padding-container';
  paddingContainer.style.padding = '20px';
  clusterPanel.appendChild(paddingContainer);
  
  // Add the title
  const title = document.createElement('h3');
  title.textContent = 'Topic Clusters';
  title.style.marginTop = '0';
  title.style.marginBottom = '20px';
  paddingContainer.appendChild(title);
  
  // Normal padding for the clusters column
  paddingContainer.style.paddingBottom = '40px';
  
  communities.forEach(community => {
    const section = document.createElement('div');
    section.className = 'community-section';
    
    // Create header with community label as a clickable link
    const header = document.createElement('h3');
    header.className = 'clickable-header';
    
    // Wrap the text in a link
    const headerLink = document.createElement('a');
    headerLink.textContent = community.label;
    headerLink.href = '#';
    headerLink.style.textDecoration = 'none';
    
    // Apply color to link instead of header
    if (window.graphViz && window.graphViz.colorScale) {
      headerLink.style.color = window.graphViz.colorScale(community.id);
    } else {
      headerLink.style.color = '#000';
    }
    
    // Add click handler to focus on the community's main node (first central topic)
    if (community.central_topics && community.central_topics.length > 0) {
      headerLink.onclick = (e) => {
        e.preventDefault();
        focusOnNode(community.central_topics[0].id);
      };
      
      // Add tooltip
      headerLink.title = 'Click to view this topic';
    }
    
    header.appendChild(headerLink);
    section.appendChild(header);
    
    // Add top keywords for this cluster if available
    const topKeywords = extractTopKeywords(community);
    if (topKeywords && topKeywords.length > 0) {
      const keywordsContainer = document.createElement('div');
      keywordsContainer.className = 'cluster-keywords';
      
      const keywordsList = document.createElement('div');
      keywordsList.className = 'keywords-list';
      
      topKeywords.forEach(pair => {
        const [keyword, count] = pair;
        const keywordTag = document.createElement('button');
        keywordTag.className = 'keyword-tag';
        keywordTag.textContent = keyword; // Remove count display
        keywordTag.title = `Click to show nodes containing "${keyword}"`;
        
        // Add click event to filter nodes by this keyword
        keywordTag.addEventListener('click', () => {
          filterNodesByKeyword(keyword, community.id);
        });
        
        keywordsList.appendChild(keywordTag);
      });
      
      keywordsContainer.appendChild(keywordsList);
      section.appendChild(keywordsContainer);
    }
    
    paddingContainer.appendChild(section);
  });
}

/**
 * Extract the top 10 keywords from a community by aggregating all topic keywords
 * @param {Object} community - Community data with topics
 * @returns {Array} - Array of [keyword, count] pairs for top 10 keywords
 */
function extractTopKeywords(community) {
  if (!community.topics || community.topics.length === 0) {
    return [];
  }
  
  // Collect all keywords from all topics in this community
  const keywordCounts = {};
  
  // Count occurrences of each keyword
  community.topics.forEach(topic => {
    if (topic.keywords && topic.keywords.length > 0) {
      topic.keywords.forEach(keyword => {
        if (!keywordCounts[keyword]) {
          keywordCounts[keyword] = 0;
        }
        keywordCounts[keyword]++;
      });
    }
  });
  
  // Convert to array of [keyword, count] pairs and sort
  const keywordPairs = Object.entries(keywordCounts);
  keywordPairs.sort((a, b) => b[1] - a[1]); // Sort by count descending
  
  // Return top 10 keywords with their counts (or all if less than 10)
  return keywordPairs.slice(0, 10);
}

/**
 * Filter nodes by a specific keyword and display them in the left-hand panel
 * @param {string} keyword - The keyword to filter by
 * @param {string|number} communityId - The ID of the community the keyword is from
 */
function filterNodesByKeyword(keyword, communityId) {
  const filteredNodesPanel = getDOMReference('filteredNodesPanel');
  
  if (!filteredNodesPanel || !window.graphViz || !window.graphViz.nodes) return;
  
  // Add to view history
  navigateToView({
    type: VIEW_TYPE.FILTERED,
    data: {
      keyword: keyword,
      communityId: communityId
    }
  });
  
  // Render the filtered nodes view
  renderFilteredNodesView(keyword, communityId);
}

/**
 * Navigate to cluster/overview view
 */
export function navigateToClusterView() {
  navigateToView({ type: VIEW_TYPE.CLUSTERS });
}

/**
 * Navigate to filtered view with keyword and community ID
 * @param {string} keyword - Keyword to filter by
 * @param {string|number} communityId - Community ID to filter within
 */
export function navigateToFilteredView(keyword, communityId) {
  navigateToView({
    type: VIEW_TYPE.FILTERED,
    data: {
      keyword,
      communityId
    }
  });
}