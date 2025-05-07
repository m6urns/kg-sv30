/**
 * Analytics Module for Strategic Vision Navigator
 * 
 * This module handles anonymous collection of user interaction data to improve the application.
 * All data collected is anonymous and used only for understanding feature usage patterns.
 */

// Event categories and types defined to match server-side schema
export const EVENT_CATEGORIES = {
  PAGE_VIEW: 'page_view',
  NODE_INTERACTION: 'node_interaction',
  SEARCH: 'search',
  FEATURE_USAGE: 'feature_usage',
  ERROR: 'error'
};

// Queue to batch events and reduce API calls
let eventQueue = [];
const MAX_QUEUE_SIZE = 10;
const MAX_QUEUE_AGE_MS = 30000; // 30 seconds

// Session information
let sessionId = null;
let isAnalyticsEnabled = true;
let lastQueueFlush = Date.now();
let userOptOut = false;

// Track performance metrics
const performanceMetrics = {
  initialLoadTime: 0,
  searchResponseTimes: [],
  nodeDetailsLoadTimes: []
};

/**
 * Initialize the analytics module
 */
export async function initializeAnalytics() {
  // Check for opt-out cookie
  userOptOut = document.cookie.includes('sv_analytics_opt_out=true');
  
  if (userOptOut) {
    console.log('User has opted out of analytics');
    isAnalyticsEnabled = false;
    return;
  }
  
  try {
    // Generate a local session ID in case the server request fails
    // This ensures we can still track events even if the session endpoint is blocked
    sessionId = 'local_' + Math.random().toString(36).substring(2, 15);
    
    try {
      // Fetch or create a session ID from server - use alternative endpoint less likely to be blocked
      const response = await fetch('/api/usage/session');
      if (response.ok) {
        const data = await response.json();
        if (data && data.session_id) {
          sessionId = data.session_id;
          console.log('Usage tracking session established');
        }
      } else {
        console.warn('Using local session ID due to server response:', response.status);
      }
    } catch (sessionError) {
      console.warn('Using local analytics session ID due to error:', sessionError.message);
      // Continue with local session ID
    }
    
    // Enable analytics regardless of session API success
    isAnalyticsEnabled = true;
    
    // Record page view event
    trackEvent(
      EVENT_CATEGORIES.PAGE_VIEW,
      'initial_load',
      window.location.pathname,
      0,
      { referrer: document.referrer || 'direct' }
    );
    
    // Set up periodic queue flush
    setInterval(flushEventQueue, MAX_QUEUE_AGE_MS);
    
    // Set up performance tracking
    trackPerformance();
    
  } catch (error) {
    console.error('Error in analytics initialization:', error);
    isAnalyticsEnabled = false;
  }
}

/**
 * Track a user interaction event
 * 
 * @param {string} category - Event category (from EVENT_CATEGORIES)
 * @param {string} eventType - Specific event type
 * @param {string} eventValue - Primary value for the event (e.g., node ID, search query)
 * @param {number} durationMs - Duration in milliseconds (if applicable)
 * @param {Object} metadata - Additional event data
 */
export function trackEvent(category, eventType, eventValue = '', durationMs = 0, metadata = {}) {
  try {
    // Respect user opt-out
    if (!isAnalyticsEnabled || userOptOut) return;
    
    // Ensure we have a session ID
    if (!sessionId) {
      // Create a temporary local session ID
      sessionId = 'local_' + Math.random().toString(36).substring(2, 15);
      console.warn('Using temporary local session ID for analytics');
      
      // Try to reinitialize in the background
      setTimeout(() => {
        initializeAnalytics().catch(err => {
          console.warn('Background analytics initialization failed:', err.message);
        });
      }, 100);
    }
    
    // Sanitize inputs to prevent errors
    const cleanCategory = String(category || 'unknown');
    const cleanEventType = String(eventType || 'unknown');
    const cleanEventValue = String(eventValue || '');
    const cleanDurationMs = Number.isFinite(durationMs) ? durationMs : 0;
    
    // Ensure metadata is an object
    let cleanMetadata = {};
    if (metadata && typeof metadata === 'object') {
      try {
        // Convert to string and back to ensure it's JSON serializable
        cleanMetadata = JSON.parse(JSON.stringify(metadata));
      } catch (e) {
        cleanMetadata = { error: 'Non-serializable metadata' };
      }
    }
    
    // Create the event object
    const event = {
      category: cleanCategory,
      event_type: cleanEventType,
      event_value: cleanEventValue,
      duration_ms: cleanDurationMs,
      metadata: cleanMetadata
    };
    
    // Add to queue
    eventQueue.push(event);
    
    // Flush queue if full or if it's been too long since last flush
    if (eventQueue.length >= MAX_QUEUE_SIZE || Date.now() - lastQueueFlush >= MAX_QUEUE_AGE_MS) {
      flushEventQueue().catch(err => {
        console.warn('Queue flush error:', err.message);
      });
    }
  } catch (error) {
    console.error('Error tracking event:', error);
    // Fail silently to avoid affecting the user experience
  }
}

/**
 * Send queued events to the server
 */
async function flushEventQueue() {
  // Skip if disabled or no events
  if (!isAnalyticsEnabled || eventQueue.length === 0) return;
  
  try {
    // Clone the current queue and reset it
    const eventsToSend = [...eventQueue];
    eventQueue = [];
    lastQueueFlush = Date.now();
    
    // Send each event individually 
    // (could be optimized to send in batches if server supports it)
    for (const event of eventsToSend) {
      try {
        const response = await fetch('/api/usage/event', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(event),
          credentials: 'include' // Include cookies for session ID
        });
        
        if (!response.ok) {
          console.warn(`Analytics event not recorded. Status: ${response.status}`);
        }
      } catch (fetchError) {
        // Skip this event if it fails, but continue with others
        console.warn(`Failed to send analytics event: ${fetchError.message}`);
      }
    }
  } catch (error) {
    console.error('Error in analytics event queue processing:', error);
    // We don't add back to the queue in case of error to avoid any cascading issues
  }
}

