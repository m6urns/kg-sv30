"""
Structured JSON data generator for knowledge graphs.
This module implements a graph generator that creates data from structured JSON files.
Enhanced with semantic similarity using word embeddings.
"""
import json
import os
import random
import sys
import math
import re
from typing import Dict, List, Any, Tuple
from collections import Counter, defaultdict

import warnings
warnings.filterwarnings("ignore", message="numpy.dtype size changed")

try:
    import numpy as np
    from sentence_transformers import SentenceTransformer
    print("Successfully imported sentence-transformers")
    EMBEDDINGS_AVAILABLE = True
except ImportError as e:
    print(f"Warning: Could not import sentence-transformers: {e}")
    EMBEDDINGS_AVAILABLE = False
except Exception as e:
    print(f"Warning: Unexpected error importing sentence-transformers: {e}")
    EMBEDDINGS_AVAILABLE = False

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
        
        # Configuration for semantic similarity
        self.use_embeddings = EMBEDDINGS_AVAILABLE  # Use embeddings if available
        self.min_cross_theme_connections = 0  # Minimum cross-theme connections per strategy
        self.embedding_weight = 0.6  # Weight given to embedding similarity vs keyword-based
        
        # Initialize embedding model if available
        if self.use_embeddings:
            try:
                # Use a small but effective model to start
                self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
                print("Embedding model loaded successfully for semantic similarity")
            except Exception as e:
                print(f"Error loading embedding model: {e}")
                self.use_embeddings = False
                
        # Cache for strategy embeddings to avoid recalculating
        self.embedding_cache = {}
    
    def configure_semantic_similarity(self, use_embeddings=True, min_cross_theme_connections=2, embedding_weight=0.7):
        """
        Configure the semantic similarity parameters
        
        Args:
            use_embeddings: Whether to use word embeddings for similarity
            min_cross_theme_connections: Minimum number of cross-theme connections per strategy
            embedding_weight: Weight given to embedding similarity (0-1) vs keyword similarity
        """
        # Update configuration
        self.use_embeddings = use_embeddings and EMBEDDINGS_AVAILABLE
        self.min_cross_theme_connections = min_cross_theme_connections
        self.embedding_weight = max(0.0, min(1.0, embedding_weight))  # Ensure between 0-1
        
        # Reinitialize embedding model if needed
        if self.use_embeddings and not hasattr(self, 'embedding_model'):
            try:
                self.embedding_model = SentenceTransformer('all-MiniLM-L6-v2')
                print("Embedding model loaded successfully")
            except Exception as e:
                print(f"Error loading embedding model: {e}")
                self.use_embeddings = False
                
        print(f"Semantic similarity configured: embeddings={self.use_embeddings}, "
              f"min_cross_theme={self.min_cross_theme_connections}, embedding_weight={self.embedding_weight}")
        
        # Clear the embedding cache when configuration changes
        self.embedding_cache = {}
    
    def _get_text_embedding(self, text):
        """
        Generate embedding vector for text
        
        Args:
            text: The text to embed
            
        Returns:
            numpy array of embedding vector or None if embeddings not available
        """
        if not self.use_embeddings or not text:
            return None
        
        # Check cache first
        if text in self.embedding_cache:
            return self.embedding_cache[text]
        
        try:
            # Generate embedding (normalize=True ensures vectors are unit length for cosine similarity)
            embedding = self.embedding_model.encode(text, normalize_embeddings=True)
            self.embedding_cache[text] = embedding
            return embedding
        except Exception as e:
            print(f"Error generating embedding: {e}")
            return None
    
    def _calculate_embedding_similarity(self, embedding1, embedding2):
        """
        Calculate cosine similarity between embeddings
        
        Args:
            embedding1: First embedding vector
            embedding2: Second embedding vector
            
        Returns:
            Similarity score between 0.0 and 1.0
        """
        if embedding1 is None or embedding2 is None:
            return 0.0
        
        try:
            # For normalized vectors, dot product equals cosine similarity
            return float(np.dot(embedding1, embedding2))
        except Exception as e:
            print(f"Error calculating embedding similarity: {e}")
            return 0.0
    
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
            
        # Convert to lowercase
        text = text.lower()
        
        # Remove punctuation and replace with spaces
        text = re.sub(r'[^\w\s]', ' ', text)
        
        # Split into words
        words = text.split()
        
        # Clean each word (strip any remaining punctuation)
        words = [re.sub(r'[^\w]', '', word) for word in words]
        
        # Remove common stopwords and short words
        # Added city-specific stopwords like "long", "beach", "city", etc.
        stopwords = set(['the', 'and', 'is', 'of', 'to', 'in', 'for', 'a', 'with', 'that', 'are', 'by', 'on', 'as',
                         'be', 'all', 'an', 'at', 'but', 'by', 'can', 'from', 'have', 'he', 'i', 'more', 'not', 
                         'or', 'such', 'they', 'this', 'through', 'we', 'was', 'will', 'our', 'their', 'these',
                         'long', 'beach', 'city', 'community', 'communities', 'plan', 'plans', 'vision', 'visions',
                         'strategic', 'strategy', 'strategies', 'goal', 'goals', 'theme', 'themes'])
        filtered_words = [word for word in words if word not in stopwords and len(word) > 3]
        
        # Count occurrences in this text
        word_counts = Counter(filtered_words)
        
        # TF-IDF approach: This is a simplified version since we don't have a corpus
        # We'll use the document terms frequency to determine importance
        # Instead of just counting occurrences, we'll calculate a score
        # that prioritizes distinctive words
        
        # Get the total corpus frequency if already calculated
        if not hasattr(self, '_corpus_word_counts'):
            # Initialize an empty corpus counter the first time
            self._corpus_word_counts = Counter()
            self._document_count = 0
            
        # Get document term frequencies
        tf_scores = {}
        total_words = sum(word_counts.values())
        
        if total_words == 0:
            return []
            
        # Calculate TF score for each word (term frequency in this document)
        for word, count in word_counts.items():
            tf_scores[word] = count / total_words
        
        # For the first call, we don't have IDF information yet, so we'll just use TF
        if self._document_count == 0:
            # Update corpus statistics for future calls
            self._corpus_word_counts.update(word_counts)
            self._document_count += 1
            
            # Return words sorted by term frequency
            return [word for word, _ in sorted(tf_scores.items(), key=lambda x: x[1], reverse=True)[:max_keywords]]
        
        # For subsequent calls, we can use TF-IDF
        tfidf_scores = {}
        
        # Calculate TF-IDF score for each word
        for word, tf in tf_scores.items():
            # Number of documents containing this word
            doc_count = 1  # Add 1 to avoid division by zero
            if word in self._corpus_word_counts:
                doc_count += self._corpus_word_counts[word]
                
            # IDF = log(total_docs / docs_with_term)
            idf = math.log(self._document_count / doc_count + 1)
            tfidf_scores[word] = tf * idf
            
        # Update corpus statistics for future calls
        self._corpus_word_counts.update(word_counts)
        self._document_count += 1
        
        # Return words with highest TF-IDF scores
        return [word for word, _ in sorted(tfidf_scores.items(), key=lambda x: x[1], reverse=True)[:max_keywords]]
    
    def _calculate_similarity(self, node1: Dict, node2: Dict) -> float:
        """
        Calculate similarity between two nodes based on their keywords or text.
        Enhanced with semantic similarity from word embeddings when available.
        
        Args:
            node1: First node dictionary
            node2: Second node dictionary
            
        Returns:
            Similarity score between 0.0 and 1.0
        """
        # For theme nodes, use existing keywords approach
        if node1.get("type") == "topic" and node2.get("type") == "topic":
            keywords1 = set(node1.get("keywords", []))
            keywords2 = set(node2.get("keywords", []))
            
            if not keywords1 or not keywords2:
                return 0.3  # Default mild similarity if keywords missing
            
            # Calculate Jaccard similarity
            similarity = len(keywords1.intersection(keywords2)) / len(keywords1.union(keywords2))
            
            # Add similarity boost for themes in same section
            if node1.get("section_id") == node2.get("section_id"):
                similarity += 0.2
                
            # Cap similarity at 1.0
            return min(similarity, 1.0)
        
        # For strategy nodes, use both keyword and embedding similarity
        elif node1.get("type") == "strategy" and node2.get("type") == "strategy":
            # Extract keywords from strategy text
            text1 = node1.get("text", "")
            text2 = node2.get("text", "")
            
            # Extract more keywords from strategies for better matching
            keywords1 = set(self._extract_keywords(text1, max_keywords=12))
            keywords2 = set(self._extract_keywords(text2, max_keywords=12))
            
            # Calculate keyword-based similarity (Jaccard)
            if not keywords1 or not keywords2:
                keyword_sim = 0.0
            else:
                keyword_sim = len(keywords1.intersection(keywords2)) / len(keywords1.union(keywords2))
            
            # Calculate semantic similarity if embeddings are enabled
            embedding_sim = 0.0
            if self.use_embeddings:
                embedding1 = self._get_text_embedding(text1)
                embedding2 = self._get_text_embedding(text2)
                embedding_sim = self._calculate_embedding_similarity(embedding1, embedding2)
            
            # Combine similarities (weighted average)
            # Give more weight to semantic similarity if enabled
            similarity = (
                ((1 - self.embedding_weight) * keyword_sim) + (self.embedding_weight * embedding_sim) 
                if self.use_embeddings else keyword_sim
            )
            
            # Add similarity boost for strategies in same theme
            if node1.get("theme_id") == node2.get("theme_id"):
                similarity += 0.1
            
            # Add a small boost for cross-theme connections to encourage exploration
            elif self.use_embeddings and similarity > 0.2:
                # Small boost to encourage cross-theme connections with decent similarity
                similarity += 0.05
                
            # Cap similarity at 1.0
            return min(similarity, 1.0)
        
        # Default for other node combinations
        return 0.0
    
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
                
                # Include section number in the label for better clarity when displayed
                labeled_goal_title = f"{goal_id}: {goal_title}"
                
                # Extract strategies for reference but handle them in the strategy generator
                strategies = goal.get('strategies', [])
                
                # Create an HTML representation of strategies for display when this goal is clicked
                strategy_html = f"<h3>{labeled_goal_title}</h3><ul>"
                for i, strategy in enumerate(strategies):
                    # Create section number for the strategy (e.g., "1.1.1")
                    strategy_section = f"{goal_id}.{i+1}"
                    strategy_html += f'<li><strong>{strategy_section}</strong>: {strategy}</li>'
                strategy_html += "</ul>"
                
                # Generate a unique node ID for the goal - standardize the format
                node_id = f"goal_{theme_id}_{goal_id.replace('.', '_')}"
                
                # Prepare an array of strategy entries for UI rendering
                strategy_entries = []
                for i, strategy in enumerate(strategies):
                    strategy_section = f"{goal_id}.{i+1}"
                    strategy_id = f"strategy_{theme_id}_{goal_id.replace('.', '_')}_{i}"
                    strategy_entries.append({
                        "id": strategy_id,
                        "section": strategy_section,
                        "text": strategy,
                        "summary": strategy[:60] + "..." if len(strategy) > 60 else strategy,
                        "url": f"#/node/{strategy_id}" # Navigation URL for frontend
                    })
                
                # Create the goal node with enhanced attributes
                goal_node = {
                    "id": node_id,
                    "type": "document",
                    "label": labeled_goal_title,              # Now includes section number
                    "text": goal_title,
                    "section_number": goal_id,                # Store section number separately
                    "theme_id": theme_id,
                    "theme_title": theme_title,
                    "raw_goal_id": goal_id,                   # Store the original goal ID for easier lookup later
                    "strategies_count": len(strategies),
                    "strategies_html": strategy_html,         # HTML representation for display
                    "strategy_entries": strategy_entries,     # Structured data for UI rendering
                    "display_type": "strategy_list",          # Hint for UI to display as a list of clickable strategies
                    "community": community_id,                # Same community as parent theme
                    "community_label": community_label,
                    "level": "secondary",                     # Mark as secondary node
                    "depth": 1                                # Depth level in hierarchy
                }
                
                # Add has_strategy_links flag if the goal has strategies
                if len(strategies) > 0:
                    goal_node["has_strategy_links"] = True
                
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
            section_number = goal_node.get("section_number", "")
            
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
                
                # Create section number for the strategy (e.g., "1.1.1")
                strategy_section = f"{section_number}.{i+1}"
                
                # Create summary label (shortened version of the strategy text)
                summary = strategy[:60] + "..." if len(strategy) > 60 else strategy
                
                # Include section number in the label
                labeled_strategy = f"{strategy_section}: {summary}"
                
                strategy_node = {
                    "id": strategy_id,
                    "type": "strategy",               # Specific node type for strategies
                    "label": f"Strategy {strategy_section}",  # Use section number for better identification
                    "display_label": labeled_strategy, # Detailed label for UI display
                    "section_number": strategy_section, # Strategy section number
                    "summary": summary,               # Short summary
                    "text": strategy,                 # Full strategy text
                    "index": i+1,                     # Strategy number within goal
                    "theme_id": theme_id,
                    "theme_title": theme_title,
                    "goal_id": goal_id,
                    "goal_title": goal_label,
                    "raw_goal_id": raw_goal_id,       # Original goal ID
                    "community": community_id,        # Same community as parent goal and theme
                    "community_label": community_label,
                    "level": "tertiary",              # Mark as tertiary node
                    "depth": 2                        # Depth level in hierarchy
                }
                
                strategy_nodes.append(strategy_node)
                
            print(f"Added {len(strategies)} strategies for goal {raw_goal_id} in theme {theme_id}")
        
        print(f"Total strategy nodes created: {len(strategy_nodes)}")
        return strategy_nodes
    
    def _generate_links(self, theme_nodes: List[Dict[str, Any]], goal_nodes: List[Dict[str, Any]], 
                        strategy_nodes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Generate links between nodes with enhanced cross-theme connectivity.
        
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
                "type": "part_of_theme"
            })
        
        # Link strategies to goals (child to parent)
        for strategy_node in strategy_nodes:
            goal_id = strategy_node["goal_id"]
            
            links.append({
                "source": strategy_node["id"],
                "target": goal_id,
                "weight": 1.0,
                "type": "part_of_goal"
            })
        
        # Adjust thresholds based on whether we're using embeddings
        if self.use_embeddings:
            # Lower thresholds when using embeddings
            SAME_THEME_THRESHOLD = 0.45       # Threshold for strategies in same theme
            CROSS_THEME_THRESHOLD = 0.38       # Lower threshold for cross-theme connections
        else:
            # Original threshold
            SAME_THEME_THRESHOLD = 0.12
            CROSS_THEME_THRESHOLD = 0.12
        
        # Count similarity links
        similarity_link_count = 0
        cross_theme_link_count = 0
        
        # Track cross-theme connections per strategy
        cross_theme_connections = defaultdict(int)
        
        # First pass: Create links based on similarity thresholds
        for i, strategy1 in enumerate(strategy_nodes):
            for strategy2 in strategy_nodes[i+1:]:
                # Skip strategies in the same goal
                if strategy1["goal_id"] == strategy2["goal_id"]:
                    continue
                
                # Calculate similarity
                similarity = self._calculate_similarity(strategy1, strategy2)
                
                # Use different thresholds for same-theme vs cross-theme
                is_cross_theme = strategy1["theme_id"] != strategy2["theme_id"]
                threshold = CROSS_THEME_THRESHOLD if is_cross_theme else SAME_THEME_THRESHOLD
                
                # Create link if similarity is above threshold
                if similarity >= threshold:
                    links.append({
                        "source": strategy1["id"],
                        "target": strategy2["id"],
                        "weight": round(similarity, 2),
                        "type": "similar_content"
                    })
                    similarity_link_count += 1
                    
                    # Track cross-theme connections
                    if is_cross_theme:
                        cross_theme_connections[strategy1["id"]] += 1
                        cross_theme_connections[strategy2["id"]] += 1
                        cross_theme_link_count += 1
        
        # Second pass: Ensure minimum cross-theme connections (if enabled)
        if self.use_embeddings and self.min_cross_theme_connections > 0:
            # Group strategies by theme
            strategies_by_theme = defaultdict(list)
            for strategy in strategy_nodes:
                strategies_by_theme[strategy["theme_id"]].append(strategy)
            
            # Process strategies with insufficient cross-theme connections
            for strategy in strategy_nodes:
                if cross_theme_connections[strategy["id"]] < self.min_cross_theme_connections:
                    needed = self.min_cross_theme_connections - cross_theme_connections[strategy["id"]]
                    
                    # Find candidate connections from other themes
                    candidates = []
                    for other_theme, theme_strategies in strategies_by_theme.items():
                        if other_theme == strategy["theme_id"]:
                            continue  # Skip same theme
                        
                        for other_strategy in theme_strategies:
                            # Skip if we already have a connection
                            connection_exists = any(
                                (link["source"] == strategy["id"] and link["target"] == other_strategy["id"]) or
                                (link["source"] == other_strategy["id"] and link["target"] == strategy["id"])
                                for link in links if link["type"] == "similar_content"
                            )
                            
                            if not connection_exists:
                                similarity = self._calculate_similarity(strategy, other_strategy)
                                if similarity > 0:  # Any non-zero similarity
                                    candidates.append((other_strategy, similarity))
                    
                    # Sort by similarity (highest first)
                    candidates.sort(key=lambda x: x[1], reverse=True)
                    
                    # Add top N needed connections
                    added_connections = 0
                    for other_strategy, similarity in candidates[:needed]:
                        links.append({
                            "source": strategy["id"],
                            "target": other_strategy["id"],
                            "weight": round(max(similarity, 0.05), 2),  # Ensure minimum weight of 0.05
                            "type": "similar_content"
                        })
                        similarity_link_count += 1
                        cross_theme_link_count += 1
                        cross_theme_connections[strategy["id"]] += 1
                        cross_theme_connections[other_strategy["id"]] += 1
                        added_connections += 1
                    
                    if added_connections > 0:
                        print(f"Added {added_connections} enforced cross-theme connections for strategy {strategy['id']}")
        
        # Debug information
        if strategy_nodes:
            print(f"Generated {len(strategy_nodes)} strategy nodes and {len([l for l in links if l['type'] == 'part_of_goal'])} strategy links")
            print(f"Created {similarity_link_count} similarity links between strategies")
            print(f"Cross-theme similarity links: {cross_theme_link_count} ({round(cross_theme_link_count/max(1, similarity_link_count)*100, 1)}% of total)")
        else:
            print("WARNING: No strategy nodes were generated!")
        
        return links
    
    def _add_connections_to_nodes(self, all_nodes: List[Dict[str, Any]], links: List[Dict[str, Any]]) -> None:
        """
        Add a 'connections' attribute to strategy nodes listing similar strategies.
        
        Args:
            all_nodes: List of all node dictionaries
            links: List of all link dictionaries
        """
        # Create a dictionary for quick node lookup
        node_map = {node["id"]: node for node in all_nodes}
        
        # Get all strategy nodes
        strategy_nodes = [node for node in all_nodes if node["type"] == "strategy"]
        
        # Initialize connections attribute for each strategy node
        for node in strategy_nodes:
            node["connections"] = []
        
        # Process each link
        for link in links:
            source_id = link["source"]
            target_id = link["target"]
            link_type = link["type"]
            weight = link.get("weight", 1.0)
            
            # Skip hierarchical relationship links
            if link_type in ["part_of_theme", "part_of_goal"]:
                continue
            
            # Only process similarity links between strategies
            if link_type != "similar_content":
                continue
                
            # Check if both source and target are strategy nodes
            source_node = node_map.get(source_id)
            target_node = node_map.get(target_id)
            
            if not source_node or not target_node:
                continue
                
            if source_node["type"] == "strategy" and target_node["type"] == "strategy":
                # Add connection to source node
                source_node["connections"].append({
                    "node_id": target_id,
                    "node_label": target_node.get("display_label", target_node["label"]),
                    "node_type": target_node["type"],
                    "link_type": link_type,
                    "weight": weight,
                    "goal_id": target_node.get("goal_id", ""),
                    "goal_title": target_node.get("goal_title", ""),
                    "theme_id": target_node.get("theme_id", ""),
                    "theme_title": target_node.get("theme_title", "")
                })
                
                # Add connection to target node
                target_node["connections"].append({
                    "node_id": source_id,
                    "node_label": source_node.get("display_label", source_node["label"]),
                    "node_type": source_node["type"],
                    "link_type": link_type,
                    "weight": weight,
                    "goal_id": source_node.get("goal_id", ""),
                    "goal_title": source_node.get("goal_title", ""),
                    "theme_id": source_node.get("theme_id", ""),
                    "theme_title": source_node.get("theme_title", "")
                })
        
        # Sort connections by weight (highest first) for each strategy node
        for node in strategy_nodes:
            node["connections"].sort(key=lambda x: x["weight"], reverse=True)
            
            # Add cross-theme connection count
            cross_theme_count = sum(1 for conn in node["connections"] 
                                  if conn["theme_id"] != node["theme_id"])
            node["cross_theme_connections"] = cross_theme_count
    
    def generate_graph(self, document_text, **kwargs):
        """
        Generate a knowledge graph from the structured JSON data.
        
        Args:
            document_text: Ignored, kept for API compatibility
            **kwargs: Additional arguments
                use_embeddings: Whether to use word embeddings (default: True if available)
                min_cross_theme_connections: Minimum cross-theme connections (default: 2)
                embedding_weight: Weight for embedding vs keyword similarity (default: 0.7)
            
        Returns:
            dict: D3.js compatible graph structure
        """
        # Configure semantic similarity from kwargs if provided
        if 'use_embeddings' in kwargs or 'min_cross_theme_connections' in kwargs or 'embedding_weight' in kwargs:
            self.configure_semantic_similarity(
                use_embeddings=kwargs.get('use_embeddings', self.use_embeddings),
                min_cross_theme_connections=kwargs.get('min_cross_theme_connections', self.min_cross_theme_connections),
                embedding_weight=kwargs.get('embedding_weight', self.embedding_weight)
            )
        
        # Generate nodes for themes, goals, and strategies
        theme_nodes = self._generate_theme_nodes()
        goal_nodes = self._generate_goal_nodes(theme_nodes)
        strategy_nodes = self._generate_strategy_nodes(goal_nodes)
        
        # Generate links between nodes
        links = self._generate_links(theme_nodes, goal_nodes, strategy_nodes)
        
        # Combine all nodes
        all_nodes = theme_nodes + goal_nodes + strategy_nodes
        
        # Add connections information to nodes
        self._add_connections_to_nodes(all_nodes, links)
        
        # Add strategies to goal metadata for better UI rendering when a goal is clicked
        goal_map = {node["id"]: node for node in goal_nodes}
        
        # Group strategies by goal
        goal_strategies = {}
        for strategy in strategy_nodes:
            goal_id = strategy["goal_id"]
            if goal_id not in goal_strategies:
                goal_strategies[goal_id] = []
            
            # Create a simplified strategy representation for the UI
            strategy_info = {
                "id": strategy["id"],
                "section": strategy["section_number"],
                "text": strategy["text"],
                "summary": strategy["summary"],
                "url": f"#/node/{strategy['id']}"  # Direct link to the strategy node
            }
            goal_strategies[goal_id].append(strategy_info)
        
        # Add strategies to each goal node if not already present
        for goal_id, strategies in goal_strategies.items():
            if goal_id in goal_map and "strategy_entries" not in goal_map[goal_id]:
                # Sort strategies by section number
                strategies.sort(key=lambda s: s["section"])
                goal_map[goal_id]["strategy_entries"] = strategies
        
        # Add updated visualization metadata for the UI
        visualization_metadata = {
            "node_types": {
                "topic": {"label": "Theme", "icon": "circle", "size": "large"},
                "document": {"label": "Goal", "icon": "square", "size": "large"},
                "strategy": {"label": "Strategy", "icon": "triangle", "size": "small"}
            },
            "link_types": {
                "part_of_theme": {"label": "Part of Theme", "style": "solid", "arrow": True},
                "part_of_goal": {"label": "Part of Goal", "style": "solid", "arrow": True},
                "similar_content": {"label": "Similar Content", "style": "dashed", "arrow": False}
            },
            "layout": {
                "hierarchical": True,
                "levels": 3,
                "section_key": "section_number"
            },
            "interactions": {
                "goal_click": {
                    "display": "strategy_list", 
                    "source": "strategy_entries",
                    "clickable": True,
                    "title_field": "label",           
                    "item_format": "{section}: {summary}", 
                    "link_field": "url"               
                },
                "strategy_click": {
                    "display": "text",
                    "source": "text",
                    "title_format": "{section_number}: Strategy",
                    "additional_panels": [
                        {
                            "display": "connection_list",
                            "source": "connections",
                            "title": "Similar Strategies",
                            "item_format": "{node_label} - {theme_title} ({weight})",
                            "empty_message": "No similar strategies found",
                            "clickable": True,
                            "link_field": "node_id"
                        }
                    ]
                }
            },
            "similarity_info": {
                "method": "semantic" if self.use_embeddings else "keyword",
                "min_cross_theme": self.min_cross_theme_connections,
                "embedding_weight": self.embedding_weight if self.use_embeddings else 0
            }
        }
        
        return {
            "nodes": all_nodes,
            "links": links,
            "metadata": visualization_metadata
        }