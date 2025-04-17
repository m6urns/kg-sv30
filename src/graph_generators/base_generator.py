"""
Base class for knowledge graph generators.
This module defines the interface that all graph generators should implement.
"""
import abc


class BaseGraphGenerator(abc.ABC):
    """
    Abstract base class for knowledge graph generators.
    
    This class defines the interface that all graph generators must implement to be
    compatible with the Strategic Vision Navigator application.
    """
    
    @abc.abstractmethod
    def generate_graph(self, document_text, **kwargs):
        """
        Generate a knowledge graph from document text.
        
        Args:
            document_text (str): The full text of the document to analyze
            **kwargs: Additional arguments specific to the generator implementation
            
        Returns:
            dict: A dictionary with "nodes" and "links" compatible with D3.js format:
                {
                    "nodes": [
                        {
                            "id": "topic_0",
                            "type": "topic",
                            "label": "Digital Transformation",
                            "keywords": ["digital", "technology", "innovation", ...],
                            "community": 0,
                            "community_label": "Technology & Innovation",
                            "is_central": True,
                            "docs": ["doc_1", "doc_5", ...]
                        },
                        {
                            "id": "doc_0",
                            "type": "document",
                            "label": "Document segment title or preview...",
                            "text": "Full text of the document segment",
                            "topic": 0
                        },
                        ...
                    ],
                    "links": [
                        {
                            "source": "topic_0",
                            "target": "topic_1",
                            "weight": 0.8,
                            "type": "related_to"
                        },
                        {
                            "source": "doc_0",
                            "target": "topic_0",
                            "weight": 0.9,
                            "type": "belongs_to"
                        },
                        ...
                    ]
                }
        """
        pass
    
    @classmethod
    def get_name(cls):
        """
        Get the display name of this generator.
        
        Returns:
            str: The name of the generator to display in the UI
        """
        return cls.__name__
    
    @classmethod
    def get_description(cls):
        """
        Get a description of this generator.
        
        Returns:
            str: A short description of how this generator works
        """
        return "Base knowledge graph generator"