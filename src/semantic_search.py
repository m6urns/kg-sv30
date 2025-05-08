"""
Semantic search functionality for the knowledge graph application.
Provides embedding generation and vector similarity search capabilities.
"""
import os
import json
import logging
import numpy as np
from typing import Dict, List, Any, Tuple, Optional

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

class SemanticSearch:
    """
    Provides semantic search capabilities using sentence transformers.
    Supports generating, storing, and searching with embeddings.
    """
    
    def __init__(self, model_name: str = DEFAULT_MODEL):
        """
        Initialize the semantic search handler.
        
        Args:
            model_name: Name of the sentence transformer model to use
        """
        self.model_name = model_name
        self.model = None
        self.embeddings = {}
        self.dimensions = 0
        
        if EMBEDDINGS_AVAILABLE:
            try:
                self.model = SentenceTransformer(model_name)
                self.dimensions = self.model.get_sentence_embedding_dimension()
                logger.info(f"Loaded semantic search model: {model_name} ({self.dimensions} dimensions)")
            except Exception as e:
                logger.error(f"Error loading semantic search model: {e}")
    
    def is_available(self) -> bool:
        """Check if semantic search is available (model loaded)"""
        return self.model is not None
    
    def get_embedding(self, text: str) -> Optional[np.ndarray]:
        """
        Generate embedding for a text string.
        
        Args:
            text: Text to generate embedding for
            
        Returns:
            NumPy array with embedding or None if not available
        """
        if not self.is_available() or not text:
            return None
            
        try:
            # Normalize embeddings for cosine similarity
            return self.model.encode(text, normalize_embeddings=True)
        except Exception as e:
            logger.error(f"Error generating embedding: {e}")
            return None
    
    def generate_embeddings_for_node(self, node: Dict[str, Any]) -> Dict[str, np.ndarray]:
        """
        Generate embeddings for searchable fields in a node.
        
        Args:
            node: Node dictionary from the graph
            
        Returns:
            Dictionary of field names to embeddings
        """
        if not self.is_available():
            return {}
            
        node_embeddings = {}
        
        # Determine which fields to create embeddings for based on node type
        fields_to_embed = []
        
        # Common fields for all node types
        if node.get("label"):
            fields_to_embed.append("label")
        
        # Type-specific fields
        node_type = node.get("type", "")
        
        if node_type == "topic":
            if node.get("description"):
                fields_to_embed.append("description")
            if node.get("overview"):
                fields_to_embed.append("overview")
            if node.get("keywords"):
                # Create a single string from keywords for embedding
                node["keywords_text"] = " ".join(node.get("keywords", []))
                fields_to_embed.append("keywords_text")
                
        elif node_type == "document":
            if node.get("text"):
                fields_to_embed.append("text")
                
        elif node_type == "strategy":
            if node.get("text"):
                fields_to_embed.append("text")
            if node.get("summary"):
                fields_to_embed.append("summary")
        
        # Generate embeddings for selected fields
        for field in fields_to_embed:
            text = node.get(field, "")
            if text:
                embedding = self.get_embedding(text)
                if embedding is not None:
                    node_embeddings[field] = embedding
        
        return node_embeddings
    
    def generate_embeddings_for_graph(self, nodes: List[Dict[str, Any]]) -> Dict[str, Dict[str, List[float]]]:
        """
        Generate embeddings for all nodes in the graph.
        
        Args:
            nodes: List of nodes from the graph
            
        Returns:
            Dictionary mapping node IDs to field embeddings
        """
        if not self.is_available():
            return {}
            
        embeddings_dict = {}
        
        for node in nodes:
            node_id = node.get("id")
            if not node_id:
                continue
                
            # Generate embeddings for this node
            node_embeddings = self.generate_embeddings_for_node(node)
            
            if node_embeddings:
                # Convert numpy arrays to lists for JSON serialization
                serializable_embeddings = {
                    field: embedding.tolist() 
                    for field, embedding in node_embeddings.items()
                }
                embeddings_dict[node_id] = serializable_embeddings
        
        logger.info(f"Generated embeddings for {len(embeddings_dict)} nodes")
        return embeddings_dict
    
    def save_embeddings(self, embeddings_dict: Dict[str, Dict[str, List[float]]], file_path: str) -> bool:
        """
        Save embeddings to a JSON file.
        
        Args:
            embeddings_dict: Dictionary of node embeddings
            file_path: Path to save JSON file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Create data structure with embeddings and metadata
            data = {
                "embeddings": embeddings_dict,
                "metadata": {
                    "model": self.model_name,
                    "dimensions": self.dimensions
                }
            }
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # Write to file
            with open(file_path, 'w') as f:
                json.dump(data, f)
                
            logger.info(f"Saved embeddings to {file_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error saving embeddings: {e}")
            return False
    
    def load_embeddings(self, file_path: str) -> bool:
        """
        Load embeddings from a JSON file.
        
        Args:
            file_path: Path to embeddings JSON file
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if not os.path.exists(file_path):
                logger.warning(f"Embeddings file not found: {file_path}")
                return False
                
            with open(file_path, 'r') as f:
                data = json.load(f)
            
            # Validate data structure
            if "embeddings" not in data or "metadata" not in data:
                logger.error("Invalid embeddings file format")
                return False
                
            # Check model compatibility
            file_model = data["metadata"].get("model", "")
            if file_model != self.model_name:
                logger.warning(f"Embeddings were generated with a different model: {file_model}")
            
            # Convert lists back to numpy arrays for efficient operations
            embeddings_dict = {}
            for node_id, fields in data["embeddings"].items():
                embeddings_dict[node_id] = {
                    field: np.array(embedding, dtype=np.float32)
                    for field, embedding in fields.items()
                }
            
            self.embeddings = embeddings_dict
            logger.info(f"Loaded embeddings for {len(embeddings_dict)} nodes")
            return True
            
        except Exception as e:
            logger.error(f"Error loading embeddings: {e}")
            return False
    
    def calculate_similarity(self, query_embedding: np.ndarray, node_embedding: np.ndarray) -> float:
        """
        Calculate cosine similarity between query and node embeddings.
        
        Args:
            query_embedding: Query embedding vector
            node_embedding: Node embedding vector
            
        Returns:
            Similarity score between 0.0 and 1.0
        """
        if query_embedding is None or node_embedding is None:
            return 0.0
            
        try:
            # For normalized vectors, dot product equals cosine similarity
            return float(np.dot(query_embedding, node_embedding))
        except Exception as e:
            logger.error(f"Error calculating similarity: {e}")
            return 0.0
    
    def semantic_search(self, query: str, node_data: List[Dict[str, Any]], 
                        top_k: int = 10, score_threshold: float = 0.3) -> List[Dict[str, Any]]:
        """
        Perform semantic search using query and return best matches.
        
        Args:
            query: Search query string
            node_data: List of node dictionaries from the graph
            top_k: Maximum number of results to return
            score_threshold: Minimum similarity score to include in results
            
        Returns:
            List of node dictionaries with match information
        """
        if not self.is_available() or not query or not self.embeddings:
            return []
            
        try:
            # Generate embedding for query
            query_embedding = self.get_embedding(query)
            if query_embedding is None:
                return []
                
            # Create a mapping from node ID to the node object for quick lookup
            node_map = {node["id"]: node for node in node_data}
            
            # Calculate similarity for each node
            results = []
            
            for node_id, field_embeddings in self.embeddings.items():
                if node_id not in node_map:
                    continue
                    
                node = node_map[node_id]
                
                # Find the best matching field for this node
                best_score = 0.0
                best_field = ""
                
                for field, embedding in field_embeddings.items():
                    score = self.calculate_similarity(query_embedding, embedding)
                    if score > best_score:
                        best_score = score
                        best_field = field
                
                # If score is above threshold, add to results
                if best_score >= score_threshold:
                    # Create a copy of the node with match information
                    result_node = node.copy()
                    
                    # Standardize match information structure
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
            
            # Sort by score and return top_k
            results.sort(key=lambda x: x["match_info"]["score"], reverse=True)
            return results[:top_k]
            
        except Exception as e:
            logger.error(f"Error performing semantic search: {e}")
            return []