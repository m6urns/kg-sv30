"""
Search utilities package for semantic search functionality.

This package provides utility modules for configuration, logging, and metrics
collection used by the semantic search system.
"""

from .config import (
    DEFAULT_MODEL,
    DEFAULT_SCORE_THRESHOLD,
    DEFAULT_TOP_K,
    DEFAULT_SEARCH_TIMEOUT,
    get_embeddings_file_path,
    SYSTEM_LOAD_THRESHOLDS
)

from .metrics import get_metrics, SystemLoadMonitor

__all__ = [
    'DEFAULT_MODEL',
    'DEFAULT_SCORE_THRESHOLD', 
    'DEFAULT_TOP_K',
    'DEFAULT_SEARCH_TIMEOUT',
    'get_embeddings_file_path',
    'SYSTEM_LOAD_THRESHOLDS',
    'get_metrics',
    'SystemLoadMonitor'
]