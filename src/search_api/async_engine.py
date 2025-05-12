"""
Asynchronous processing engine for semantic search.

This module provides asynchronous processing capabilities for handling
search requests efficiently, especially in multi-user scenarios.
"""
import time
import logging
import asyncio
import threading
import uuid
import queue
from typing import Dict, List, Any, Optional, Tuple, Callable, Union

# Import from other modules
from ..search_core.models import get_model_manager
from ..search_core.embeddings import get_embedding_manager
from ..search_core.scoring import get_search_scorer
from ..search_utils.config import (
    DEFAULT_TOP_K,
    DEFAULT_SCORE_THRESHOLD,
    DEFAULT_SEARCH_TIMEOUT,
    SYSTEM_LOAD_THRESHOLDS
)
from ..search_utils.logging import log_method_call, SearchPerformanceLogger
from ..search_utils.metrics import get_metrics

# Set up logging
logger = logging.getLogger(__name__)

class AsyncSearchEngine:
    """
    Provides asynchronous search capabilities with request queuing.
    
    This class manages search requests through a queue system to ensure
    efficient processing, especially in multi-user scenarios with
    potential concurrent search operations.
    """
    
    def __init__(self):
        """Initialize the asynchronous search engine."""
        # Dependencies
        self.model_manager = get_model_manager()
        self.embedding_manager = get_embedding_manager()
        self.scorer = get_search_scorer()
        
        # Request management
        self.query_queue = queue.Queue()
        self.result_queues = {}
        self.worker_thread = None
        self.running = False
        
        # Start the worker thread
        self._start_worker()
    
    def _start_worker(self) -> None:
        """Start the background worker thread for processing requests."""
        if self.worker_thread is not None and self.worker_thread.is_alive():
            return  # Worker already running
        
        self.running = True
        self.worker_thread = threading.Thread(
            target=self._process_query_queue,
            daemon=True
        )
        self.worker_thread.start()
        logger.info("Started async search worker thread")
    
    def _process_query_queue(self) -> None:
        """Background worker to process queued search requests."""
        logger.info("Starting query processor thread")
        while self.running:
            try:
                # Get query from queue with timeout
                query_data = self.query_queue.get(timeout=1.0)
                request_id, query, nodes, options = query_data
                
                # Process the query
                result = self._process_search_request(query, nodes, options)
                
                # Put result in the appropriate result queue
                if request_id in self.result_queues:
                    self.result_queues[request_id].put(result)
            except queue.Empty:
                # Queue timeout, just continue
                continue
            except Exception as e:
                logger.error(f"Error processing query: {e}")
    
    def _process_search_request(self, 
                               query: str, 
                               nodes: List[Dict[str, Any]], 
                               options: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process a single search request.
        
        Args:
            query: Search query string
            nodes: List of node dictionaries
            options: Search options (top_k, score_threshold, timeout)
            
        Returns:
            Dictionary with search results and statistics
        """
        try:
            # Wait for model to be ready
            if not self.model_manager.is_model_ready():
                return {"error": "Model not ready", "results": []}
            
            # Process the search
            start_time = time.time()
            
            # Get options
            top_k = options.get('top_k', DEFAULT_TOP_K)
            score_threshold = options.get('score_threshold', DEFAULT_SCORE_THRESHOLD)
            timeout = options.get('timeout', DEFAULT_SEARCH_TIMEOUT)
            
            # Generate query embedding
            query_embedding = self.embedding_manager.get_embedding(query)
            if query_embedding is None:
                return {"error": "Failed to generate query embedding", "results": []}
            
            # Get embeddings dictionary
            node_embeddings = self.embedding_manager.get_embeddings_dict()
            if not node_embeddings:
                return {"error": "No embeddings available", "results": []}
            
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
            
            # Calculate processing statistics
            elapsed_time = time.time() - start_time
            processed_nodes = min(len(node_embeddings), len(nodes))
            total_nodes = len(nodes)
            
            return {
                "results": results,
                "stats": {
                    "time": elapsed_time,
                    "processed_nodes": processed_nodes,
                    "total_nodes": total_nodes,
                    "timed_out": timeout and time.time() - start_time > timeout,
                    "results_count": len(results)
                }
            }
            
        except Exception as e:
            logger.error(f"Error in search processing: {e}")
            return {"error": str(e), "results": []}
    
    @log_method_call()
    def queue_search_request(self, 
                            query: str, 
                            nodes: List[Dict[str, Any]], 
                            options: Optional[Dict[str, Any]] = None) -> str:
        """
        Queue a search request for asynchronous processing.
        
        Args:
            query: Search query string
            nodes: List of node dictionaries
            options: Search options (top_k, score_threshold, timeout)
            
        Returns:
            str: Request ID for retrieving results later
        """
        if options is None:
            options = {}
        
        # Generate a unique request ID
        request_id = f"search_{time.time()}_{uuid.uuid4().hex[:8]}"
        
        # Create a result queue for this request
        self.result_queues[request_id] = queue.Queue()
        
        # Add to processing queue
        self.query_queue.put((request_id, query, nodes, options))
        
        # Ensure worker is running
        if self.worker_thread is None or not self.worker_thread.is_alive():
            self._start_worker()
        
        # Log and return the request ID
        logger.debug(f"Queued search request: {request_id}")
        return request_id
    
    @log_method_call()
    def get_search_result(self, 
                         request_id: str, 
                         timeout: float = DEFAULT_SEARCH_TIMEOUT) -> Dict[str, Any]:
        """
        Get the result for a queued search request.
        
        Args:
            request_id: Unique ID for the queued request
            timeout: Maximum time to wait for the result in seconds
            
        Returns:
            Dictionary with search results and statistics or error information
        """
        if request_id not in self.result_queues:
            return {"error": "Invalid request ID"}
        
        try:
            # Wait for the result with timeout
            result = self.result_queues[request_id].get(timeout=timeout)
            
            # Clean up the result queue
            del self.result_queues[request_id]
            
            return result
        except queue.Empty:
            return {"error": "Request timed out", "results": []}
        except Exception as e:
            logger.error(f"Error getting search result: {e}")
            return {"error": str(e), "results": []}


class AsyncSearchClient:
    """
    Client API for asynchronous semantic search operations.
    
    This class provides both synchronous and asynchronous interfaces for
    performing semantic search operations with efficient resource management.
    """
    
    def __init__(self):
        """Initialize the async search client."""
        self.engine = AsyncSearchEngine()
        self.model_manager = get_model_manager()
        self.embedding_manager = get_embedding_manager()
    
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
    async def search_async(self,
                          query: str, 
                          nodes: List[Dict[str, Any]],
                          top_k: int = DEFAULT_TOP_K, 
                          score_threshold: float = DEFAULT_SCORE_THRESHOLD,
                          timeout: Optional[float] = DEFAULT_SEARCH_TIMEOUT) -> List[Dict[str, Any]]:
        """
        Perform a semantic search asynchronously.
        
        Args:
            query: Search query string
            nodes: List of node dictionaries from the graph
            top_k: Maximum number of results to return
            score_threshold: Minimum similarity score to include in results
            timeout: Optional timeout in seconds
            
        Returns:
            List of node dictionaries with match information
        """
        if not self.is_available() or not query:
            return []
        
        try:
            # Record the request
            get_metrics().record_request()
            
            # Get system load and adjust timeout if needed
            system_load = get_metrics().get_system_load()
            SearchPerformanceLogger.log_system_load(system_load)
            
            # Adjust timeout based on system load
            adjusted_timeout = timeout
            if system_load > SYSTEM_LOAD_THRESHOLDS['high'] and timeout:
                # Reduce timeout under heavy load
                adjusted_timeout = timeout * 0.7
                logger.info(f"Adjusting timeout for high load: {timeout}s -> {adjusted_timeout}s")
            
            # Prepare search options
            options = {
                'top_k': top_k,
                'score_threshold': score_threshold,
                'timeout': adjusted_timeout
            }
            
            # Queue the search request
            request_id = self.engine.queue_search_request(query, nodes, options)
            
            # Use asyncio to wait for results without blocking the event loop
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                lambda: self.engine.get_search_result(request_id, timeout=timeout or 30.0)
            )
            
            # Check for errors
            if "error" in result:
                logger.error(f"Search error: {result['error']}")
                get_metrics().record_error("search_error")
                return []
            
            # Return the results
            return result.get("results", [])
            
        except Exception as e:
            logger.error(f"Error in async semantic search: {e}")
            get_metrics().record_error("async_search_error")
            return []
    
    @log_method_call()
    def search(self,
              query: str, 
              nodes: List[Dict[str, Any]],
              top_k: int = DEFAULT_TOP_K, 
              score_threshold: float = DEFAULT_SCORE_THRESHOLD,
              timeout: Optional[float] = DEFAULT_SEARCH_TIMEOUT) -> List[Dict[str, Any]]:
        """
        Perform a semantic search synchronously (wrapper for async method).
        
        Args:
            query: Search query string
            nodes: List of node dictionaries from the graph
            top_k: Maximum number of results to return
            score_threshold: Minimum similarity score to include in results
            timeout: Optional timeout in seconds
            
        Returns:
            List of node dictionaries with match information
        """
        # Create event loop if needed
        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            # Create a new event loop if none exists
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
        
        # Run the async search
        return loop.run_until_complete(
            self.search_async(query, nodes, top_k, score_threshold, timeout)
        )


# Create a function to get an AsyncSearchClient instance
def get_async_search_client() -> AsyncSearchClient:
    """
    Get a new instance of AsyncSearchClient.
    
    Returns:
        AsyncSearchClient: A new instance
    """
    return AsyncSearchClient()