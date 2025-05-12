"""
Specialized logging for semantic search functionality.

This module provides logging utilities and formatters specifically for
search system operations and performance metrics.
"""
import logging
import time
from functools import wraps
from typing import Callable, Any, Dict, Optional, List, Tuple

# Configure module logger
logger = logging.getLogger(__name__)

def log_method_call(log_args: bool = False):
    """
    Decorator for logging method calls.
    
    Args:
        log_args: Whether to log method arguments
    
    Returns:
        Decorator function
    """
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        def wrapper(*args, **kwargs):
            start_time = time.time()
            class_name = args[0].__class__.__name__ if args else ""
            
            # Log method call with or without arguments
            if log_args:
                # Filter out sensitive args if needed
                safe_kwargs = {k: v for k, v in kwargs.items() 
                              if k not in ['password', 'token', 'key']}
                logger.debug(f"{class_name}.{func.__name__} called with kwargs: {safe_kwargs}")
            else:
                logger.debug(f"{class_name}.{func.__name__} called")
            
            try:
                result = func(*args, **kwargs)
                end_time = time.time()
                execution_time = end_time - start_time
                
                # Log execution time if it exceeds threshold
                if execution_time > 0.1:  # Only log if execution took more than 100ms
                    logger.debug(f"{class_name}.{func.__name__} execution time: {execution_time:.3f}s")
                
                return result
            except Exception as e:
                logger.error(f"Error in {class_name}.{func.__name__}: {e}")
                raise
                
        return wrapper
    return decorator

def log_search_stats(stats: Dict[str, Any]) -> None:
    """
    Log search statistics in a structured format.
    
    Args:
        stats: Dictionary of search statistics
    """
    search_time = stats.get('time', 0)
    processed_nodes = stats.get('processed_nodes', 0)
    total_nodes = stats.get('total_nodes', 0)
    timed_out = stats.get('timed_out', False)
    results_count = stats.get('results_count', 0)
    
    message = (
        f"Search completed in {search_time:.2f}s "
        f"[nodes: {processed_nodes}/{total_nodes}, "
        f"results: {results_count}"
    )
    
    if timed_out:
        message += ", TIMED OUT]"
        logger.warning(message)
    else:
        message += "]"
        logger.info(message)

class SearchPerformanceLogger:
    """Utility class for logging search performance metrics."""
    
    @staticmethod
    def log_embedding_cache_stats(hits: int, misses: int) -> None:
        """
        Log embedding cache performance.
        
        Args:
            hits: Number of cache hits
            misses: Number of cache misses
        """
        total = hits + misses
        if total > 0:
            hit_rate = (hits / total) * 100
            logger.info(f"Embedding cache: {hits} hits, {misses} misses ({hit_rate:.1f}% hit rate)")
    
    @staticmethod
    def log_system_load(load: float) -> None:
        """
        Log current system load.
        
        Args:
            load: System load value (0.0-1.0)
        """
        if load > 0.8:
            logger.warning(f"High system load: {load:.2f}")
        elif load > 0.5:
            logger.info(f"Medium system load: {load:.2f}")
        else:
            logger.debug(f"Current system load: {load:.2f}")
    
    @staticmethod
    def log_search_query(query: str, request_id: str, timeout: Optional[float] = None) -> None:
        """
        Log a search query event.
        
        Args:
            query: The search query string
            request_id: Unique identifier for the search request
            timeout: Optional timeout value in seconds
        """
        timeout_info = f", timeout: {timeout:.1f}s" if timeout else ""
        logger.info(f"Search query: '{query}' [request_id: {request_id}{timeout_info}]")