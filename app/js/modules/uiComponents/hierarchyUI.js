// Hierarchical tags and navigation elements
import { focusOnNode } from '../nodeInteraction.js';
import { fetchNodeDetails } from '../dataService.js';

/**
 * Creates hierarchical navigation tags based on node type and connections
 * @param {Object} data - Node data with connections
 * @param {HTMLElement} container - Container to append tags to
 */
export function createHierarchicalTags(data, container) {
  const tagContainer = document.createElement('div');
  tagContainer.className = 'hierarchical-tags';
  
  const node = data.node;
  const nodeType = node.type;
  let parentGoal = null;
  let parentTheme = null;
  
  // Find direct parent relationships
  if (nodeType === 'strategy' || nodeType === 'document') {
    // For strategies and goals, first try to find direct theme connection
    parentTheme = data.connections.find(conn => 
      conn.node.type === 'topic' && 
      (conn.relationship === 'belongs_to' || conn.relationship === 'part_of_theme'));
  }
  
  // Find parent goal for strategies
  if (nodeType === 'strategy') {
    parentGoal = data.connections.find(conn => 
      conn.node.type === 'document' && 
      (conn.relationship === 'part_of_goal'));
    
    // We need to fetch the theme for this strategy
    if (!parentTheme && parentGoal) {
      // Store goal info to access in the theme tag even if we don't have theme data yet
      const goalId = parentGoal.node.id;
      
      // Create a slightly different theme tag for strategies
      // This will create a theme tag that says "Parent Theme" if we don't know the name yet
      parentTheme = {
        node: {
          id: `theme_${goalId.split('_')[1]}`, // Construct a likely theme ID based on goal ID
          // Structure: goal_12_12_1 → theme_12
          label: "Parent Theme",
          type: 'topic'
        },
        needsFetch: true,
        goalId: goalId
      };
    }
  }
  
  // Create theme tag if applicable
  if (nodeType === 'topic' || parentTheme) {
    const themeTag = document.createElement('div');
    themeTag.className = 'node-type-label node-type-theme';
    
    if (nodeType === 'topic') {
      // Current node is a theme
      themeTag.textContent = 'Theme';
      themeTag.classList.add('current-node-tag');
    } else {
      // Parent theme tag is clickable
      themeTag.textContent = 'Theme: ' + parentTheme.node.label;
      themeTag.classList.add('clickable-tag');
      
      // Set up the click handler
      if (parentTheme && parentTheme.needsFetch && parentTheme.goalId) {
        // If we need to fetch the theme, click will go to the parent goal first
        themeTag.onclick = () => focusOnNode(parentTheme.goalId);
      } else if (parentTheme && parentTheme.node) {
        // Otherwise, direct link to theme
        themeTag.onclick = () => focusOnNode(parentTheme.node.id);
      }
    }
    
    tagContainer.appendChild(themeTag);
    
    // If we need to fetch theme data, do that now and update the tag when ready
    if (parentTheme && parentTheme.needsFetch && parentTheme.goalId) {
      // Use window.fetchNodeDetails as a fallback if the import doesn't work
      const fetchFunc = typeof fetchNodeDetails === 'function' ? 
        fetchNodeDetails : (window.fetchNodeDetails || null);
        
      if (fetchFunc) {
        fetchFunc(parentTheme.goalId).then(goalData => {
          if (goalData) {
            const themeConn = goalData.connections.find(conn => 
              conn.node.type === 'topic' && 
              (conn.relationship === 'belongs_to' || conn.relationship === 'part_of_theme'));
            
            if (themeConn) {
              // Update the theme tag with correct information
              themeTag.textContent = 'Theme: ' + themeConn.node.label;
              
              // Update the click handler to go directly to the theme
              themeTag.onclick = () => focusOnNode(themeConn.node.id);
            }
          }
        }).catch(err => {
          console.error('Error fetching theme data:', err);
        });
      }
    }
  }
  
  // Create goal tag if applicable
  if (nodeType === 'document' || parentGoal) {
    const goalTag = document.createElement('div');
    goalTag.className = 'node-type-label node-type-goal';
    
    if (nodeType === 'document') {
      // Current node is a goal
      goalTag.textContent = 'Goal';
      goalTag.classList.add('current-node-tag');
    } else {
      // Parent goal tag is clickable
      goalTag.textContent = 'Goal: ' + parentGoal.node.label;
      goalTag.classList.add('clickable-tag');
      goalTag.onclick = () => focusOnNode(parentGoal.node.id);
    }
    
    tagContainer.appendChild(goalTag);
  }
  
  // Create strategy tag if applicable
  if (nodeType === 'strategy') {
    const strategyTag = document.createElement('div');
    strategyTag.textContent = 'Strategy';
    strategyTag.className = 'node-type-label node-type-strategy current-node-tag';
    tagContainer.appendChild(strategyTag);
  }
  
  container.appendChild(tagContainer);
}