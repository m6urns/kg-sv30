"""
Search API package for semantic search functionality.

This package provides high-level APIs for applications to perform
semantic search operations, with both synchronous and asynchronous
interfaces and performance optimization features.
"""

from .client import get_search_client, SearchClient
from .async_engine import get_async_search_client, AsyncSearchClient
from .performance import get_performance_optimizer

__all__ = [
    'get_search_client',
    'SearchClient',
    'get_async_search_client',
    'AsyncSearchClient',
    'get_performance_optimizer'
]