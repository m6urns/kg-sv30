#!/usr/bin/env python3
"""
Generate sample data for the Strategic Vision Navigator.
This script creates a sample dataset that can be used when the PDF extraction fails.
"""
import json
import os
import random
import numpy as np

def generate_sample_strategic_vision_data():
    """
    Generate sample data for the Strategic Vision Navigator.
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
            "size": random.randint(5, 15),
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
    
    # Create the final data structure
    graph_data = {
        "nodes": nodes,
        "links": links
    }
    
    return graph_data

def save_sample_data():
    """Save the generated sample data."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    static_dir = os.path.join(base_dir, 'static')
    
    # Create the directory if it doesn't exist
    os.makedirs(static_dir, exist_ok=True)
    
    # Generate the sample data
    graph_data = generate_sample_strategic_vision_data()
    
    # Save the data
    sample_path = os.path.join(static_dir, 'sample_graph_data.json')
    with open(sample_path, 'w') as f:
        json.dump(graph_data, f, indent=2)
    
    print(f"Sample data saved to {sample_path}")
    
    return sample_path

if __name__ == "__main__":
    save_sample_data()