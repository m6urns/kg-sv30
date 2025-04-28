// Node details display module
import { focusOnNode, addToNodeViewHistory } from '../nodeInteraction.js';
import { fetchNodeDetails } from '../dataService.js';
import { navigateToView } from './navigation.js';
import { createHierarchicalTags } from './hierarchyUI.js';
import { VIEW_TYPE, getDOMReference } from './common.js';

/**
 * Display node details in the navigation panel
 * @param {Object} data - Node data with connections
 * @param {Array} nodeViewHistory - History of viewed nodes (deprecated, kept for compatibility)
 */
export function displayNodeDetails(data, nodeViewHistory) {
  const navigationPanel = getDOMReference('navigationPanel');
  const clustersContainer = getDOMReference('clustersContainer');
  
  if (!navigationPanel || !clustersContainer) return;
  
  // Add node to view history for unified navigation
  navigateToView({
    type: VIEW_TYPE.NODE,
    data: {
      nodeId: data.node.id,
      nodeData: data
    }
  });
  
  // Legacy node history for compatibility with nodeInteraction.js
  const nodeId = data.node.id;
  addToNodeViewHistory(nodeId);
  
  // Render the node details content
  renderNodeDetails(data);
}

/**
 * Render node details in the navigation panel
 * @param {Object} data - Node data with connections
 */
export function renderNodeDetails(data) {
  // Get the content wrapper
  const contentWrapper = document.getElementById('nav-content-wrapper');
  
  // Create a content container with padding
  let contentContainer;
  if (contentWrapper) {
    contentWrapper.innerHTML = '';
    // Add padding container for content
    contentContainer = document.createElement('div');
    contentContainer.className = 'nav-padding-container';
    contentContainer.style.padding = '20px';
    // Add extra bottom padding to ensure content isn't hidden behind buttons
    contentContainer.style.paddingBottom = '150px';
    contentWrapper.appendChild(contentContainer);
  }
  
  // Create header for the node
  const header = document.createElement('h2');
  header.textContent = data.node.label;
  contentContainer.appendChild(header);
  
  // Create hierarchical tags
  createHierarchicalTags(data, contentContainer);
  
  // Process content based on node type
  if (data.node.type === 'topic') {
    displayTopicDetails(data, contentContainer);
  } else if (data.node.type === 'document' && 
            (data.node.has_strategy_links || data.node.display_type === 'strategy_list') && 
            data.node.strategy_entries) {
    displayDocumentWithStrategies(data, contentContainer);
  } else if (data.node.type === 'strategy') {
    displayStrategyDetails(data, contentContainer);
  } else {
    displayGenericDetails(data, contentContainer);
  }
}

/**
 * Display details for topic nodes
 * @param {Object} data - Node data
 * @param {HTMLElement} contentWrapper - The content container
 */
