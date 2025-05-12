"""
Model management for semantic search functionality.

This module provides model loading and management facilities for
sentence transformers and other embedding models.
"""
import logging
import threading
import time
from typing import Optional, Dict, Any

# Import search utilities
from ..search_utils.config import DEFAULT_MODEL
from ..search_utils.logging import log_method_call
from ..search_utils.metrics import get_metrics

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


class ModelManager:
    """
    Manages semantic search models with thread-safe loading and access.
    
    This class is responsible for loading and providing access to the
    sentence transformer model used for embedding generation.
    """
    
    _instance = None
    _lock = threading.Lock()
    
    def __new__(cls):
        """Implement the singleton pattern for model management."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ModelManager, cls).__new__(cls)
                cls._instance._initialize()
            return cls._instance
    
    def _initialize(self) -> None:
        """Initialize the model manager resources."""
        self.model = None
        self.dimensions = 0
        self.model_ready = threading.Event()
        self.model_ready.clear()
        self.model_info = {}
        
        # Start model loader in background
        if EMBEDDINGS_AVAILABLE:
            self._load_model_in_background(DEFAULT_MODEL)
    
    def _load_model_in_background(self, model_name: str) -> None:
        """
        Start loading the model in a background thread.
        
        Args:
            model_name: Name of the sentence transformer model to load
        """
        thread = threading.Thread(
            target=self._load_model, 
            args=(model_name,),
            daemon=True
        )
        thread.start()
    
    def _load_model(self, model_name: str) -> None:
        """
        Load the model in a background thread.
        
        Args:
            model_name: Name of the sentence transformer model to load
        """
        try:
            logger.info(f"Loading semantic search model: {model_name}")
            start_time = time.time()
            
            # Load the model
            self.model = SentenceTransformer(model_name)
            self.dimensions = self.model.get_sentence_embedding_dimension()
            
            # Record model information
            load_time = time.time() - start_time
            self.model_info = {
                'name': model_name,
                'dimensions': self.dimensions,
                'load_time': load_time
            }
            
            logger.info(f"Model loaded: {model_name} ({self.dimensions} dimensions) in {load_time:.2f}s")
            
            # Signal that the model is ready
            self.model_ready.set()
        except Exception as e:
            logger.error(f"Error loading semantic search model: {e}")
    
    @log_method_call()
    def get_model(self) -> Optional[Any]:
        """
        Get the loaded model, waiting for it to be ready if necessary.
        
        Returns:
            The sentence transformer model or None if not available
        """
        # Wait for the model to be ready with a timeout
        if not self.model_ready.wait(timeout=5.0):
            logger.warning("Timed out waiting for model to be ready")
            return None
        
        return self.model
    
    @log_method_call()
    def is_model_ready(self) -> bool:
        """
        Check if the model is loaded and ready to use.
        
        Returns:
            bool: True if the model is ready, False otherwise
        """
        return self.model_ready.is_set()
    
    @log_method_call()
    def get_embedding_dimensions(self) -> int:
        """
        Get the dimension size of the model's embeddings.
        
        Returns:
            int: Number of dimensions in the embedding vector
        """
        if not self.model_ready.wait(timeout=1.0):
            return 0
        return self.dimensions
    
    @log_method_call()
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about the loaded model.
        
        Returns:
            Dict containing model name, dimensions, and load time
        """
        if not self.model_ready.wait(timeout=1.0):
            return {'status': 'loading'}
        
        return {
            'status': 'ready',
            **self.model_info
        }


# Create a function to get the singleton instance
def get_model_manager() -> ModelManager:
    """
    Get or create the singleton instance of ModelManager.
    
    Returns:
        ModelManager: The shared instance
    """
    return ModelManager()