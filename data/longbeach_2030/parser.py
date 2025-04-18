#!/usr/bin/env python3
"""
Long Beach 2030 Strategic Vision Parser

This module provides functionality to parse and analyze the structured data 
extracted from the Long Beach 2030 Strategic Vision document.

Example:
    from lb2030_parser import LongBeach2030Parser
    
    parser = LongBeach2030Parser('path/to/index.json')
    parser.load_all_themes()
    
    # Get all themes
    all_themes = parser.get_all_themes()
    
    # Get themes by section
    community_themes = parser.get_themes_by_section("Our Community")
    
    # Get specific theme
    housing_theme = parser.get_theme_by_id(4)
    
    # Get all goals for a specific theme
    housing_goals = parser.get_goals_for_theme(4)
    
    # Get specific goal
    goal = parser.get_goal_by_id(4, "4.2")
    
    # Search for strategies containing keywords
    climate_strategies = parser.search_strategies("climate change")
"""

import json
import os
import re
from typing import Dict, List, Optional, Union


class LongBeach2030Parser:
    """Parser for the Long Beach 2030 Strategic Vision data."""

    def __init__(self, index_path: str):
        """
        Initialize the parser with the path to the index.json file.
        
        Args:
            index_path: Path to the index.json file
        """
        self.index_path = index_path
        self.base_dir = os.path.dirname(index_path)
        self.index_data = {}
        self.themes = {}
        self._load_index()
    
    def _load_index(self) -> None:
        """Load the index file."""
        try:
            with open(self.index_path, 'r', encoding='utf-8') as f:
                self.index_data = json.load(f)
            print(f"Successfully loaded index from {self.index_path}")
        except FileNotFoundError:
            print(f"Error: Index file not found at {self.index_path}")
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON in index file at {self.index_path}")
    
    def load_theme(self, theme_id: int) -> bool:
        """
        Load a specific theme from its JSON file.
        
        Args:
            theme_id: The ID of the theme to load
            
        Returns:
            True if the theme was loaded successfully, False otherwise
        """
        # Find the theme in the index
        theme_info = None
        for section in self.index_data.get('sections', []):
            for theme in section.get('themes', []):
                if theme.get('id') == theme_id:
                    theme_info = theme
                    break
            if theme_info:
                break
        
        if not theme_info:
            print(f"Error: Theme with ID {theme_id} not found in index")
            return False
        
        # Load the theme file
        theme_path = os.path.join(self.base_dir, theme_info.get('file_path', ''))
        try:
            with open(theme_path, 'r', encoding='utf-8') as f:
                theme_data = json.load(f)
                self.themes[theme_id] = theme_data
                print(f"Successfully loaded theme {theme_id}: {theme_info.get('title')}")
                return True
        except FileNotFoundError:
            print(f"Error: Theme file not found at {theme_path}")
        except json.JSONDecodeError:
            print(f"Error: Invalid JSON in theme file at {theme_path}")
        
        return False
    
    def load_all_themes(self) -> None:
        """Load all themes listed in the index."""
        for section in self.index_data.get('sections', []):
            for theme in section.get('themes', []):
                theme_id = theme.get('id')
                if theme_id:
                    self.load_theme(theme_id)
    
    def get_all_themes(self) -> Dict:
        """
        Get all loaded themes.
        
        Returns:
            Dictionary of theme data keyed by theme ID
        """
        return self.themes
    
    def get_themes_by_section(self, section_name: str) -> Dict[int, Dict]:
        """
        Get all themes belonging to a specific section.
        
        Args:
            section_name: Name of the section (e.g., "Our Community")
            
        Returns:
            Dictionary of theme data keyed by theme ID
        """
        section_themes = {}
        
        # Find the section ID
        section_id = None
        for section in self.index_data.get('sections', []):
            if section.get('name') == section_name:
                section_id = section.get('id')
                break
        
        if not section_id:
            print(f"Error: Section '{section_name}' not found in index")
            return {}
        
        # Get all themes in this section
        for section in self.index_data.get('sections', []):
            if section.get('id') == section_id:
                for theme in section.get('themes', []):
                    theme_id = theme.get('id')
                    if theme_id in self.themes:
                        section_themes[theme_id] = self.themes[theme_id]
        
        return section_themes
    
    def get_theme_by_id(self, theme_id: int) -> Optional[Dict]:
        """
        Get a specific theme by its ID.
        
        Args:
            theme_id: The ID of the theme
            
        Returns:
            Theme data dictionary or None if not found
        """
        if theme_id not in self.themes:
            if not self.load_theme(theme_id):
                return None
        
        return self.themes.get(theme_id)
    
    def get_goals_for_theme(self, theme_id: int) -> List[Dict]:
        """
        Get all goals for a specific theme.
        
        Args:
            theme_id: The ID of the theme
            
        Returns:
            List of goal dictionaries
        """
        theme = self.get_theme_by_id(theme_id)
        if not theme:
            return []
        
        return theme.get('theme', {}).get('goals', [])
    
    def get_goal_by_id(self, theme_id: int, goal_id: str) -> Optional[Dict]:
        """
        Get a specific goal by its ID within a theme.
        
        Args:
            theme_id: The ID of the theme
            goal_id: The ID of the goal (e.g., "1.1")
            
        Returns:
            Goal dictionary or None if not found
        """
        goals = self.get_goals_for_theme(theme_id)
        for goal in goals:
            if goal.get('id') == goal_id:
                return goal
        
        return None
    
    def search_strategies(self, search_term: str) -> List[Dict]:
        """
        Search for strategies containing the given search term.
        
        Args:
            search_term: Term to search for in strategies
            
        Returns:
            List of dictionaries containing matching strategies with their context
        """
        results = []
        search_pattern = re.compile(re.escape(search_term), re.IGNORECASE)
        
        for theme_id, theme_data in self.themes.items():
            theme = theme_data.get('theme', {})
            theme_title = theme.get('title', f"Theme {theme_id}")
            
            for goal in theme.get('goals', []):
                goal_id = goal.get('id', '')
                goal_title = goal.get('title', f"Goal {goal_id}")
                
                for i, strategy in enumerate(goal.get('strategies', [])):
                    if search_pattern.search(strategy):
                        results.append({
                            'theme_id': theme_id,
                            'theme_title': theme_title,
                            'goal_id': goal_id,
                            'goal_title': goal_title,
                            'strategy_index': i,
                            'strategy_text': strategy
                        })
        
        return results
    
    def get_informed_by_plans(self, theme_id: int) -> List[str]:
        """
        Get the list of plans that informed a specific theme.
        
        Args:
            theme_id: The ID of the theme
            
        Returns:
            List of plan names
        """
        theme = self.get_theme_by_id(theme_id)
        if not theme:
            return []
        
        return theme.get('theme', {}).get('informed_by', [])
    
    def get_all_informed_by_plans(self) -> Dict[str, List[int]]:
        """
        Get all plans that informed the strategic vision and the themes they informed.
        
        Returns:
            Dictionary mapping plan names to lists of theme IDs
        """
        plans = {}
        
        for theme_id, theme_data in self.themes.items():
            theme_plans = theme_data.get('theme', {}).get('informed_by', [])
            for plan in theme_plans:
                if plan not in plans:
                    plans[plan] = []
                plans[plan].append(theme_id)
        
        return plans
    
    def get_anchors(self) -> Dict[str, str]:
        """
        Get the anchor concepts of the strategic vision.
        
        Returns:
            Dictionary of anchor names to descriptions
        """
        return self.index_data.get('anchors', {})
    
    def get_vision_statement(self) -> str:
        """
        Get the vision statement of the strategic vision.
        
        Returns:
            Vision statement string
        """
        return self.index_data.get('vision_statement', '')
        
    def get_strategy(self, theme_id: int, goal_id: str, strategy_index: int) -> Optional[str]:
        """
        Get a specific strategy by its theme ID, goal ID, and index.
        
        Args:
            theme_id: The ID of the theme
            goal_id: The ID of the goal (e.g., "1.1")
            strategy_index: The index of the strategy within the goal's strategies list
            
        Returns:
            The strategy text or None if not found
        """
        goal = self.get_goal_by_id(theme_id, goal_id)
        if not goal:
            return None
        
        strategies = goal.get('strategies', [])
        if 0 <= strategy_index < len(strategies):
            return strategies[strategy_index]
        
        return None
        
    def get_all_strategies_for_goal(self, theme_id: int, goal_id: str) -> List[str]:
        """
        Get all strategies for a specific goal.
        
        Args:
            theme_id: The ID of the theme
            goal_id: The ID of the goal (e.g., "1.1")
            
        Returns:
            List of strategy strings
        """
        goal = self.get_goal_by_id(theme_id, goal_id)
        if not goal:
            return []
        
        return goal.get('strategies', [])