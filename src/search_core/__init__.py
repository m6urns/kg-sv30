"""
Core search functionality package for semantic search.

This package provides the foundational components for semantic search,
including model management, embedding generation, similarity scoring,
and caching.
"""

from .models import get_model_manager
from .embeddings import get_embedding_manager
from .scoring import get_search_scorer
from .cache import SearchResultCache, ExpiringCache

__all__ = [
    'get_model_manager',
    'get_embedding_manager',
    'get_search_scorer',
    'SearchResultCache',
    'ExpiringCache'
]