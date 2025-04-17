"""
Manual Knowledge Graph Creator and Editor

This module provides utilities for creating and editing knowledge graphs manually
rather than through automated text processing. This is a placeholder for future
development as we pivot away from automated text analysis to human-curated knowledge graphs.
"""

import json
import os
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class ManualGraphManager:
    """
    Manager for creating and editing knowledge graphs manually.
    This is a placeholder for future functionality to create/edit knowledge graphs
    without automated text processing.
    """
    
    def __init__(self):
        """Initialize the manual graph manager."""
        pass
        
    def create_empty_graph(self):
        """
        Create an empty knowledge graph structure.
        
        Returns:
            dict: An empty graph structure with nodes and links arrays
        """
        return {
            "nodes": [],
            "links": []
        }
    
    def add_topic_node(self, graph, label, keywords=None, community=None):
        """
        Add a topic node to the graph.
        
        Args:
            graph: The graph structure to modify
            label: The topic label
            keywords: List of keywords for the topic
            community: Optional community ID
            
        Returns:
            str: The ID of the created node
        """
        node_id = f"topic_{len([n for n in graph['nodes'] if n['type'] == 'topic'])}"
        
        node = {
            "id": node_id,
            "type": "topic",
            "label": label,
            "keywords": keywords or [],
            "size": 1,
            "docs": []
        }
        
        if community is not None:
            node["community"] = community
        
        graph["nodes"].append(node)
        return node_id
    
    def add_document_node(self, graph, text, topic_id=None):
        """
        Add a document node to the graph.
        
        Args:
            graph: The graph structure to modify
            text: The document text
            topic_id: Optional topic ID to link to
            
        Returns:
            str: The ID of the created node
        """
        node_id = f"doc_{len([n for n in graph['nodes'] if n['type'] == 'document'])}"
        
        node = {
            "id": node_id,
            "type": "document",
            "label": text[:50] + "..." if len(text) > 50 else text,
            "text": text
        }
        
        graph["nodes"].append(node)
        
        # If topic_id is provided, create a link
        if topic_id:
            # Add document to topic's docs list
            for node in graph["nodes"]:
                if node["id"] == topic_id:
                    node["docs"].append(node_id)
                    break
                    
            # Create link
            graph["links"].append({
                "source": node_id,
                "target": topic_id,
                "weight": 1.0,
                "type": "belongs_to"
            })
        
        return node_id
    
    def add_topic_relation(self, graph, source_id, target_id, weight=0.5):
        """
        Add a relation between two topics.
        
        Args:
            graph: The graph structure to modify
            source_id: Source topic ID
            target_id: Target topic ID
            weight: Relation weight (0.0 to 1.0)
            
        Returns:
            bool: True if the relation was added
        """
        # Validate topics exist
        source_exists = any(n["id"] == source_id and n["type"] == "topic" for n in graph["nodes"])
        target_exists = any(n["id"] == target_id and n["type"] == "topic" for n in graph["nodes"])
        
        if not source_exists or not target_exists:
            return False
        
        # Check if relation already exists
        relation_exists = any(
            (l["source"] == source_id and l["target"] == target_id) or
            (l["source"] == target_id and l["target"] == source_id)
            for l in graph["links"]
        )
        
        if not relation_exists:
            graph["links"].append({
                "source": source_id,
                "target": target_id,
                "weight": max(0.0, min(1.0, weight)),  # Ensure weight is between 0 and 1
                "type": "related_to"
            })
            return True
            
        return False
    
    def save_graph(self, graph, file_path):
        """
        Save the graph to a JSON file.
        
        Args:
            graph: The graph structure to save
            file_path: Path to save the JSON file
            
        Returns:
            bool: True if successful
        """
        try:
            # Create directory if it doesn't exist
            directory = os.path.dirname(file_path)
            os.makedirs(directory, exist_ok=True)
            
            with open(file_path, 'w') as f:
                json.dump(graph, f, indent=2)
            
            logger.info(f"Graph saved to {file_path}")
            return True
        except Exception as e:
            logger.error(f"Error saving graph: {e}")
            return False
    
    def load_graph(self, file_path):
        """
        Load a graph from a JSON file.
        
        Args:
            file_path: Path to the JSON file
            
        Returns:
            dict: The loaded graph or None if there was an error
        """
        try:
            if not os.path.exists(file_path):
                logger.error(f"Graph file not found: {file_path}")
                return None
                
            with open(file_path, 'r') as f:
                graph = json.load(f)
            
            logger.info(f"Graph loaded from {file_path}")
            return graph
        except Exception as e:
            logger.error(f"Error loading graph: {e}")
            return None

# Example usage:
if __name__ == "__main__":
    # This is just a demo of how the manual graph creation might work
    manager = ManualGraphManager()
    
    # Create an empty graph
    graph = manager.create_empty_graph()
    
    # Add some topics
    digital_id = manager.add_topic_node(graph, "Digital Transformation", 
                                      ["digital", "technology", "innovation"], 
                                      community=0)
    sustain_id = manager.add_topic_node(graph, "Environmental Sustainability", 
                                      ["sustainability", "environment", "green"], 
                                      community=1)
    market_id = manager.add_topic_node(graph, "Market Expansion", 
                                     ["market", "growth", "expansion"], 
                                     community=2)
    
    # Add some document nodes
    manager.add_document_node(graph, "Our digital transformation initiative will focus on cloud migration", digital_id)
    manager.add_document_node(graph, "The sustainability program aims to reduce carbon emissions by 30%", sustain_id)
    
    # Add relations between topics
    manager.add_topic_relation(graph, digital_id, sustain_id, 0.6)
    manager.add_topic_relation(graph, digital_id, market_id, 0.7)
    
    # Save the graph (for demo purposes)
    # manager.save_graph(graph, "manual_graph_example.json")