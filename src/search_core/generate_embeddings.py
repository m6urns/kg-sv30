"""
Embedding generation module for knowledge graph nodes.

This module provides functionality to generate embeddings for all nodes
in the knowledge graph and save them to the correct location.
"""
import os
import json
import logging
import time
from typing import Dict, List, Any, Optional

# Import required modules from the project
from .models import get_model_manager
from .embeddings import get_embedding_manager
from ..search_utils.config import get_embeddings_file_path
from ..search_utils.logging import log_method_call

# Set up logging
logger = logging.getLogger(__name__)

@log_method_call()
def load_graph_data(file_path: str = 'static/graph_data.json') -> List[Dict[str, Any]]:
    """
    Load the graph data from the specified file.
    
    Args:
        file_path: Path to the graph data JSON file
        
    Returns:
        List of node dictionaries
    """
    try:
        logger.info(f"Loading graph data from {file_path}")
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        # Extract nodes from graph data
        if isinstance(data, dict) and 'nodes' in data:
            nodes = data['nodes']
            logger.info(f"Loaded {len(nodes)} nodes from graph data")
            return nodes
        else:
            logger.error("Invalid graph data format: 'nodes' not found")
            return []
            
    except Exception as e:
        logger.error(f"Error loading graph data: {e}")
        return []

@log_method_call()
def generate_embeddings_for_nodes(nodes: List[Dict[str, Any]]) -> Dict[str, Dict[str, List[float]]]:
    """
    Generate embeddings for all nodes using the current model.
    
    Args:
        nodes: List of node dictionaries
        
    Returns:
        Dictionary mapping node IDs to field embeddings
    """
    # Get the embedding manager
    embedding_manager = get_embedding_manager()
    
    # Wait for the model to be ready
    model_manager = get_model_manager()
    if not model_manager.is_model_ready():
        logger.info("Waiting for embedding model to load...")
        timeout = 30  # seconds
        start_time = time.time()
        while time.time() - start_time < timeout:
            if model_manager.is_model_ready():
                break
            time.sleep(0.5)
        
        if not model_manager.is_model_ready():
            logger.error("Embedding model failed to load within timeout")
            return {}
    
    logger.info("Embedding model loaded successfully")
    model_info = model_manager.get_model_info()
    logger.info(f"Using model: {model_info.get('name', 'unknown')}")
    
    # Dictionary to store embeddings
    embeddings_dict = {}
    
    # Fields to embed (can be customized)
    fields_to_embed = ['label', 'description', 'content', 'summary', 'text']
    
    # Generate embeddings for each node
    total_nodes = len(nodes)
    logger.info(f"Generating embeddings for {total_nodes} nodes...")
    
    for i, node in enumerate(nodes):
        node_id = node.get('id')
        if not node_id:
            continue
        
        # Report progress periodically
        if i % 100 == 0 or i == total_nodes - 1:
            logger.info(f"Progress: {i+1}/{total_nodes} nodes processed ({(i+1)/total_nodes*100:.1f}%)")
        
        # Generate embeddings for available fields
        node_embeddings = {}
        for field in fields_to_embed:
            if field in node and node[field]:
                text = node[field]
                embedding = embedding_manager.get_embedding(text)
                if embedding is not None:
                    # Convert numpy array to list for JSON serialization
                    node_embeddings[field] = embedding.tolist()
        
        # Store if we have at least one embedding
        if node_embeddings:
            embeddings_dict[node_id] = node_embeddings
    
    logger.info(f"Generated embeddings for {len(embeddings_dict)} nodes")
    return embeddings_dict

@log_method_call()
def save_embeddings(embeddings: Dict[str, Dict[str, List[float]]], 
                  file_path: Optional[str] = None) -> bool:
    """
    Save embeddings to a JSON file.
    
    Args:
        embeddings: Dictionary mapping node IDs to field embeddings
        file_path: Path to save the embeddings file, or None to use default
        
    Returns:
        True if successful, False otherwise
    """
    try:
        if file_path is None:
            file_path = get_embeddings_file_path()
        
        # Get model info for metadata
        model_manager = get_model_manager()
        model_info = model_manager.get_model_info()
        
        # Prepare data structure with metadata
        data = {
            "embeddings": embeddings,
            "metadata": {
                "model": model_info.get('name', 'unknown'),
                "dimensions": model_info.get('dimensions', 0),
                "timestamp": time.time(),
                "node_count": len(embeddings)
            }
        }
        
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        
        # Save to file
        with open(file_path, 'w') as f:
            json.dump(data, f)
        
        logger.info(f"Saved embeddings for {len(embeddings)} nodes to {file_path}")
        return True
        
    except Exception as e:
        logger.error(f"Error saving embeddings: {e}")
        return False

@log_method_call()
def regenerate_embeddings(graph_file_path: str = 'static/graph_data.json', 
                        output_file_path: Optional[str] = None) -> bool:
    """
    Regenerate embeddings for the knowledge graph.
    
    This function loads the existing graph data, regenerates
    embeddings for all nodes using the current embedding model,
    and saves them to the correct location.
    
    Args:
        graph_file_path: Path to the graph data JSON file
        output_file_path: Path to save the embeddings file, or None to use default
        
    Returns:
        True if regeneration was successful, False otherwise
    """
    # Load graph data
    nodes = load_graph_data(graph_file_path)
    if not nodes:
        logger.error("Failed to load graph data, aborting embedding regeneration")
        return False
    
    # Generate embeddings
    embeddings = generate_embeddings_for_nodes(nodes)
    if not embeddings:
        logger.error("Failed to generate embeddings, aborting")
        return False
    
    # Save embeddings
    success = save_embeddings(embeddings, output_file_path)
    if not success:
        logger.error("Failed to save embeddings")
        return False
    
    logger.info("Embedding regeneration completed successfully")
    return True