function displayTopicDetails(data, contentWrapper) {
  // Create overview section
  const overviewSection = document.createElement('div');
  overviewSection.className = 'node-info-section';
  
  // Create metadata container
  const metaContainer = document.createElement('div');
  metaContainer.className = 'node-meta';
  
  // Add keywords if available - only if theme is not part of a community (not collected)
  if (data.node.keywords && data.node.keywords.length > 0 && !data.node.community_label) {
    const keywords = document.createElement('div');
    keywords.className = 'node-meta-item';
    keywords.innerHTML = '<strong>Keywords:</strong> ' + 
                        data.node.keywords.join(', ');
    metaContainer.appendChild(keywords);
  }
  
  overviewSection.appendChild(metaContainer);
  
  // Add description if available
  if (data.node.description || data.node.overview) {
    const description = document.createElement('p');
    description.className = 'node-description theme-description';
    description.textContent = data.node.overview || data.node.description;
    overviewSection.appendChild(description);
  }
  
  contentWrapper.appendChild(overviewSection);
  
  // Create related topics section if there are any
  const relatedTopics = data.connections
    .filter(conn => conn.node.type === 'topic')
    .map(conn => conn.node);
  
  if (relatedTopics.length > 0) {
    const topicsSection = document.createElement('div');
    topicsSection.className = 'node-info-section';
    
    const topicsTitle = document.createElement('h3');
    topicsTitle.textContent = 'Related Themes';
    topicsSection.appendChild(topicsTitle);
    
    const topicsList = document.createElement('ul');
    topicsList.className = 'hierarchy-list';
    
    relatedTopics.forEach(topic => {
      const item = document.createElement('li');
      item.className = 'theme-item';
      
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
    
    topicsSection.appendChild(topicsList);
    contentWrapper.appendChild(topicsSection);
  }
  
  // Create related goals section
  const goalsSection = document.createElement('div');
  goalsSection.className = 'node-info-section';
  
  const docsTitle = document.createElement('h3');
  docsTitle.textContent = 'Related Goals';
  goalsSection.appendChild(docsTitle);
  
  const relatedDocs = data.connections
    .filter(conn => conn.node.type === 'document')
    .map(conn => conn.node);
  
  if (relatedDocs.length > 0) {
    const docList = document.createElement('ul');
    docList.className = 'hierarchy-list';
    
    relatedDocs.forEach(doc => {
      const item = document.createElement('li');
      item.className = 'goal-item';
      
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
    
    goalsSection.appendChild(docList);
  } else {
    // Show message if no goals
    const noGoals = document.createElement('p');
    noGoals.className = 'empty-connections';
    noGoals.textContent = 'No goals associated with this theme';
    goalsSection.appendChild(noGoals);
  }
  
  contentWrapper.appendChild(goalsSection);
}

/**
 * Display details for document nodes with strategies
 * @param {Object} data - Node data
 * @param {HTMLElement} contentWrapper - The content container
 */
function displayDocumentWithStrategies(data, contentWrapper) {
  // Create overview section
  const overviewSection = document.createElement('div');
  overviewSection.className = 'node-info-section';
  
  // Create metadata container
  const metaContainer = document.createElement('div');
  metaContainer.className = 'node-meta';
  
  // Add metadata to the overview section
  overviewSection.appendChild(metaContainer);
  
  // Add goal description if different from label
  if (data.node.text && data.node.text !== data.node.label) {
    const text = document.createElement('p');
    text.textContent = data.node.text;
    text.className = 'node-description goal-description';
    overviewSection.appendChild(text);
  }
  
  contentWrapper.appendChild(overviewSection);
  
  // Create strategies section
  const strategiesSection = document.createElement('div');
  strategiesSection.className = 'node-info-section';
  
  // Add strategies header
  const strategiesTitle = document.createElement('h3');
  strategiesTitle.textContent = 'Strategies';
  strategiesSection.appendChild(strategiesTitle);
  
  // Create strategies list
  const strategiesList = document.createElement('ul');
  strategiesList.className = 'hierarchy-list';
  
  if (data.node.strategy_entries && data.node.strategy_entries.length > 0) {
    data.node.strategy_entries.forEach(strategy => {
      const item = document.createElement('li');
      item.className = 'strategy-item';
      
      const link = document.createElement('a');
      // Format according to the item_format if specified, otherwise use default format
      const displayText = strategy.section + ': ' + strategy.summary;
      link.textContent = displayText;
      link.href = strategy.url || '#';
      
      // Extract strategy ID from the URL if it exists
      let strategyId = strategy.id;
      if (!strategyId && strategy.url) {
        // If there's a URL like "#/strategy/strategy_id", extract the ID
        const match = strategy.url.match(/#\/strategy\/(.+)$/);
        if (match) strategyId = match[1];
      }
      
      if (strategyId) {
        link.onclick = (e) => {
          e.preventDefault();
          focusOnNode(strategyId);
        };
      }
      
      item.appendChild(link);
      strategiesList.appendChild(item);
    });
  } else {
    // Show message if no strategies
    const noStrategies = document.createElement('p');
    noStrategies.className = 'empty-connections';
    noStrategies.textContent = 'No strategies found for this goal';
    strategiesSection.appendChild(noStrategies);
  }
  
  strategiesSection.appendChild(strategiesList);
  contentWrapper.appendChild(strategiesSection);
}

/**
 * Display details for strategy nodes
 * @param {Object} data - Node data
 * @param {HTMLElement} contentWrapper - The content container
 */
function displayStrategyDetails(data, contentWrapper) {
  // Create overview section
  const overviewSection = document.createElement('div');
  overviewSection.className = 'node-info-section';
  
  // Show strategy text
  const text = document.createElement('p');
  text.textContent = data.node.text;
  text.className = 'node-description strategy-description';
  overviewSection.appendChild(text);
  
  contentWrapper.appendChild(overviewSection);
  
  // Display similar strategies section if available
  if (data.node.connections && data.node.connections.length > 0) {
    // Check if there are any similar strategies
    const similarStrategies = data.node.connections.filter(conn => 
      conn.node_type === 'strategy' || 
      (conn.relationship && conn.relationship.includes('similar')));
    
    if (similarStrategies.length > 0) {
      const similarSection = document.createElement('div');
      similarSection.className = 'node-info-section';
      
      // We'll append the similar strategies to this section
      displaySimilarStrategies(data.node, similarSection);
      
      contentWrapper.appendChild(similarSection);
    }
  }
}

/**
 * Display details for other node types
 * @param {Object} data - Node data
 * @param {HTMLElement} contentWrapper - The content container
 */
function displayGenericDetails(data, contentWrapper) {
  // Show document text
  const text = document.createElement('p');
  text.textContent = data.node.text;
  text.className = 'node-description';
  contentWrapper.appendChild(text);
  
  // Show related topic and/or goal
  const relationshipsContainer = document.createElement('div');
  
  const topic = data.connections
    .find(conn => conn.node.type === 'topic' && 
                (conn.relationship === 'belongs_to' || conn.relationship === 'part_of_theme'));
  
  if (topic) {
    const topicInfo = document.createElement('p');
    topicInfo.innerHTML = '<strong>Theme:</strong> ';
    
    const link = document.createElement('a');
    link.textContent = topic.node.label;
    link.href = '#';
    link.onclick = (e) => {
      e.preventDefault();
      focusOnNode(topic.node.id);
    };
    
    topicInfo.appendChild(link);
    relationshipsContainer.appendChild(topicInfo);
  }
  
  contentWrapper.appendChild(relationshipsContainer);
  
  // Add any other connections
  const otherConnections = data.connections
    .filter(conn => conn.node.type !== 'topic' || 
        (conn.relationship !== 'belongs_to' && conn.relationship !== 'part_of_theme'));
        
  if (otherConnections.length > 0) {
    const connectionsTitle = document.createElement('h3');
    connectionsTitle.textContent = 'Related Items:';
    contentWrapper.appendChild(connectionsTitle);
    
    const connectionsList = document.createElement('ul');
    connectionsList.className = 'hierarchy-list';
    
    otherConnections.forEach(conn => {
      const item = document.createElement('li');
      item.className = conn.node.type === 'topic' ? 'theme-item' : 
                     conn.node.type === 'document' ? 'goal-item' : 'strategy-item';
      
      const link = document.createElement('a');
      link.textContent = conn.node.label;
      link.href = '#';
      link.onclick = (e) => {
        e.preventDefault();
        focusOnNode(conn.node.id);
      };
      
      item.appendChild(link);
      connectionsList.appendChild(item);
    });
    
    contentWrapper.appendChild(connectionsList);
  }
}

/**
 * Display similar strategies panel
 * @param {Object} strategyNode - Strategy node data
 * @param {HTMLElement} container - Container to append to
 */
function displaySimilarStrategies(strategyNode, container) {
  // Create header
  const header = document.createElement('h3');
  header.textContent = 'Similar Strategies';
  container.appendChild(header);
  
  // Check if there are any similar strategies
  if (!strategyNode.connections || strategyNode.connections.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'empty-connections';
    emptyMessage.textContent = 'No similar strategies found';
    container.appendChild(emptyMessage);
    return;
  }
  
  // Create list of similar strategies using the common list styling
  const strategiesList = document.createElement('ul');
  strategiesList.className = 'hierarchy-list';
  
  // Loop through connections and add them to the list
  strategyNode.connections.forEach(connection => {
    const item = document.createElement('li');
    item.className = 'strategy-item';
    
    // Create link to the strategy
    const link = document.createElement('a');
    
    // Use the display_label if available, otherwise use the node_label
    link.textContent = connection.node_label;
    link.href = '#';
    link.dataset.nodeId = connection.node_id;
    
    // Add click handler to navigate to the connected strategy
    link.onclick = (e) => {
      e.preventDefault();
      focusOnNode(connection.node_id);
    };
    
    item.appendChild(link);
    
    // Add context info as subtitle if available
    if (connection.theme_title || connection.goal_title) {
      const contextText = [];
      if (connection.theme_title) contextText.push(connection.theme_title);
      if (connection.goal_title) contextText.push(connection.goal_title);
      
      if (contextText.length > 0) {
        const contextInfo = document.createElement('small');
        contextInfo.className = 'item-context';
        contextInfo.textContent = contextText.join(' | ');
        item.appendChild(contextInfo);
      }
    }
    
    strategiesList.appendChild(item);
  });
  
  container.appendChild(strategiesList);
  
  // Add extra spacer div to ensure all content is visible
  const spacer = document.createElement('div');
  spacer.style.height = '50px';
  spacer.style.width = '100%';
  container.appendChild(spacer);
}