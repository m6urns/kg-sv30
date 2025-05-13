#!/usr/bin/env python3
"""
Regenerate embeddings for the knowledge graph.

This script loads the existing graph data, regenerates embeddings for all nodes
using the current embedding model, and saves them to the correct location.
"""
import os
import json
import sys
import logging
import time
import argparse
from typing import Dict, List, Any, Optional

# Add the src directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

# Configure logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Import required modules from the project
from src.search_core.models import get_model_manager
from src.search_core.embeddings import get_embedding_manager
from src.search_utils.config import get_embeddings_file_path

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
    fields_to_embed = ['label', 'description', 'content', 'summary']
    
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

def main():
    """Main function to regenerate embeddings."""
    parser = argparse.ArgumentParser(description='Regenerate embeddings for the knowledge graph')
    parser.add_argument('--graph-file', type=str, default='static/graph_data.json',
                      help='Path to the graph data JSON file')
    parser.add_argument('--output-file', type=str, 
                      help='Path to save the embeddings file (default: static/embeddings.json)')
    parser.add_argument('--verbose', '-v', action='store_true',
                      help='Enable verbose logging')
    
    args = parser.parse_args()
    
    # Set log level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Load graph data
    nodes = load_graph_data(args.graph_file)
    if not nodes:
        logger.error("Failed to load graph data, aborting")
        return 1
    
    # Generate embeddings
    embeddings = generate_embeddings_for_nodes(nodes)
    if not embeddings:
        logger.error("Failed to generate embeddings, aborting")
        return 1
    
    # Save embeddings
    success = save_embeddings(embeddings, args.output_file)
    if not success:
        logger.error("Failed to save embeddings")
        return 1
    
    logger.info("Embedding regeneration completed successfully")
    return 0

if __name__ == "__main__":
    sys.exit(main())