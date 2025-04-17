"""
Sample data generator for knowledge graphs.
This module implements a graph generator that creates sample data for demonstration purposes.
"""
import json
import random
import numpy as np

from .base_generator import BaseGraphGenerator


class SampleGraphGenerator(BaseGraphGenerator):
    """
    Knowledge graph generator that creates sample data.
    
    This generator doesn't analyze actual document text but instead produces
    a well-structured sample graph for demonstration purposes.
    """
    
    @classmethod
    def get_name(cls):
        return "Sample Data Generator"
    
    @classmethod
    def get_description(cls):
        return "Creates sample data for demonstration purposes without analyzing the document."
    
    def generate_graph(self, document_text, **kwargs):
        """
        Generate a sample knowledge graph without analyzing the document.
        
        Args:
            document_text: The document text (ignored)
            **kwargs: Additional arguments (ignored)
            
        Returns:
            dict: D3.js compatible graph structure
        """
        # Sample strategic vision topics with keywords
        topics = [
            {
                "id": 0,
                "label": "Digital Transformation",
                "keywords": ["digital", "technology", "innovation", "automation", "ai"]
            },
            {
                "id": 1,
                "label": "Environmental Sustainability",
                "keywords": ["sustainability", "environmental", "climate", "carbon", "renewable"]
            },
            {
                "id": 2,
                "label": "Workforce Development",
                "keywords": ["talent", "workforce", "skills", "training", "development"]
            },
            {
                "id": 3,
                "label": "Market Expansion",
                "keywords": ["market", "growth", "expansion", "global", "customer"]
            },
            {
                "id": 4,
                "label": "Innovation & Research",
                "keywords": ["research", "innovation", "development", "technology", "future"]
            },
            {
                "id": 5,
                "label": "Financial Performance",
                "keywords": ["financial", "revenue", "profit", "investment", "shareholder"]
            },
            {
                "id": 6,
                "label": "Customer Experience",
                "keywords": ["customer", "experience", "service", "satisfaction", "relationship"]
            },
            {
                "id": 7,
                "label": "Operational Excellence",
                "keywords": ["operations", "efficiency", "quality", "process", "optimization"]
            },
            {
                "id": 8,
                "label": "Corporate Responsibility",
                "keywords": ["responsibility", "social", "community", "ethics", "governance"]
            },
            {
                "id": 9,
                "label": "Risk Management",
                "keywords": ["risk", "compliance", "security", "management", "resilience"]
            },
            {
                "id": 10,
                "label": "Strategic Partnerships",
                "keywords": ["partnership", "collaboration", "alliance", "ecosystem", "vendor"]
            },
            {
                "id": 11,
                "label": "Infrastructure Development",
                "keywords": ["infrastructure", "facility", "physical", "construction", "equipment"]
            }
        ]
        
        # Sample document segments for each topic
        document_segments = []
        for topic in topics:
            # Create 3-5 sample document segments for each topic
            num_segments = random.randint(3, 5)
            for i in range(num_segments):
                keywords = topic["keywords"]
                random.shuffle(keywords)
                
                # Create a sample document segment with the topic's keywords
                segment = f"Strategic initiative for {topic['label'].lower()}: "
                segment += f"Our {keywords[0]} strategy involves enhancing {keywords[1]} capabilities "
                segment += f"through {keywords[2]} initiatives. We will focus on {keywords[3]} improvement "
                segment += f"and {keywords[4]} development across all business units."
                
                document_segments.append({
                    "id": len(document_segments),
                    "text": segment,
                    "topic": topic["id"]
                })
        
        # Create topic similarities matrix
        n_topics = len(topics)
        similarities = np.zeros((n_topics, n_topics))
        
        # Set similarities between related topics
        # Digital Transformation related to Innovation & Research
        similarities[0, 4] = similarities[4, 0] = 0.75
        # Digital Transformation related to Customer Experience
        similarities[0, 6] = similarities[6, 0] = 0.65
        # Digital Transformation related to Operational Excellence
        similarities[0, 7] = similarities[7, 0] = 0.70
        # Environmental Sustainability related to Corporate Responsibility
        similarities[1, 8] = similarities[8, 1] = 0.80
        # Environmental Sustainability related to Infrastructure Development
        similarities[1, 11] = similarities[11, 1] = 0.60
        # Workforce Development related to Operational Excellence
        similarities[2, 7] = similarities[7, 2] = 0.55
        # Market Expansion related to Customer Experience
        similarities[3, 6] = similarities[6, 3] = 0.75
        # Market Expansion related to Financial Performance
        similarities[3, 5] = similarities[5, 3] = 0.80
        # Market Expansion related to Strategic Partnerships
        similarities[3, 10] = similarities[10, 3] = 0.70
        # Innovation & Research related to Strategic Partnerships
        similarities[4, 10] = similarities[10, 4] = 0.65
        # Financial Performance related to Risk Management
        similarities[5, 9] = similarities[9, 5] = 0.60
        # Corporate Responsibility related to Risk Management
        similarities[8, 9] = similarities[9, 8] = 0.55
        # Risk Management related to Infrastructure Development
        similarities[9, 11] = similarities[11, 9] = 0.50
        
        # Fill diagonal with 1.0 (self-similarity)
        for i in range(n_topics):
            similarities[i, i] = 1.0
        
        # Add some random small similarities for the rest
        for i in range(n_topics):
            for j in range(i+1, n_topics):
                if similarities[i, j] == 0:
                    similarities[i, j] = similarities[j, i] = random.uniform(0.2, 0.4)
        
        # Create communities
        communities = [
            {
                "id": 0,
                "label": "Technology & Innovation",
                "topics": [0, 4, 7],
                "central_topics": [0, 4]
            },
            {
                "id": 1,
                "label": "Market & Customer Focus",
                "topics": [3, 6, 10],
                "central_topics": [3, 6]
            },
            {
                "id": 2,
                "label": "Sustainability & Responsibility",
                "topics": [1, 8, 11],
                "central_topics": [1, 8]
            },
            {
                "id": 3,
                "label": "Performance & Risk",
                "topics": [2, 5, 9],
                "central_topics": [5, 9]
            }
        ]
        
        # Build the graph data structure
        nodes = []
        links = []
        
        # Add topic nodes
        for topic in topics:
            topic_id = f"topic_{topic['id']}"
            
            # Find which community this topic belongs to
            community_id = None
            community_label = None
            is_central = False
            
            for comm in communities:
                if topic["id"] in comm["topics"]:
                    community_id = comm["id"]
                    community_label = comm["label"]
                    is_central = topic["id"] in comm["central_topics"]
                    break
            
            nodes.append({
                "id": topic_id,
                "type": "topic",
                "label": topic["label"],
                "keywords": topic["keywords"],
                "size": len([d for d in document_segments if d["topic"] == topic["id"]]),
                "community": community_id,
                "community_label": community_label,
                "is_central": is_central,
                "docs": []
            })
        
        # Add document nodes and connect to topics
        for doc in document_segments:
            doc_id = f"doc_{doc['id']}"
            topic_id = f"topic_{doc['topic']}"
            
            # Add document to its topic's docs list
            for node in nodes:
                if node["id"] == topic_id:
                    node["docs"].append(doc_id)
            
            nodes.append({
                "id": doc_id,
                "type": "document",
                "label": doc["text"][:50] + "..." if len(doc["text"]) > 50 else doc["text"],
                "text": doc["text"],
                "topic": doc["topic"]
            })
            
            # Create the "belongs_to" link
            links.append({
                "source": doc_id,
                "target": topic_id,
                "weight": random.uniform(0.7, 1.0),
                "type": "belongs_to"
            })
        
        # Create "related_to" links between topics based on similarities
        for i in range(n_topics):
            for j in range(i+1, n_topics):
                similarity = similarities[i, j]
                if similarity > 0.3:  # Only create links for sufficiently similar topics
                    links.append({
                        "source": f"topic_{i}",
                        "target": f"topic_{j}",
                        "weight": similarity,
                        "type": "related_to"
                    })
        
        return {
            "nodes": nodes,
            "links": links
        }