"""
Analytics Schema Definition

This module defines the structure for event tracking in the Strategic Vision Navigator.
"""

# Primary event categories
EVENT_CATEGORIES = {
    'page_view': 'Page view events',
    'node_interaction': 'Node interaction events',
    'search': 'Search-related events',
    'feature_usage': 'Feature usage events',
    'error': 'Error events'
}

# Specific event types by category
EVENT_TYPES = {
    'page_view': [
        'initial_load',
        'graph_load',
        'return_visit'
    ],
    'node_interaction': [
        'node_click',
        'node_details_view',
        'node_hover',
        'graph_zoom',
        'graph_pan',
        'focus_mode_toggle',
        'cluster_expand'
    ],
    'search': [
        'search_query',
        'search_result_click',
        'advanced_search',
        'no_results'
    ],
    'feature_usage': [
        'cluster_panel_open',
        'filter_apply',
        'navigation_back',
        'navigation_forward',
        'data_download',
        'help_view'
    ],
    'error': [
        'api_error',
        'rendering_error',
        'data_loading_error'
    ]
}

# CSV column headers for analytics events
CSV_HEADERS = [
    'timestamp',      # ISO format timestamp
    'session_id',     # Anonymous session identifier
    'category',       # Event category from EVENT_CATEGORIES
    'event_type',     # Specific event type from EVENT_TYPES
    'event_value',    # Primary value related to the event (e.g., node ID, search query)
    'duration_ms',    # Duration in milliseconds (if applicable)
    'metadata'        # JSON-encoded string with additional event data
]

# Session ID generation method
SESSION_ID_COOKIE = 'sv_analytics_session'
SESSION_EXPIRY_DAYS = 7

# File paths and rotation
ANALYTICS_DIR = 'analytics_data'
DAILY_FILE_FORMAT = 'events_%Y-%m-%d.csv'  # Will be formatted with date
MAX_FILE_AGE_DAYS = 90  # For optional cleanup job

# Sample event structure for documentation
SAMPLE_EVENT = {
    'timestamp': '2023-06-01T15:30:45.123Z',
    'session_id': 'anon_abc123def456',
    'category': 'node_interaction',
    'event_type': 'node_click',
    'event_value': 'topic_123',
    'duration_ms': 0,
    'metadata': '{"nodeType":"topic","source":"graph_view"}'
}