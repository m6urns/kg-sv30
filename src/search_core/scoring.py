"""
Scoring and similarity calculation for semantic search.

This module provides functions for calculating similarity scores between
query embeddings and document embeddings, as well as utilities for
ranking and processing search results.
"""
import time
import logging
import numpy as np
from typing import Dict, List, Any, Optional, Tuple

# Import from other modules
from ..search_utils.config import DEFAULT_SCORE_THRESHOLD, DEFAULT_TOP_K
from ..search_utils.logging import log_search_stats, log_method_call
from ..search_utils.metrics import get_metrics

# Set up logging
logger = logging.getLogger(__name__)

def cosine_similarity(query_embedding: np.ndarray, 
                     doc_embedding: np.ndarray) -> float:
    """
    Calculate cosine similarity between two embedding vectors.
    
    Args:
        query_embedding: Query embedding vector
        doc_embedding: Document embedding vector
        
    Returns:
        float: Similarity score between 0 and 1
    """
    # Ensure vectors are normalized
    if query_embedding is None or doc_embedding is None:
        return 0.0
        
    try:
        # Calculate dot product of normalized vectors (equivalent to cosine)
        return float(np.dot(query_embedding, doc_embedding))
    except Exception as e:
        logger.error(f"Error calculating similarity: {e}")
        return 0.0

class SearchScorer:
    """
    Handles the scoring and ranking of search results based on embeddings.
    
    This class provides methods for comparing embeddings, ranking nodes,
    and formatting search results.
    """
    
    @log_method_call()
    def score_nodes(self, 
                   query_embedding: np.ndarray,
                   nodes: List[Dict[str, Any]],
                   node_embeddings: Dict[str, Dict[str, np.ndarray]],
                   score_threshold: float = DEFAULT_SCORE_THRESHOLD,
                   timeout: Optional[float] = None) -> List[Dict[str, Any]]:
        """
        Score and rank nodes based on semantic similarity to query.
        
        Args:
            query_embedding: Query embedding vector
            nodes: List of node dictionaries from the graph
            node_embeddings: Dictionary mapping node IDs to field embeddings
            score_threshold: Minimum similarity score to include in results
            timeout: Optional timeout in seconds
            
        Returns:
            List of node dictionaries with match information
        """
        results = []
        start_time = time.time()
        
        # Track processing stats
        processed_nodes = 0
        total_nodes = len(node_embeddings)
        
        # Create node lookup dictionary for efficiency
        node_map = {node["id"]: node for node in nodes}
        
        # Process each node in the embeddings dictionary
        for node_id in sorted(node_embeddings.keys()):
            # Check for timeout
            if timeout and time.time() - start_time > timeout:
                logger.warning(f"Search timed out after {timeout:.2f} seconds")
                break
            
            processed_nodes += 1
            
            # Skip if node is not in our data
            if node_id not in node_map:
                continue
            
            # Process this node
            node = node_map[node_id]
            field_embeddings = node_embeddings[node_id]
            
            # Find best matching field
            best_score = 0.0
            best_field = ""
            
            for field, embedding in field_embeddings.items():
                # Calculate similarity
                score = cosine_similarity(query_embedding, embedding)
                
                # Update best match if this field has a higher score
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
        
        # Log search stats
        stats = {
            'time': elapsed_time,
            'processed_nodes': processed_nodes,
            'total_nodes': total_nodes,
            'timed_out': timeout and time.time() - start_time > timeout,
            'results_count': len(results)
        }
        log_search_stats(stats)
        
        # Record search time in metrics
        get_metrics().record_search_time(elapsed_time)
        
        return results
    
    @log_method_call()
    def limit_results(self, 
                     results: List[Dict[str, Any]], 
                     top_k: int = DEFAULT_TOP_K) -> List[Dict[str, Any]]:
        """
        Limit the number of results to the top K.
        
        Args:
            results: List of result nodes with match information
            top_k: Maximum number of results to return
            
        Returns:
            List of limited results
        """
        return results[:top_k] if top_k > 0 else results
    
    @log_method_call()
    def scale_scores(self, 
                    results: List[Dict[str, Any]], 
                    scale_factor: float = 8.0) -> List[Dict[str, Any]]:
        """
        Scale semantic scores to be comparable with keyword search scores.
        
        Args:
            results: List of result nodes with match information
            scale_factor: Factor to scale scores by (default: 8.0)
            
        Returns:
            List of results with scaled scores
        """
        for result in results:
            if "match_info" in result and "score" in result["match_info"]:
                # Scale the score
                result["match_info"]["score"] = result["match_info"]["score"] * scale_factor
                
                # Scale the individual match scores too
                for match in result["match_info"].get("matches", []):
                    if "score" in match:
                        match["score"] = match["score"] * scale_factor
        
        return results

# Create a function to get a SearchScorer instance
def get_search_scorer() -> SearchScorer:
    """
    Get a new instance of SearchScorer.
    
    Returns:
        SearchScorer: A new instance
    """
    return SearchScorer()