/**
 * Track application performance metrics
 */
function trackPerformance() {
  // Track initial page load time
  if (window.performance) {
    // Use Navigation Timing API if available
    if (performance.timing) {
      const timing = performance.timing;
      const loadTime = timing.loadEventEnd - timing.navigationStart;
      performanceMetrics.initialLoadTime = loadTime;
      
      // Record page load performance
      trackEvent(
        EVENT_CATEGORIES.PAGE_VIEW,
        'performance',
        'page_load',
        loadTime,
        {
          domContentLoaded: timing.domContentLoadedEventEnd - timing.navigationStart,
          firstPaint: timing.responseEnd - timing.navigationStart
        }
      );
    } 
    // For newer browsers, use PerformanceObserver API
    else if (typeof PerformanceObserver !== 'undefined') {
      try {
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            if (entry.entryType === 'navigation') {
              const loadTime = entry.loadEventEnd - entry.startTime;
              performanceMetrics.initialLoadTime = loadTime;
              
              trackEvent(
                EVENT_CATEGORIES.PAGE_VIEW,
                'performance',
                'page_load',
                loadTime,
                {
                  domContentLoaded: entry.domContentLoadedEventEnd - entry.startTime,
                  firstPaint: entry.responseEnd - entry.startTime
                }
              );
            }
          }
        });
        observer.observe({ entryTypes: ['navigation'] });
      } catch (e) {
        // PerformanceObserver may not be supported or may fail
        console.warn('Performance tracking not fully supported');
      }
    }
  }
}

/**
 * Track node interaction events
 * 
 * @param {string} nodeId - ID of the node
 * @param {string} interactionType - Type of interaction
 * @param {Object} nodeData - Additional node information
 */
export function trackNodeInteraction(nodeId, interactionType, nodeData = {}) {
  trackEvent(
    EVENT_CATEGORIES.NODE_INTERACTION,
    interactionType,
    nodeId,
    0,
    {
      nodeType: nodeData.type || 'unknown',
      source: 'graph_view'
    }
  );
}

/**
 * Track search events
 * 
 * @param {string} query - Search query
 * @param {number} resultCount - Number of results
 * @param {number} responseTimeMs - Search response time
 */
export function trackSearch(query, resultCount, responseTimeMs = 0) {
  // Track response time for performance monitoring
  if (responseTimeMs > 0) {
    performanceMetrics.searchResponseTimes.push(responseTimeMs);
  }
  
  // Determine event type based on results
  const eventType = resultCount > 0 ? 'search_query' : 'no_results';
  
  trackEvent(
    EVENT_CATEGORIES.SEARCH,
    eventType,
    query,
    responseTimeMs,
    {
      resultCount
    }
  );
}

/**
 * Track when a user clicks on a search result
 * 
 * @param {string} query - The search query
 * @param {string} resultId - ID of the clicked result
 * @param {number} resultPosition - Position in the result list
 */
export function trackSearchResultClick(query, resultId, resultPosition) {
  trackEvent(
    EVENT_CATEGORIES.SEARCH,
    'search_result_click',
    resultId,
    0,
    {
      query,
      position: resultPosition
    }
  );
}

/**
 * Track feature usage events
 * 
 * @param {string} feature - Feature name
 * @param {string} action - Action performed
 * @param {Object} details - Additional details
 */
export function trackFeatureUsage(feature, action, details = {}) {
  trackEvent(
    EVENT_CATEGORIES.FEATURE_USAGE,
    feature,
    action,
    0,
    details
  );
}

/**
 * Track error events
 * 
 * @param {string} errorType - Type of error
 * @param {string} message - Error message
 * @param {Object} details - Additional error details
 */
export function trackError(errorType, message, details = {}) {
  trackEvent(
    EVENT_CATEGORIES.ERROR,
    errorType,
    message,
    0,
    details
  );
}

/**
 * Allow user to opt out of analytics
 */
export function optOut() {
  // Set opt-out cookie (1 year expiry)
  const expiryDate = new Date();
  expiryDate.setFullYear(expiryDate.getFullYear() + 1);
  document.cookie = `sv_analytics_opt_out=true; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
  
  // Disable analytics
  isAnalyticsEnabled = false;
  userOptOut = true;
  
  // Clear any queued events
  eventQueue = [];
  
  return true;
}

/**
 * Allow user to opt back into analytics
 */
export function optIn() {
  // Remove opt-out cookie
  document.cookie = 'sv_analytics_opt_out=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax';
  
  // Re-enable analytics
  userOptOut = false;
  isAnalyticsEnabled = true;
  
  // Reinitialize
  initializeAnalytics();
  
  return true;
}

/**
 * Check if user has opted out of analytics
 */
export function isOptedOut() {
  return userOptOut;
}

// Legacy function - disable Cloudflare analytics if present
export function disableCloudflareAnalytics() {
  // Prevent Cloudflare analytics from loading if it exists
  if (window.cflare) {
    window.cflare.beacon = function() {};
  }
}

// Initialize analytics when module loads
initializeAnalytics();

// Still run the CF disabler for backwards compatibility
disableCloudflareAnalytics();

// Make analytics functions available globally for debugging
window.analyticsTools = {
  trackEvent,
  trackNodeInteraction,
  trackSearch,
  trackSearchResultClick,
  trackFeatureUsage,
  trackError,
  optOut,
  optIn,
  isOptedOut
};