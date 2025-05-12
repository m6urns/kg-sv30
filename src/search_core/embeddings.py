"""
Embedding generation and management for semantic search.

This module handles the generation, storage, and retrieval of embeddings
for the semantic search system.
"""
import os
import json
import logging
import numpy as np
import threading
import time
from functools import lru_cache
from typing import Dict, List, Any, Optional, Union, Tuple

# Import from other modules
from .models import get_model_manager
from ..search_utils.config import get_embeddings_file_path, EMBEDDING_CACHE_SIZE
from ..search_utils.logging import log_method_call
from ..search_utils.metrics import get_metrics

# Set up logging
logger = logging.getLogger(__name__)

class EmbeddingManager:
    """
    Manages the creation, caching, and retrieval of text embeddings.
    
    This class provides methods for generating embeddings from text and
    loading pre-computed embeddings from disk.
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        """Implement the singleton pattern for embedding management."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(EmbeddingManager, cls).__new__(cls)
                cls._instance._initialize()
            return cls._instance
    
    def _initialize(self) -> None:
        """Initialize the embedding manager resources."""
        self.model_manager = get_model_manager()
        self.embeddings_dict = {}
        self.embedding_cache = {}
        self.cache_stats = {'hits': 0, 'misses': 0}
        self.metadata = {}
        self.lock = threading.Lock()
    
    @log_method_call()
    def load_embeddings(self, file_path: Optional[str] = None) -> bool:
        """
        Load embeddings from file into memory.
        
        Args:
            file_path: Path to the embeddings JSON file,
                      or None to use the default path
                      
        Returns:
            bool: True if embeddings were loaded successfully, False otherwise
        """
        # Use default path if not specified
        if file_path is None:
            file_path = get_embeddings_file_path()
        
        try:
            # Check if file exists
            if not os.path.exists(file_path):
                logger.warning(f"Embeddings file not found: {file_path}")
                return False
            
            # Load embeddings from file
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            # Validate data
            if "embeddings" not in data or "metadata" not in data:
                logger.error("Invalid embeddings file format")
                return False
            
            # Store metadata
            self.metadata = data["metadata"]
            
            # Check model compatibility
            model_name = self.model_manager.get_model_info().get('name', '')
            file_model = data["metadata"].get("model", "")
            if file_model != model_name and model_name:
                logger.warning(f"Embeddings were generated with a different model: {file_model}")
            
            # Convert to numpy arrays and store in dictionary
            with self.lock:
                embeddings_dict = {}
                for node_id, fields in data["embeddings"].items():
                    node_embeddings = {}
                    for field, embedding in fields.items():
                        # Convert embedding to numpy array
                        if isinstance(embedding, list):
                            node_embeddings[field] = np.array(embedding, dtype=np.float32)
                        else:
                            # Handle case where embedding might be serialized differently
                            node_embeddings[field] = np.array(embedding, dtype=np.float32)
                    embeddings_dict[node_id] = node_embeddings
                
                # Update the instance variable
                self.embeddings_dict = embeddings_dict
            
            logger.info(f"Loaded embeddings for {len(embeddings_dict)} nodes")
            return True
            
        except Exception as e:
            logger.error(f"Error loading embeddings: {e}")
            return False
    
    @log_method_call(log_args=True)
    def get_embeddings_dict(self) -> Dict[str, Dict[str, np.ndarray]]:
        """
        Get the current embeddings dictionary.
        
        Returns:
            Dictionary mapping node IDs to field embeddings
        """
        with self.lock:
            return self.embeddings_dict.copy()
    
    @log_method_call()
    def get_node_embeddings(self, node_id: str) -> Optional[Dict[str, np.ndarray]]:
        """
        Get embeddings for a specific node.
        
        Args:
            node_id: ID of the node to get embeddings for
            
        Returns:
            Dictionary mapping field names to embeddings, or None if not found
        """
        with self.lock:
            return self.embeddings_dict.get(node_id)
    
    @lru_cache(maxsize=EMBEDDING_CACHE_SIZE)
    def _cached_get_embedding(self, text: str) -> Optional[np.ndarray]:
        """
        Generate embedding for text with function-level caching.
        
        Args:
            text: Text to generate embedding for
            
        Returns:
            numpy.ndarray: Embedding vector or None if generation failed
        """
        # This internal method uses Python's lru_cache for fast in-memory caching
        model = self.model_manager.get_model()
        if not model or not text:
            return None
        
        try:
            # Generate new embedding
            get_metrics().record_cache_event(False)  # Record cache miss
            
            # Track embedding generation time
            start_time = time.time()
            embedding = model.encode(text, normalize_embeddings=True)
            elapsed_time = time.time() - start_time
            
            # Record metrics
            get_metrics().record_embedding_time(elapsed_time)
            
            return embedding
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return None
    
    @log_method_call()
    def get_embedding(self, text: str) -> Optional[np.ndarray]:
        """
        Generate or retrieve embedding for text with caching.
        
        Args:
            text: Text to generate embedding for
            
        Returns:
            numpy.ndarray: Embedding vector or None if generation failed
        """
        if not self.model_manager.is_model_ready() or not text:
            return None
        
        # Check if in shared cache
        cache_key = hash(text)
        with self.lock:
            if cache_key in self.embedding_cache:
                self.cache_stats['hits'] += 1
                get_metrics().record_cache_event(True)  # Record cache hit
                return self.embedding_cache[cache_key]
        
        # Use the cached function to get the embedding
        embedding = self._cached_get_embedding(text)
        
        # Store in shared cache if successful
        if embedding is not None:
            with self.lock:
                self.cache_stats['misses'] += 1
                self.embedding_cache[cache_key] = embedding
        
        return embedding
    
    @log_method_call()
    def get_cache_stats(self) -> Dict[str, int]:
        """
        Get statistics about the embedding cache.
        
        Returns:
            Dictionary with cache hits and misses
        """
        with self.lock:
            return self.cache_stats.copy()


# Function to get the singleton instance
def get_embedding_manager() -> EmbeddingManager:
    """
    Get or create the singleton instance of EmbeddingManager.
    
    Returns:
        EmbeddingManager: The shared instance
    """
    return EmbeddingManager()
