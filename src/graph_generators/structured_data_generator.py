"""
Structured JSON data generator for knowledge graphs.
This module implements a graph generator that creates data from structured JSON files.
"""
import json
import os
import random
import sys
from typing import Dict, List, Any
from collections import Counter

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
    
    def _extract_keywords(self, text: str, max_keywords: int = 5) -> List[str]:
        """
        Extract meaningful keywords from a text.
        
        Args:
            text: The text to extract keywords from
            max_keywords: Maximum number of keywords to return
            
        Returns:
            List of keywords
        """
        if not text:
            return []
            
        # Convert to lowercase and split into words
        words = text.lower().split()
        
        # Remove common stopwords and short words
        stopwords = set(['the', 'and', 'is', 'of', 'to', 'in', 'for', 'a', 'with', 'that', 'are', 'by', 'on', 'as'])
        filtered_words = [word for word in words if word not in stopwords and len(word) > 3]
        
        # Count occurrences
        word_counts = Counter(filtered_words)
        
        # Return most common words
        return [word for word, _ in word_counts.most_common(max_keywords)]
    
    def _calculate_similarity(self, theme1: Dict, theme2: Dict) -> float:
        """
        Calculate thematic similarity between two themes.
        
        Args:
            theme1: First theme dictionary
            theme2: Second theme dictionary
            
        Returns:
            Similarity score between 0.0 and 1.0
        """
        # Base similarity on keyword overlap
        keywords1 = set(theme1.get("keywords", []))
        keywords2 = set(theme2.get("keywords", []))
        
        if not keywords1 or not keywords2:
            return 0.3  # Default mild similarity if keywords missing
        
        # Calculate Jaccard similarity
        similarity = len(keywords1.intersection(keywords2)) / len(keywords1.union(keywords2))
        
        # Add similarity boost for themes in same section
        if theme1.get("section_id") == theme2.get("section_id"):
            similarity += 0.2
            
        # Cap similarity at 1.0
        return min(similarity, 1.0)
    
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
        
        # Assign each theme its own community ID - this will give each theme its own color
        current_community_id = 0
        
        # Process each theme
        for theme_id, theme_data in self.parser.themes.items():
            theme = theme_data.get('theme', {})
            theme_title = theme.get('title', f"Theme {theme_id}")
            theme_description = theme.get('description', '')
            theme_overview = theme.get('overview', '')
            
            # Find which section this theme belongs to
            section_name = theme_data.get('section', 'Unknown')
            section_id = next((s['id'] for s in sections if s['name'] == section_name), None)
            
            # Extract meaningful keywords from title, description, and overview
            title_keywords = self._extract_keywords(theme_title, 3)
            desc_keywords = self._extract_keywords(theme_description, 3)
            overview_keywords = self._extract_keywords(theme_overview, 4)
            
            # Combine keywords, prioritizing those from title and description
            all_keywords = title_keywords + desc_keywords + overview_keywords
            keywords = list(dict.fromkeys(all_keywords))[:8]  # Remove duplicates and limit
            
            # Count goals as a measure of size
            goals = theme.get('goals', [])
            goal_count = len(goals)
            
            # Create the theme node with enhanced attributes
            theme_node = {
                "id": f"theme_{theme_id}",
                "type": "topic",
                "label": theme_title,
                "description": theme_description,
                "overview": theme_overview,
                "keywords": keywords,
                "size": max(5, goal_count * 2),  # Size based on number of goals
                "community": current_community_id,  # Each theme gets its own community ID
                "community_label": theme_title,     # Use theme title as the community label
                "section_id": section_id,           # Keep track of which section this belongs to
                "section_name": section_name,       # Store the section name
                "level": "primary",                 # Mark as primary node
                "depth": 0,                         # Depth level in hierarchy
                "is_central": True,                 # Each theme is central to its own community
                "docs": []                          # Will be populated with goal IDs
            }
            
            theme_nodes.append(theme_node)
            current_community_id += 1  # Increment for the next theme
        
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
            
            # Get the theme's community for visual consistency
            community_id = theme_map[theme_id]["community"] if theme_id in theme_map else 0
            community_label = theme_map[theme_id]["community_label"] if theme_id in theme_map else "Unknown"
            
            # Add each goal as a document node
            for goal in goals:
                goal_id = goal.get('id', '')
                goal_title = goal.get('title', f"Goal {goal_id}")
                
                # Extract strategies for reference but handle them in the strategy generator
                strategies = goal.get('strategies', [])
                
                # Generate a unique node ID for the goal - standardize the format
                node_id = f"goal_{theme_id}_{goal_id.replace('.', '_')}"
                
                # Create the goal node with enhanced attributes
                goal_node = {
                    "id": node_id,
                    "type": "document",
                    "label": goal_title,
                    "text": goal_title,
                    "theme_id": theme_id,
                    "theme_title": theme_title,
                    "raw_goal_id": goal_id,          # Store the original goal ID for easier lookup later
                    "strategies_count": len(strategies),
                    "community": community_id,       # Same community as parent theme
                    "community_label": community_label,
                    "level": "secondary",            # Mark as secondary node
                    "depth": 1                       # Depth level in hierarchy
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
            
            # Get the community for visual consistency
            community_id = goal_node["community"]
            community_label = goal_node["community_label"]
            
            # Use the raw goal ID directly if available
            raw_goal_id = goal_node.get("raw_goal_id")
            if not raw_goal_id:
                # Fall back to parsing from the goal ID if raw_goal_id is not available
                parts = goal_id.split("_")
                theme_num = int(parts[1])  # Convert to int to match parser's key type
                
                # Try to determine the goal ID format
                if len(parts) >= 3:
                    if parts[2].isdigit() and len(parts) >= 4 and parts[3].isdigit():
                        # Format: goal_1_1_1 -> "1.1"
                        raw_goal_id = f"{parts[2]}.{parts[3]}"
                    else:
                        # Format: goal_1_1_1_2 -> "1.1"
                        raw_goal_id = f"{theme_num}.{parts[2]}"
            
            if not raw_goal_id:
                print(f"Warning: Could not determine goal ID format for {goal_id}")
                continue
            
            # Get the theme data from the parser
            theme_data = self.parser.themes.get(theme_id, {})
            if not theme_data:
                print(f"Warning: Theme {theme_id} not found in parser data")
                continue
                
            # Get goals for the theme
            goals = theme_data.get('theme', {}).get('goals', [])
            
            # Find the matching goal
            goal_data = None
            for goal in goals:
                if goal.get('id') == raw_goal_id:
                    goal_data = goal
                    break
            
            if not goal_data:
                print(f"Warning: Goal {raw_goal_id} not found in theme {theme_id}")
                continue
                
            # Get strategies for the goal
            strategies = goal_data.get('strategies', [])
            if not strategies:
                print(f"Warning: No strategies found for goal {raw_goal_id}")
                continue
                
            # Add each strategy as a separate node
            for i, strategy in enumerate(strategies):
                # Create a unique strategy ID
                strategy_id = f"strategy_{theme_id}_{raw_goal_id.replace('.', '_')}_{i}"
                
                # Create summary label (shortened version of the strategy text)
                summary = strategy[:60] + "..." if len(strategy) > 60 else strategy
                
                strategy_node = {
                    "id": strategy_id,
                    "type": "strategy",           # Specific node type for strategies
                    "label": f"Strategy {i+1}",   # Numbered strategy label
                    "summary": summary,           # Short summary
                    "text": strategy,             # Full strategy text
                    "theme_id": theme_id,
                    "theme_title": theme_title,
                    "goal_id": goal_id,
                    "goal_title": goal_label,
                    "community": community_id,    # Same community as parent goal and theme
                    "community_label": community_label,
                    "level": "tertiary",          # Mark as tertiary node
                    "depth": 2                    # Depth level in hierarchy
                }
                
                strategy_nodes.append(strategy_node)
                
            print(f"Added {len(strategies)} strategies for goal {raw_goal_id} in theme {theme_id}")
        
        print(f"Total strategy nodes created: {len(strategy_nodes)}")
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
        
        # Link goals to themes (child to parent)
        for goal_node in goal_nodes:
            theme_id = goal_node["theme_id"]
            theme_node_id = f"theme_{theme_id}"
            
            links.append({
                "source": goal_node["id"],
                "target": theme_node_id,
                "weight": 1.0,
                "type": "part_of_theme"  # Changed from "belongs_to" for clarity
            })
        
        # Link strategies to goals (child to parent)
        for strategy_node in strategy_nodes:
            goal_id = strategy_node["goal_id"]
            
            links.append({
                "source": strategy_node["id"],
                "target": goal_id,
                "weight": 1.0,
                "type": "part_of_goal"  # Changed from "implements" for clarity
            })
        
        # Link themes to each other based on content similarity
        for i, theme1 in enumerate(theme_nodes):
            for theme2 in theme_nodes[i+1:]:
                # Calculate similarity based on keywords and section
                similarity = self._calculate_similarity(theme1, theme2)
                
                # Only create links for themes with meaningful similarity
                if similarity > 0.2:
                    links.append({
                        "source": theme1["id"],
                        "target": theme2["id"],
                        "weight": round(similarity, 2),
                        "type": "related_to"
                    })
        
        # Debug information to verify we're processing strategies
        if strategy_nodes:
            print(f"Generated {len(strategy_nodes)} strategy nodes and {len([l for l in links if l['type'] == 'part_of_goal'])} strategy links")
        else:
            print("WARNING: No strategy nodes were generated!")
        
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