// Utility functions for the Strategic Vision Navigator

// Calculate node size consistently throughout the application
// function calculateNodeSize(d) {
//   let size = 5;
//   if (d.type === 'topic') {
//     size = 10 + (d.size || 1) / 2;
//     if (size > 25) size = 25; // cap maximum size
//   }
//   // Make central topics larger
//   if (d.is_central) {
//     size *= 1.5;
//   }
//   return size;
// }

function calculateNodeSize(d) {
  if (d.type === 'topic') {
    // Theme nodes (level 0)
    let size = 10 + (d.size || 1) / 2;
    if (size > 25) size = 25;
    if (d.is_central) size *= 1.5;
    return size;
  } else if (d.type === 'document') {
    // Goal nodes (level 1) - make these larger
    return 15; // Increase from the default value (likely around 5-8)
  } else if (d.type === 'strategy') {
    // Strategy nodes (level 2)
    return 6; // Slightly larger than the default for better visibility
  }
  
  // Default for any other node types
  return 5;
}

// Debounce function for search input
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}