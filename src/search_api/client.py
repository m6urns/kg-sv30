"""
Client interface for semantic search functionality.

This module provides a clean, simple client API for applications to
perform semantic search operations without needing to know the
underlying implementation details.
"""
import logging
import time
import uuid
from typing import Dict, List, Any, Optional, Union

# Import from other modules
from ..search_core.models import get_model_manager
from ..search_core.embeddings import get_embedding_manager
from ..search_core.scoring import get_search_scorer
from ..search_core.cache import SearchResultCache
from ..search_utils.config import (
    DEFAULT_TOP_K, 
    DEFAULT_SCORE_THRESHOLD,
    DEFAULT_SEARCH_TIMEOUT
)
from ..search_utils.logging import log_method_call
from ..search_utils.metrics import get_metrics

# Set up logging
logger = logging.getLogger(__name__)

class SearchClient:
    """
    Client API for performing semantic search operations.
    
    This class provides a simple interface for applications to perform
    semantic search without needing to interact with the underlying
    implementation details.
    """
    
    def __init__(self):
        """Initialize the search client with required components."""
        self.model_manager = get_model_manager()
        self.embedding_manager = get_embedding_manager()
        self.scorer = get_search_scorer()
        self.result_cache = SearchResultCache()
    
    @log_method_call()
    def is_available(self) -> bool:
        """
        Check if semantic search is available (model loaded).
        
        Returns:
            bool: True if the search system is ready, False otherwise
        """
        return self.model_manager.is_model_ready()
    
    @log_method_call()
    def load_embeddings(self, file_path: Optional[str] = None) -> bool:
        """
        Load embeddings from a JSON file.
        
        Args:
            file_path: Path to the embeddings JSON file,
                      or None to use the default path
                      
        Returns:
            bool: True if embeddings were loaded successfully, False otherwise
        """
        return self.embedding_manager.load_embeddings(file_path)
    
    @log_method_call()
    def search(self,
              query: str, 
              nodes: List[Dict[str, Any]],
              top_k: int = DEFAULT_TOP_K, 
              score_threshold: float = DEFAULT_SCORE_THRESHOLD,
              timeout: Optional[float] = DEFAULT_SEARCH_TIMEOUT,
              use_cache: bool = True) -> List[Dict[str, Any]]:
        """
        Perform a semantic search using the provided query.
        
        Args:
            query: Search query string
            nodes: List of node dictionaries from the graph
            top_k: Maximum number of results to return
            score_threshold: Minimum similarity score to include in results
            timeout: Optional timeout in seconds
            use_cache: Whether to use the result cache
            
        Returns:
            List of node dictionaries with match information
        """
        # Check if search is available
        if not self.is_available() or not query:
            logger.warning("Semantic search not available or query is empty")
            return []
        
        # Record the request in metrics
        get_metrics().record_request()
        
        # Generate a unique request ID for tracking
        request_id = f"search_{time.time()}_{uuid.uuid4().hex[:8]}"
        
        try:
            # Check cache first if enabled
            if use_cache:
                cached_results = self.result_cache.get(query, {
                    'top_k': top_k,
                    'score_threshold': score_threshold
                })
                
                if cached_results is not None:
                    logger.info(f"Cache hit for query: '{query}' [request_id: {request_id}]")
                    return cached_results
            
            # Generate query embedding
            start_time = time.time()
            query_embedding = self.embedding_manager.get_embedding(query)
            
            if query_embedding is None:
                logger.error(f"Failed to generate query embedding for: '{query}'")
                get_metrics().record_error("embedding_generation_failed")
                return []
            
            # Get the embeddings dictionary
            node_embeddings = self.embedding_manager.get_embeddings_dict()
            if not node_embeddings:
                logger.error("No embeddings available for search")
                get_metrics().record_error("no_embeddings")
                return []
            
            # Score nodes
            results = self.scorer.score_nodes(
                query_embedding=query_embedding,
                nodes=nodes,
                node_embeddings=node_embeddings,
                score_threshold=score_threshold,
                timeout=timeout
            )
            
            # Limit to top_k results
            results = self.scorer.limit_results(results, top_k)
            
            # Scale scores to be comparable with keyword search
            results = self.scorer.scale_scores(results)
            
            # Cache results if enabled
            if use_cache:
                self.result_cache.set(query, {
                    'top_k': top_k,
                    'score_threshold': score_threshold
                }, results)
            
            return results
            
        except Exception as e:
            logger.error(f"Error in semantic search: {e}")
            get_metrics().record_error("search_error")
            return []
    
    @log_method_call()
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the loaded model.
        
        Returns:
            Dict containing model name, dimensions, and status
        """
        return self.model_manager.get_model_info()
    
    @log_method_call()
    def get_cache_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.
        
        Returns:
            Dict containing embedding cache statistics
        """
        return self.embedding_manager.get_cache_stats()


# Create a function to get a SearchClient instance
def get_search_client() -> SearchClient:
    """
    Get a new instance of SearchClient.
    
    Returns:
        SearchClient: A new instance
    """
    return SearchClient()