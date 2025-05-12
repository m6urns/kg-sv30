"""
Enhanced semantic search functionality with multi-user support.
Provides optimized embedding generation and vector similarity search for concurrent users.
"""
import os
import json
import logging
import time
import asyncio
import threading
import numpy as np
from typing import Dict, List, Any, Tuple, Optional, Union
import multiprocessing as mp
from multiprocessing import Manager
from functools import lru_cache
import queue
from concurrent.futures import ThreadPoolExecutor

# Set up logging
logger = logging.getLogger(__name__)

# Handle import errors gracefully
try:
    from sentence_transformers import SentenceTransformer
    EMBEDDINGS_AVAILABLE = True
    logger.info("Successfully imported sentence-transformers")
except ImportError as e:
    logger.warning(f"Could not import sentence-transformers: {e}")
    EMBEDDINGS_AVAILABLE = False
except Exception as e:
    logger.warning(f"Unexpected error importing sentence-transformers: {e}")
    EMBEDDINGS_AVAILABLE = False

# Default model to use for embeddings
DEFAULT_MODEL = 'all-MiniLM-L6-v2'

# Shared model and resource manager
class ModelManager:
    """Singleton manager for shared model resources across workers."""
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ModelManager, cls).__new__(cls)
                cls._instance._initialize()
            return cls._instance
    
    def _initialize(self):
        """Initialize the model manager resources."""
        self.process_manager = Manager()
        self.model_ready = threading.Event()
        self.model_ready.clear()
        self.model = None
        self.dimensions = 0
        self.embedding_cache = self.process_manager.dict()
        self.cache_stats = self.process_manager.dict({'hits': 0, 'misses': 0})
        self.query_queue = self.process_manager.Queue()
        self.result_queues = {}
        self.worker_pool = ThreadPoolExecutor(max_workers=4)
        self.system_load = self.process_manager.Value('f', 0.0)
        
        # Start model loader in background
        if EMBEDDINGS_AVAILABLE:
            self.worker_pool.submit(self._load_model, DEFAULT_MODEL)
            # Start worker for query processing
            self.worker_pool.submit(self._process_query_queue)
    
    def _load_model(self, model_name):
        """Load the model in a background thread."""
        try:
            logger.info(f"Loading semantic search model: {model_name}")
            self.model = SentenceTransformer(model_name)
            self.dimensions = self.model.get_sentence_embedding_dimension()
            logger.info(f"Model loaded: {model_name} ({self.dimensions} dimensions)")
            self.model_ready.set()
        except Exception as e:
            logger.error(f"Error loading semantic search model: {e}")
    
    def _process_query_queue(self):
        """Background worker to process queued search queries."""
        logger.info("Starting query processor thread")
        while True:
            try:
                # Get query from queue with timeout
                query_data = self.query_queue.get(timeout=1.0)
                request_id, query, node_data, options = query_data
                
                # Process the query
                result = self._process_search_request(query, node_data, options)
                
                # Put result in the appropriate result queue
                if request_id in self.result_queues:
                    self.result_queues[request_id].put(result)
            except queue.Empty:
                # Queue timeout, just continue
                continue
            except Exception as e:
                logger.error(f"Error processing query: {e}")
    
    def _process_search_request(self, query, node_data, options):
        """Process a single search request."""
        try:
            # Wait for model to be ready
            if not self.model_ready.wait(timeout=5.0):
                return {"error": "Model not ready", "results": []}
            
            # Process the search
            start_time = time.time()
            
            # Get options
            top_k = options.get('top_k', 10)
            score_threshold = options.get('score_threshold', 0.3)
            timeout = options.get('timeout', None)
            
            # Generate query embedding (check cache first)
            query_embedding = self._get_embedding(query)
            if query_embedding is None:
                return {"error": "Failed to generate query embedding", "results": []}
            
            # Calculate similarity for each node
            node_map = {node["id"]: node for node in node_data}
            results = []
            
            # Get embeddings dict from cache
            embeddings_dict = self._get_embeddings_dict()
            if not embeddings_dict:
                return {"error": "No embeddings available", "results": []}
            
            # Track processing status
            processed_nodes = 0
            total_nodes = len(embeddings_dict)
            
            # Sort embeddings by node ID to ensure consistent processing order
            for node_id in sorted(embeddings_dict.keys()):
                # Check for timeout
                if timeout and time.time() - start_time > timeout:
                    logger.warning(f"Search timed out after {timeout} seconds")
                    break
                
                processed_nodes += 1
                
                # Skip if node is not in our data
                if node_id not in node_map:
                    continue
                
                # Process this node
                node = node_map[node_id]
                field_embeddings = embeddings_dict[node_id]
                
                # Find best matching field
                best_score = 0.0
                best_field = ""
                
                for field, embedding_data in field_embeddings.items():
                    # Convert to numpy array if needed
                    if isinstance(embedding_data, list):
                        embedding = np.array(embedding_data)
                    else:
                        embedding = embedding_data
                    
                    # Calculate similarity
                    score = float(np.dot(query_embedding, embedding))
                    if score > best_score:
                        best_score = score
                        best_field = field
                
                # If score meets threshold, add to results
                if best_score >= score_threshold:
                    # Create a copy with match info
                    result_node = node.copy()
                    
                    # Add match info
                    field_display_name = best_field.replace("_text", "").replace("_", " ")
                    result_node["match_info"] = {
                        "score": best_score,
                        "match_type": "semantic",
                        "matches": [
                            {
                                "field": field_display_name,
                                "text": node.get(best_field, ""),
                                "priority": "medium",
                                "score": best_score
                            }
                        ]
                    }
                    
                    result_node["match_summary"] = f"Semantic match in: {field_display_name}"
                    results.append(result_node)
            
            # Calculate processing statistics
            elapsed_time = time.time() - start_time
            
            # Sort results by score
            results.sort(key=lambda x: x["match_info"]["score"], reverse=True)
            
            # Return top K results
            return {
                "results": results[:top_k],
                "stats": {
                    "time": elapsed_time,
                    "processed_nodes": processed_nodes,
                    "total_nodes": total_nodes,
                    "timed_out": timeout and time.time() - start_time > timeout
                }
            }
            
        except Exception as e:
            logger.error(f"Error in search processing: {e}")
            return {"error": str(e), "results": []}
    
    @lru_cache(maxsize=1000)
    def _get_embedding(self, text):
        """Generate embedding for text with caching."""
        if not self.model_ready.is_set() or not text:
            return None
        
        # Check if in shared cache
        cache_key = f"text:{hash(text)}"
        if cache_key in self.embedding_cache:
            self.cache_stats['hits'] += 1
            return self.embedding_cache[cache_key]
        
        try:
            # Generate new embedding
            self.cache_stats['misses'] += 1
            embedding = self.model.encode(text, normalize_embeddings=True)
            
            # Store in cache
            self.embedding_cache[cache_key] = embedding
            return embedding
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return None
    
    def _get_embeddings_dict(self):
        """Get the current embeddings dictionary."""
        return getattr(self, 'embeddings_dict', {})
    
    def load_embeddings(self, file_path):
        """Load embeddings from file into shared memory."""
        try:
            if not os.path.exists(file_path):
                logger.warning(f"Embeddings file not found: {file_path}")
                return False
            
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            # Validate data
            if "embeddings" not in data or "metadata" not in data:
                logger.error("Invalid embeddings file format")
                return False
            
            # Check model compatibility
            file_model = data["metadata"].get("model", "")
            if file_model != DEFAULT_MODEL:
                logger.warning(f"Embeddings were generated with a different model: {file_model}")
            
            # Convert to numpy arrays and store in shared dictionary
            embeddings_dict = {}
            for node_id, fields in data["embeddings"].items():
                node_embeddings = {}
                for field, embedding in fields.items():
                    node_embeddings[field] = np.array(embedding, dtype=np.float32)
                embeddings_dict[node_id] = node_embeddings
            
            # Store the embeddings
            self.embeddings_dict = embeddings_dict
            logger.info(f"Loaded embeddings for {len(embeddings_dict)} nodes into shared memory")
            return True
            
        except Exception as e:
            logger.error(f"Error loading embeddings: {e}")
            return False
    
    def update_system_load(self, load_value):
        """Update the current system load metric."""
        self.system_load.value = load_value
    
    def get_system_load(self):
        """Get the current system load."""
        return self.system_load.value
    
    def queue_search_request(self, request_id, query, node_data, options=None):
        """Queue a search request for processing."""
        if options is None:
            options = {}
            
        # Create a result queue for this request
        self.result_queues[request_id] = self.process_manager.Queue()
        
        # Add to processing queue
        self.query_queue.put((request_id, query, node_data, options))
        
        return True
    
    def get_search_result(self, request_id, timeout=10.0):
        """Get the result for a queued search request."""
        if request_id not in self.result_queues:
            return {"error": "Invalid request ID"}
        
        try:
            result = self.result_queues[request_id].get(timeout=timeout)
            # Clean up the result queue
            del self.result_queues[request_id]
            return result
        except queue.Empty:
            return {"error": "Request timed out", "results": []}
        except Exception as e:
            logger.error(f"Error getting search result: {e}")
            return {"error": str(e), "results": []}

