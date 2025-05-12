"""
Caching mechanisms for semantic search functionality.

This module provides caching utilities for search results, embeddings,
and other expensive operations to improve search performance.
"""
import time
import logging
import threading
from functools import lru_cache
from typing import Dict, List, Any, Optional, Union, Callable, TypeVar, Generic

# Import from other modules
from ..search_utils.logging import log_method_call
from ..search_utils.metrics import get_metrics

# Set up logging
logger = logging.getLogger(__name__)

# Define generic type variables for cache keys and values
K = TypeVar('K')
V = TypeVar('V')

class ExpiringCache(Generic[K, V]):
    """
    Thread-safe cache with expiring entries.
    
    This class provides a dictionary-like cache where entries automatically
    expire after a specified time period.
    """
    
    def __init__(self, expiry_seconds: float = 900.0, max_size: int = 100):
        """
        Initialize the expiring cache.
        
        Args:
            expiry_seconds: Time in seconds before entries expire
            max_size: Maximum number of items to store in the cache
        """
        self.expiry_seconds = expiry_seconds
        self.max_size = max_size
        self.cache = {}  # Dict[K, Tuple[V, float]]
        self.lock = threading.Lock()
        self.last_cleanup = time.time()
        self.cleanup_interval = expiry_seconds / 3  # Clean up every third of expiry time
    
    @log_method_call()
    def get(self, key: K) -> Optional[V]:
        """
        Get a value from the cache if it exists and hasn't expired.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found or expired
        """
        self._maybe_cleanup()
        
        with self.lock:
            if key in self.cache:
                value, timestamp = self.cache[key]
                # Check if expired
                if time.time() - timestamp <= self.expiry_seconds:
                    get_metrics().record_cache_event(True)  # Record cache hit
                    return value
                else:
                    # Remove expired entry
                    del self.cache[key]
            
            get_metrics().record_cache_event(False)  # Record cache miss
            return None
    
    @log_method_call()
    def set(self, key: K, value: V) -> None:
        """
        Store a value in the cache with the current timestamp.
        
        Args:
            key: Cache key
            value: Value to store
        """
        self._maybe_cleanup()
        
        with self.lock:
            # If cache is full, remove oldest entry
            if len(self.cache) >= self.max_size and key not in self.cache:
                self._remove_oldest_entry()
            
            # Store value with current timestamp
            self.cache[key] = (value, time.time())
    
    @log_method_call()
    def clear(self) -> None:
        """Clear all entries from the cache."""
        with self.lock:
            self.cache.clear()
    
    def _maybe_cleanup(self) -> None:
        """
        Perform cleanup if enough time has passed since the last cleanup.
        This helps avoid performance issues from frequent cleanups.
        """
        current_time = time.time()
        if current_time - self.last_cleanup > self.cleanup_interval:
            self._cleanup()
            self.last_cleanup = current_time
    
    def _cleanup(self) -> None:
        """Remove all expired entries from the cache."""
        with self.lock:
            current_time = time.time()
            keys_to_remove = []
            
            # Find expired keys
            for key, (value, timestamp) in self.cache.items():
                if current_time - timestamp > self.expiry_seconds:
                    keys_to_remove.append(key)
            
            # Remove expired keys
            for key in keys_to_remove:
                del self.cache[key]
            
            if keys_to_remove:
                logger.debug(f"Removed {len(keys_to_remove)} expired cache entries")
    
    def _remove_oldest_entry(self) -> None:
        """Remove the oldest entry from the cache."""
        if not self.cache:
            return
            
        # Find the key with the oldest timestamp
        oldest_key = None
        oldest_time = float('inf')
        
        for key, (value, timestamp) in self.cache.items():
            if timestamp < oldest_time:
                oldest_time = timestamp
                oldest_key = key
        
        # Remove the oldest entry
        if oldest_key is not None:
            del self.cache[oldest_key]


class SearchResultCache:
    """
    Cache for storing search results to avoid redundant computations.
    
    This class provides methods for caching and retrieving search results
    based on query text and search parameters.
    """
    
    def __init__(self, expiry_seconds: float = 300.0, max_size: int = 50):
        """
        Initialize the search result cache.
        
        Args:
            expiry_seconds: Time in seconds before entries expire
            max_size: Maximum number of queries to cache
        """
        self.cache = ExpiringCache(expiry_seconds=expiry_seconds, max_size=max_size)
    
    @log_method_call()
    def get(self, query: str, params: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
        """
        Get cached search results for a query and parameter set.
        
        Args:
            query: Search query text
            params: Search parameters like top_k, score_threshold, etc.
            
        Returns:
            Cached search results or None if not in cache
        """
        # Create cache key from query and relevant parameters
        cache_key = self._create_cache_key(query, params)
        return self.cache.get(cache_key)
    
    @log_method_call()
    def set(self, query: str, params: Dict[str, Any], results: List[Dict[str, Any]]) -> None:
        """
        Store search results in the cache.
        
        Args:
            query: Search query text
            params: Search parameters
            results: Search results to cache
        """
        cache_key = self._create_cache_key(query, params)
        self.cache.set(cache_key, results)
    
    def _create_cache_key(self, query: str, params: Dict[str, Any]) -> str:
        """
        Create a cache key from a query and parameter set.
        
        Args:
            query: Search query text
            params: Search parameters
            
        Returns:
            String key for the cache
        """
        # Extract only the parameters that affect search results
        relevant_params = {
            'top_k': params.get('top_k', 10),
            'score_threshold': params.get('score_threshold', 0.3)
        }
        
        # Create a string representation of the parameters
        params_str = ','.join(f"{k}:{v}" for k, v in sorted(relevant_params.items()))
        
        # Combine query and parameters into a single key
        return f"{query}|{params_str}"