// Utility functions for the Strategic Vision Navigator

// Calculate node size consistently throughout the application
function calculateNodeSize(d) {
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

// Debounce function for search input
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}