# Enhanced semantic search class
class EnhancedSemanticSearch:
    """
    Provides enhanced semantic search capabilities with multi-user support.
    Uses a shared model instance and async processing for better concurrency.
    """
    
    def __init__(self):
        """Initialize the enhanced semantic search."""
        self.model_manager = ModelManager()
        
    def is_available(self) -> bool:
        """Check if semantic search is available (model loaded)."""
        return self.model_manager.model_ready.is_set()
    
    def load_embeddings(self, file_path: str) -> bool:
        """Load embeddings from JSON file into shared memory."""
        return self.model_manager.load_embeddings(file_path)
    
    async def semantic_search_async(self, query: str, node_data: List[Dict[str, Any]],
                           top_k: int = 10, score_threshold: float = 0.3,
                           timeout: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Perform semantic search asynchronously using query.
        
        Args:
            query: Search query string
            node_data: List of node dictionaries from the graph
            top_k: Maximum number of results to return
            score_threshold: Minimum similarity score to include in results
            timeout: Optional timeout in seconds
            
        Returns:
            List of node dictionaries with match information
        """
        if not self.is_available() or not query:
            return []
        
        try:
            # Generate a unique request ID
            request_id = f"search_{time.time()}_{hash(query)}"
            
            # Queue the search request
            options = {
                'top_k': top_k,
                'score_threshold': score_threshold,
                'timeout': timeout
            }
            
            # Adjust timeout based on system load
            system_load = self.model_manager.get_system_load()
            if system_load > 0.8 and timeout:
                # Reduce timeout under heavy load
                options['timeout'] = timeout * 0.8
            
            self.model_manager.queue_search_request(request_id, query, node_data, options)
            
            # Use asyncio to wait for results without blocking the event loop
            loop = asyncio.get_event_loop()
            result = await loop.run_in_executor(
                None, 
                lambda: self.model_manager.get_search_result(request_id, timeout=timeout or 30.0)
            )
            
            # Check for errors
            if "error" in result and result.get("results") is None:
                logger.error(f"Search error: {result['error']}")
                return []
            
            # Return the results
            return result.get("results", [])
            
        except Exception as e:
            logger.error(f"Error in async semantic search: {e}")
            return []
    
    def semantic_search(self, query: str, node_data: List[Dict[str, Any]],
                       top_k: int = 10, score_threshold: float = 0.3,
                       timeout: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Synchronous wrapper for semantic search.
        
        Args:
            query: Search query string
            node_data: List of node dictionaries from the graph
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
            self.semantic_search_async(query, node_data, top_k, score_threshold, timeout)
        )

# System load monitor thread
def start_load_monitor(model_manager, interval=5.0):
    """Start a background thread to monitor system load."""
    
    def monitor_load():
        """Monitor CPU and memory load."""
        try:
            import psutil
            
            while True:
                try:
                    # Get CPU and memory usage
                    cpu_percent = psutil.cpu_percent(interval=1.0) / 100.0
                    memory_percent = psutil.virtual_memory().percent / 100.0
                    
                    # Weighted average (CPU is more important for our workload)
                    load_value = (cpu_percent * 0.7) + (memory_percent * 0.3)
                    
                    # Update the shared value
                    model_manager.update_system_load(load_value)
                    
                    # Log if load is high
                    if load_value > 0.8:
                        logger.warning(f"High system load detected: {load_value:.2f}")
                    
                    # Sleep for the interval
                    time.sleep(interval)
                except Exception as e:
                    logger.error(f"Error in load monitor: {e}")
                    time.sleep(interval)
        except ImportError:
            logger.warning("psutil not available, system load monitoring disabled")
            # Set a default load value
            model_manager.update_system_load(0.5)
    
    # Start the thread
    thread = threading.Thread(target=monitor_load, daemon=True)
    thread.start()
    return thread

# Flask endpoint implementation
def perform_enhanced_semantic_search(query, nodes, timeout=None):
    """
    Perform semantic search using the EnhancedSemanticSearch module.
    
    Args:
        query: The search query string
        nodes: List of node dictionaries from the graph
        timeout: Optional timeout in seconds
        
    Returns:
        List of node dictionaries with match information
    """
    try:
        # Import dependencies
        import os
        
        # Get base directory for embeddings file
        script_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.dirname(script_dir)
        embeddings_path = os.path.join(base_dir, 'static', 'embeddings.json')
        
        # Initialize the enhanced semantic search
        semantic_search = EnhancedSemanticSearch()
        
        # Load embeddings if available
        if not semantic_search.load_embeddings(embeddings_path):
            logger.warning("Could not load embeddings, semantic search will not work")
            return []
        
        # Start system load monitor if not already started
        if not hasattr(perform_enhanced_semantic_search, '_monitor_started'):
            start_load_monitor(semantic_search.model_manager)
            perform_enhanced_semantic_search._monitor_started = True
        
        # Perform semantic search with optional timeout
        results = semantic_search.semantic_search(
            query, 
            nodes, 
            top_k=10,             # Return top 10 matches
            score_threshold=0.3,  # Minimum similarity score
            timeout=timeout       # Optional timeout in seconds
        )
        
        # Scale semantic search scores to be comparable with keyword search
        for result in results:
            if "match_info" in result and "score" in result["match_info"]:
                # Scale semantic scores (0-1) to be comparable with keyword scores (0-10)
                result["match_info"]["score"] = result["match_info"]["score"] * 8
        
        return results
        
    except ImportError:
        logger.error("Could not import required modules for enhanced semantic search")
        return []
    except Exception as e:
        logger.error(f"Error performing enhanced semantic search: {e}")
        return []