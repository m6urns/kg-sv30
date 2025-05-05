// Analytics protection script
// This module handles preventing CF analytics from loading if present

export function disableCloudflareAnalytics() {
  // Prevent Cloudflare analytics from loading if it exists
  if (window.cflare) {
    window.cflare.beacon = function() {};
  }
}

// Run this as soon as the module loads
disableCloudflareAnalytics();