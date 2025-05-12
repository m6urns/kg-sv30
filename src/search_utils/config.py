"""
Configuration management for semantic search functionality.

This module provides configuration settings and constants for the semantic search system.
"""
import os
import logging
from typing import Dict, Any

# Set up logging
logger = logging.getLogger(__name__)

# Default model to use for embeddings
DEFAULT_MODEL = 'all-MiniLM-L6-v2'

# Default score threshold for semantic matching
DEFAULT_SCORE_THRESHOLD = 0.3

# Default number of top results to return
DEFAULT_TOP_K = 10

# Default timeout for search operations in seconds
DEFAULT_SEARCH_TIMEOUT = 30.0

# Maximum worker threads for search processing
MAX_WORKER_THREADS = 4

# Embedding cache size for LRU cache
EMBEDDING_CACHE_SIZE = 1000

# Path configurations
def get_embeddings_file_path() -> str:
    """
    Get the path to the embeddings JSON file.
    
    Returns:
        str: Absolute path to the embeddings.json file
    """
    try:
        script_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        base_dir = os.path.dirname(script_dir)
        return os.path.join(base_dir, 'static', 'embeddings.json')
    except Exception as e:
        logger.error(f"Error determining embeddings file path: {e}")
        return os.path.join(os.getcwd(), 'static', 'embeddings.json')

# Performance configuration
SYSTEM_LOAD_THRESHOLDS = {
    'low': 0.3,    # Low load
    'medium': 0.6, # Medium load
    'high': 0.8    # High load, apply optimizations
}

# Search configuration adjustments based on system load
LOAD_ADJUSTMENTS = {
    'timeout_factor': {
        'low': 1.0,    # No adjustment
        'medium': 0.9, # 10% reduction
        'high': 0.7    # 30% reduction
    },
    'batch_size': {
        'low': 1000,   # Process more nodes at once
        'medium': 500, # Medium batch size
        'high': 200    # Small batch size to reduce memory pressure
    }
}