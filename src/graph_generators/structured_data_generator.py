"""
Structured JSON data generator for knowledge graphs.
This module implements a graph generator that creates data from structured JSON files.
"""
import json
import os
import random
import sys
from typing import Dict, List, Any

from .base_generator import BaseGraphGenerator

# Add the project root to sys.path to import the parser correctly
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.append(project_root)

# Import the parser class from the data directory
try:
    from data.longbeach_2030.parser import LongBeach2030Parser
except ImportError:
    print("Could not import LongBeach2030Parser. Make sure the data directory is in the Python path.")
    # Define a simple placeholder class if import fails
    class LongBeach2030Parser:
        def __init__(self, *args):
            self.index_data = {}
            self.themes = {}
        
        def load_all_themes(self):
            pass


class StructuredDataGraphGenerator(BaseGraphGenerator):
    """
    Knowledge graph generator that creates a graph from structured JSON data.
    
    This generator parses the Long Beach 2030 Strategic Vision JSON data and
    creates a knowledge graph with themes, goals, and strategies.
    """
    
    @classmethod
    def get_name(cls):
        return "Structured JSON Data Generator"
    
    @classmethod
    def get_description(cls):
        return "Creates a knowledge graph from the structured JSON data in data/longbeach_2030."
    
    def __init__(self):
        """Initialize the generator with the LongBeach2030Parser."""
        # Path to the index file
        base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        self.index_path = os.path.join(base_dir, 'data', 'longbeach_2030', 'index.json')
        
        # Initialize the parser
        self.parser = LongBeach2030Parser(self.index_path)
        
        # Load all themes data
        self.parser.load_all_themes()
    
    def _generate_theme_nodes(self) -> List[Dict[str, Any]]:
        """
        Generate nodes for themes from the structured data.
        
        Returns:
            List of theme node dictionaries
        """
        theme_nodes = []
        
        # Get index data sections
        sections = self.parser.index_data.get('sections', [])
        section_map = {section['id']: section for section in sections}
        
        # Process each theme
        for theme_id, theme_data in self.parser.themes.items():
            theme = theme_data.get('theme', {})
            theme_title = theme.get('title', f"Theme {theme_id}")
            theme_description = theme.get('description', '')
            theme_overview = theme.get('overview', '')
            
            # Find which section this theme belongs to
            section_name = theme_data.get('section', 'Unknown')
            section_id = next((s['id'] for s in sections if s['name'] == section_name), None)
            
            # Create keywords from title and description
            keywords = []
            if theme_title:
                keywords.extend([word.lower() for word in theme_title.split() if len(word) > 3])
            if theme_description:
                keywords.extend([word.lower() for word in theme_description.split() if len(word) > 3])
            
            # Remove duplicates and limit to 5 keywords
            keywords = list(set(keywords))[:5]
            
            # Count goals as a measure of size
            goals = theme.get('goals', [])
            goal_count = len(goals)
            
            # Assign themes to communities based on their section
            community_id = section_id - 1 if section_id is not None else 0
            community_label = section_name
            
            # Create the theme node
            theme_node = {
                "id": f"theme_{theme_id}",
                "type": "topic",  # Using "topic" to maintain compatibility with the existing graph structure
                "label": theme_title,
                "description": theme_description,
                "overview": theme_overview,
                "keywords": keywords,
                "size": max(3, goal_count * 2),  # Size based on the number of goals
                "community": community_id,
                "community_label": community_label,
                "is_central": False,  # Will update central themes later
                "docs": []  # Will populate with goal IDs
            }
            
            theme_nodes.append(theme_node)
        
        # Mark central themes (one per community)
        communities = {}
        for node in theme_nodes:
            community_id = node["community"]
            if community_id not in communities:
                communities[community_id] = []
            communities[community_id].append(node)
        
        # Mark the largest theme in each community as central
        for community_id, nodes in communities.items():
            if nodes:
                largest_node = max(nodes, key=lambda n: n["size"])
                largest_node["is_central"] = True
        
        return theme_nodes
    
    def _generate_goal_nodes(self, theme_nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generate nodes for goals from the structured data.
        
        Args:
            theme_nodes: List of theme nodes to link goals to
            
        Returns:
            List of goal node dictionaries
        """
        goal_nodes = []
        
        # Create a mapping from theme_id to node for easy lookup
        theme_map = {int(node["id"].split("_")[1]): node for node in theme_nodes if node["id"].startswith("theme_")}
        
        # Process each theme's goals
        for theme_id, theme_data in self.parser.themes.items():
            theme = theme_data.get('theme', {})
            theme_title = theme.get('title', f"Theme {theme_id}")
            goals = theme.get('goals', [])
            
            # Add each goal as a document node
            for goal in goals:
                goal_id = goal.get('id', '')
                goal_title = goal.get('title', f"Goal {goal_id}")
                
                # Combine strategies into a text representation
                strategies = goal.get('strategies', [])
                strategies_text = "\n• " + "\n• ".join(strategies) if strategies else ""
                
                goal_text = f"{goal_title}{strategies_text}"
                
                # Generate a unique node ID for the goal
                node_id = f"goal_{theme_id}_{goal_id.replace('.', '_')}"
                
                # Create the goal node
                goal_node = {
                    "id": node_id,
                    "type": "document",  # Using "document" to maintain compatibility
                    "label": goal_title,
                    "text": goal_text,
                    "theme_id": theme_id,
                    "theme_title": theme_title,
                    "strategies_count": len(strategies)
                }
                
                goal_nodes.append(goal_node)
                
                # Add this goal to the theme's docs list
                if theme_id in theme_map:
                    theme_map[theme_id]["docs"].append(node_id)
        
        return goal_nodes
    
    def _generate_strategy_nodes(self, goal_nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generate nodes for strategies from the structured data.
        
        Args:
            goal_nodes: List of goal nodes to link strategies to
            
        Returns:
            List of strategy node dictionaries
        """
        strategy_nodes = []
        
        # Process each goal's strategies
        for goal_node in goal_nodes:
            goal_id = goal_node["id"]
            theme_id = goal_node["theme_id"]
            theme_title = goal_node["theme_title"]
            goal_label = goal_node["label"]
            
            # Extract the goal's unique identifier from its ID (e.g., "1_1" from "goal_1_1_1")
            goal_identifier = goal_id.split("_", 1)[1]
            
            # Find the strategies in the parser data
            full_goal_id = goal_identifier.split("_")[-1].replace("_", ".")
            goal_data = self.parser.get_goal_by_id(theme_id, full_goal_id)
            
            if goal_data:
                strategies = goal_data.get('strategies', [])
                
                # Add each strategy as a separate node
                for i, strategy in enumerate(strategies):
                    strategy_id = f"strategy_{theme_id}_{full_goal_id.replace('.', '_')}_{i}"
                    
                    strategy_node = {
                        "id": strategy_id,
                        "type": "strategy",  # New node type for strategies
                        "label": f"Strategy {i+1}: {strategy[:50]}..." if len(strategy) > 50 else strategy,
                        "text": strategy,
                        "theme_id": theme_id,
                        "theme_title": theme_title,
                        "goal_id": goal_id,
                        "goal_title": goal_label
                    }
                    
                    strategy_nodes.append(strategy_node)
        
        return strategy_nodes
    
    def _generate_links(self, theme_nodes: List[Dict[str, Any]], goal_nodes: List[Dict[str, Any]], 
                        strategy_nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generate links between nodes.
        
        Args:
            theme_nodes: List of theme nodes
            goal_nodes: List of goal nodes
            strategy_nodes: List of strategy nodes
            
        Returns:
            List of link dictionaries
        """
        links = []
        
        # Link goals to themes
        for goal_node in goal_nodes:
            theme_id = goal_node["theme_id"]
            theme_node_id = f"theme_{theme_id}"
            
            links.append({
                "source": goal_node["id"],
                "target": theme_node_id,
                "weight": 1.0,
                "type": "belongs_to"
            })
        
        # Link strategies to goals
        for strategy_node in strategy_nodes:
            goal_id = strategy_node["goal_id"]
            
            links.append({
                "source": strategy_node["id"],
                "target": goal_id,
                "weight": 1.0,
                "type": "implements"
            })
        
        # Link themes to each other within the same section/community
        theme_by_community = {}
        for node in theme_nodes:
            community_id = node["community"]
            if community_id not in theme_by_community:
                theme_by_community[community_id] = []
            theme_by_community[community_id].append(node)
        
        # Connect themes within the same community
        for community_id, community_themes in theme_by_community.items():
            for i, theme1 in enumerate(community_themes):
                for theme2 in community_themes[i+1:]:
                    # Random weight between 0.5 and 0.9 for within-community connections
                    weight = round(random.uniform(0.5, 0.9), 2)
                    
                    links.append({
                        "source": theme1["id"],
                        "target": theme2["id"],
                        "weight": weight,
                        "type": "related_to"
                    })
        
        # Add a few cross-community connections for themes
        communities = list(theme_by_community.keys())
        for i, comm1 in enumerate(communities):
            for comm2 in communities[i+1:]:
                if theme_by_community[comm1] and theme_by_community[comm2]:
                    # Choose a random theme from each community
                    theme1 = random.choice(theme_by_community[comm1])
                    theme2 = random.choice(theme_by_community[comm2])
                    
                    # Lower weight for cross-community connections
                    weight = round(random.uniform(0.3, 0.5), 2)
                    
                    links.append({
                        "source": theme1["id"],
                        "target": theme2["id"],
                        "weight": weight,
                        "type": "related_to"
                    })
        
        return links
    
    def generate_graph(self, document_text, **kwargs):
        """
        Generate a knowledge graph from the structured JSON data.
        
        Args:
            document_text: Ignored, kept for API compatibility
            **kwargs: Additional arguments
            
        Returns:
            dict: D3.js compatible graph structure
        """
        # Generate nodes for themes, goals, and strategies
        theme_nodes = self._generate_theme_nodes()
        goal_nodes = self._generate_goal_nodes(theme_nodes)
        strategy_nodes = self._generate_strategy_nodes(goal_nodes)
        
        # Generate links between nodes
        links = self._generate_links(theme_nodes, goal_nodes, strategy_nodes)
        
        # Combine all nodes
        all_nodes = theme_nodes + goal_nodes + strategy_nodes
        
        return {
            "nodes": all_nodes,
            "links": links
        }