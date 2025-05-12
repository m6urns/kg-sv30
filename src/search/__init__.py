"""
Semantic search module for knowledge graph and document search.

This module provides the main entry point for performing semantic search
operations on the knowledge graph and text content.
"""
import logging
import time
from typing import Dict, List, Any, Optional, Union

# Import the API components
from ..search_api.client import get_search_client
from ..search_api.async_engine import get_async_search_client
from ..search_api.performance import get_performance_optimizer
from ..search_utils.config import (
    DEFAULT_TOP_K,
    DEFAULT_SCORE_THRESHOLD,
    DEFAULT_SEARCH_TIMEOUT,
    get_embeddings_file_path
)

# Set up logging
logger = logging.getLogger(__name__)

def initialize_search_system(wait_for_model: bool = True, timeout: float = 30.0) -> bool:
    """
    Initialize the semantic search system.

    This function loads embeddings and starts the performance monitoring.
    It should be called once at application startup.

    Args:
        wait_for_model: Whether to wait for the model to be fully loaded
        timeout: Maximum time to wait for model loading (in seconds)

    Returns:
        bool: True if initialization was successful, False otherwise
    """
    try:
        # Start performance monitoring
        optimizer = get_performance_optimizer()
        optimizer.start_monitoring()

        # Initialize the search client and load embeddings
        client = get_search_client()

        # First load the embeddings
        embeddings_loaded = client.load_embeddings()
        if not embeddings_loaded:
            logger.warning("Semantic search initialization failed to load embeddings")
            return False

        # If requested, wait for the model to be fully loaded before returning
        if wait_for_model:
            logger.info("Waiting for semantic search model to load (max wait: {}s)...".format(timeout))

            start_time = time.time()
            while time.time() - start_time < timeout:
                if client.is_available():
                    logger.info(f"Semantic search model loaded successfully in {time.time() - start_time:.2f}s")
                    logger.info("Semantic search system initialized successfully")
                    return True

                # Sleep briefly to avoid busy-waiting
                time.sleep(0.5)

            # If we reach here, model loading timed out
            logger.warning(f"Semantic search model loading timed out after {timeout}s")
            return False

        logger.info("Semantic search system initialization started (async model loading)")
        return True
    except Exception as e:
        logger.error(f"Error initializing semantic search system: {e}")
        return False

def perform_semantic_search(query: str, 
                          nodes: List[Dict[str, Any]],
                          top_k: int = DEFAULT_TOP_K,
                          score_threshold: float = DEFAULT_SCORE_THRESHOLD,
                          timeout: Optional[float] = DEFAULT_SEARCH_TIMEOUT,
                          use_async: bool = True) -> List[Dict[str, Any]]:
    """
    Perform semantic search using the provided query.
    
    This is the main function for performing semantic search that should
    be called by application code.
    
    Args:
        query: Search query string
        nodes: List of node dictionaries from the graph
        top_k: Maximum number of results to return
        score_threshold: Minimum similarity score to include in results
        timeout: Optional timeout in seconds
        use_async: Whether to use the async search client
        
    Returns:
        List of node dictionaries with match information
    """
    try:
        if use_async:
            # Use the async client for better concurrency
            client = get_async_search_client()
        else:
            # Use the standard client
            client = get_search_client()
        
        # Check if semantic search is available
        if not client.is_available():
            logger.warning("Semantic search is not available (model not loaded)")
            return []
        
        # Perform the search
        results = client.search(
            query=query,
            nodes=nodes,
            top_k=top_k,
            score_threshold=score_threshold,
            timeout=timeout
        )
        
        return results
    except Exception as e:
        logger.error(f"Error in semantic search: {e}")
        return []

def get_system_status() -> Dict[str, Any]:
    """
    Get the current status of the semantic search system.
    
    Returns:
        Dictionary with status information
    """
    try:
        client = get_search_client()
        optimizer = get_performance_optimizer()
        
        # Get model information
        model_info = client.get_model_info()
        
        # Get embedding cache statistics
        cache_stats = client.get_cache_stats()
        
        # Get performance metrics
        performance = optimizer.get_performance_summary()
        
        return {
            "available": client.is_available(),
            "model": model_info,
            "cache": cache_stats,
            "performance": performance
        }
    except Exception as e:
        logger.error(f"Error getting system status: {e}")
        return {"available": False, "error": str(e)}