"""
Knowledge graph generator using OpenAI GPT-4 API.
This module implements a graph generator that uses the OpenAI API to analyze document text
and generate a structured knowledge graph.
"""
import json
import logging
import os
import time
import uuid
from typing import Dict, List, Any, Optional

from .base_generator import BaseGraphGenerator

# Set up logging
logger = logging.getLogger(__name__)

# Optional: Import OpenAI library if it's installed
try:
    import openai
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    logger.warning("OpenAI library not installed. OpenAIGraphGenerator will use mock data.")


class OpenAIGraphGenerator(BaseGraphGenerator):
    """
    Knowledge graph generator using OpenAI GPT-4.
    
    This generator sends the document text to the OpenAI API and asks the model to
    extract topics, relationships, and communities, then formats the response into
    a D3.js-compatible graph structure.
    """
    
    def __init__(self, api_key: Optional[str] = None, model: str = "gpt-4-turbo", max_tokens: int = 4000):
        """
        Initialize the OpenAI graph generator.
        
        Args:
            api_key: OpenAI API key (if None, uses OPENAI_API_KEY environment variable)
            model: OpenAI model to use (default: gpt-4-turbo)
            max_tokens: Maximum tokens in the response
        """
        self.model = model
        self.max_tokens = max_tokens
        
        # Set up OpenAI client if available
        if OPENAI_AVAILABLE:
            # Use provided API key or get from environment
            self.api_key = api_key or os.environ.get("OPENAI_API_KEY")
            if self.api_key:
                openai.api_key = self.api_key
                self.client = openai.OpenAI(api_key=self.api_key)
                logger.info(f"OpenAI client initialized with model: {model}")
            else:
                logger.warning("No OpenAI API key provided. Will use mock data.")
                self.client = None
        else:
            logger.warning("OpenAI library not available. Will use mock data.")
            self.client = None
    
    @classmethod
    def get_name(cls):
        return "OpenAI GPT-4 Graph Generator"
    
    @classmethod
    def get_description(cls):
        return "Uses OpenAI's GPT-4 model to analyze the document, extract topics and relationships, " \
               "and generate a comprehensive knowledge graph structure."
    
    def _split_text(self, text: str, max_chunk_size: int = 12000) -> List[str]:
        """
        Split text into manageable chunks for the OpenAI API.
        
        Args:
            text: The document text to split
            max_chunk_size: Maximum characters per chunk
            
        Returns:
            List of text chunks
        """
        # Simple splitting by paragraphs and then combining until we reach max size
        paragraphs = text.split('\n\n')
        chunks = []
        current_chunk = ""
        
        for paragraph in paragraphs:
            if len(current_chunk) + len(paragraph) < max_chunk_size:
                current_chunk += paragraph + "\n\n"
            else:
                chunks.append(current_chunk)
                current_chunk = paragraph + "\n\n"
        
        # Add the last chunk if it's not empty
        if current_chunk:
            chunks.append(current_chunk)
        
        return chunks
    
    def _create_prompt(self, text_chunk: str) -> str:
        """
        Create a prompt for the OpenAI API.
        
        Args:
            text_chunk: The chunk of document text to analyze
            
        Returns:
            Prompt string for the API
        """
        return f"""You are an expert in strategic vision analysis and knowledge graph creation. Analyze the following strategic vision document excerpt and extract:

1. Main topics and subtopics discussed
2. Relationships between topics (including the strength of these relationships)
3. How topics should be grouped into logical communities
4. Key document segments that exemplify each topic

Return your analysis in the following JSON format:

```json
{{
  "topics": [
    {{
      "id": 0,
      "name": "Topic Name",
      "keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
      "description": "Brief description of the topic"
    }},
    ...
  ],
  "segments": [
    {{
      "id": 0,
      "text": "Extract a relevant segment of text that exemplifies a topic",
      "topic": 0
    }},
    ...
  ],
  "relationships": [
    {{
      "source": 0,
      "target": 1,
      "strength": 0.8
    }},
    ...
  ],
  "communities": [
    {{
      "id": 0,
      "name": "Community Name",
      "topics": [0, 2, 5],
      "central_topics": [0]
    }},
    ...
  ]
}}
```

Document excerpt:

{text_chunk}

Important notes:
- Identify 8-15 distinct topics
- Create 3-5 logical communities
- Generate 2-4 document segments per topic
- Relationships should have strengths between 0.0 and 1.0
- Choose meaningful community names based on their topics
"""
    
    def _query_openai(self, prompt: str) -> Dict[str, Any]:
        """
        Query the OpenAI API with the given prompt.
        
        Args:
            prompt: The prompt to send to the API
            
        Returns:
            Parsed JSON response
        """
        if not self.client:
            logger.warning("OpenAI client not available, using mock data")
            return self._generate_mock_data()
        
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a helpful assistant that analyzes documents and returns structured JSON."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.max_tokens,
                temperature=0.2
            )
            
            # Extract the content from the response
            content = response.choices[0].message.content
            
            # Parse the JSON from the response
            # Find JSON between ```json and ``` if present
            if "```json" in content and "```" in content.split("```json")[1]:
                json_str = content.split("```json")[1].split("```")[0]
            elif "```" in content and "```" in content.split("```")[1]:
                json_str = content.split("```")[1].split("```")[0]
            else:
                json_str = content
            
            # Parse the JSON
            return json.loads(json_str)
        except Exception as e:
            logger.error(f"Error querying OpenAI API: {str(e)}")
            return self._generate_mock_data()
    
    def _generate_mock_data(self) -> Dict[str, Any]:
        """
        Generate mock data for testing when OpenAI API is not available.
        
        Returns:
            Mock data structure
        """
        return {
            "topics": [
                {
                    "id": 0,
                    "name": "Digital Transformation",
                    "keywords": ["digital", "technology", "innovation", "automation", "ai"],
                    "description": "Implementing advanced technologies to streamline operations and enhance experiences"
                },
                {
                    "id": 1,
                    "name": "Environmental Sustainability",
                    "keywords": ["sustainability", "environment", "climate", "carbon", "renewable"],
                    "description": "Reducing environmental impact and developing sustainable practices"
                },
                {
                    "id": 2,
                    "name": "Workforce Development",
                    "keywords": ["talent", "workforce", "skills", "training", "development"],
                    "description": "Building and enhancing workforce capabilities and talent retention"
                }
            ],
            "segments": [
                {
                    "id": 0,
                    "text": "Our digital transformation initiative will leverage AI and automation to streamline customer experiences.",
                    "topic": 0
                },
                {
                    "id": 1,
                    "text": "We commit to reducing our carbon footprint by 30% by 2030 through investment in renewable energy.",
                    "topic": 1
                },
                {
                    "id": 2,
                    "text": "The workforce development program will focus on upskilling employees with critical digital competencies.",
                    "topic": 2
                }
            ],
            "relationships": [
                {"source": 0, "target": 1, "strength": 0.6},
                {"source": 0, "target": 2, "strength": 0.8},
                {"source": 1, "target": 2, "strength": 0.4}
            ],
            "communities": [
                {
                    "id": 0,
                    "name": "Technology & Innovation",
                    "topics": [0],
                    "central_topics": [0]
                },
                {
                    "id": 1,
                    "name": "Sustainability & People",
                    "topics": [1, 2],
                    "central_topics": [1]
                }
            ]
        }
    
    def _combine_results(self, results: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Combine results from multiple API calls into a single structure.
        
        Args:
            results: List of API responses
            
        Returns:
            Combined structure
        """
        if not results:
            return self._generate_mock_data()
        
        # Start with the first result
        combined = results[0]
        
        # Track the next available IDs
        next_topic_id = max([t["id"] for t in combined["topics"]]) + 1 if combined["topics"] else 0
        next_segment_id = max([s["id"] for s in combined["segments"]]) + 1 if combined["segments"] else 0
        next_community_id = max([c["id"] for c in combined["communities"]]) + 1 if combined["communities"] else 0
        
        # Create maps for deduplication
        topic_map = {t["name"].lower(): t["id"] for t in combined["topics"]}
        
        # Process the rest of the results
        for result in results[1:]:
            # Process topics (deduplicate by name)
            for topic in result["topics"]:
                topic_name = topic["name"].lower()
                if topic_name in topic_map:
                    # Existing topic - update keywords if needed
                    existing_id = topic_map[topic_name]
                    existing_topic = next(t for t in combined["topics"] if t["id"] == existing_id)
                    existing_keywords = set(existing_topic["keywords"])
                    for kw in topic["keywords"]:
                        if kw not in existing_keywords and len(existing_keywords) < 10:
                            existing_topic["keywords"].append(kw)
                            existing_keywords.add(kw)
                else:
                    # New topic
                    new_topic = topic.copy()
                    new_topic["id"] = next_topic_id
                    topic_map[topic_name] = next_topic_id
                    combined["topics"].append(new_topic)
                    next_topic_id += 1
            
            # Process segments (always add, but update topic refs)
            for segment in result["segments"]:
                # Find the corresponding topic in the combined set
                original_topic_name = next(t["name"].lower() for t in result["topics"] if t["id"] == segment["topic"])
                if original_topic_name in topic_map:
                    new_segment = segment.copy()
                    new_segment["id"] = next_segment_id
                    new_segment["topic"] = topic_map[original_topic_name]
                    combined["segments"].append(new_segment)
                    next_segment_id += 1
            
            # Process relationships (map to new topic IDs)
            for rel in result["relationships"]:
                source_name = next(t["name"].lower() for t in result["topics"] if t["id"] == rel["source"])
                target_name = next(t["name"].lower() for t in result["topics"] if t["id"] == rel["target"])
                
                if source_name in topic_map and target_name in topic_map:
                    source_id = topic_map[source_name]
                    target_id = topic_map[target_name]
                    
                    # Check if this relationship already exists
                    if not any((r["source"] == source_id and r["target"] == target_id) or 
                              (r["source"] == target_id and r["target"] == source_id) for r in combined["relationships"]):
                        combined["relationships"].append({
                            "source": source_id,
                            "target": target_id,
                            "strength": rel["strength"]
                        })
            
            # For communities, we'll treat them separately rather than trying to merge
            for community in result["communities"]:
                # Map the topic IDs to the new IDs
                new_topics = []
                new_central_topics = []
                
                for topic_id in community["topics"]:
                    topic_name = next(t["name"].lower() for t in result["topics"] if t["id"] == topic_id)
                    if topic_name in topic_map:
                        new_topics.append(topic_map[topic_name])
                
                for topic_id in community["central_topics"]:
                    topic_name = next(t["name"].lower() for t in result["topics"] if t["id"] == topic_id)
                    if topic_name in topic_map:
                        new_central_topics.append(topic_map[topic_name])
                
                if new_topics:
                    combined["communities"].append({
                        "id": next_community_id,
                        "name": community["name"],
                        "topics": new_topics,
                        "central_topics": new_central_topics
                    })
                    next_community_id += 1
        
        return combined
    
    def _convert_to_d3_format(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Convert the OpenAI API response to D3.js compatible format.
        
        Args:
            data: Combined API response
            
        Returns:
            D3.js compatible graph structure
        """
        nodes = []
        links = []
        
        # Process topics
        for topic in data["topics"]:
            topic_id = f"topic_{topic['id']}"
            
            # Find community for this topic
            community_id = None
            community_label = None
            is_central = False
            
            for comm in data["communities"]:
                if topic["id"] in comm["topics"]:
                    community_id = comm["id"]
                    community_label = comm["name"]
                    is_central = topic["id"] in comm["central_topics"]
                    break
            
            # Create topic node
            nodes.append({
                "id": topic_id,
                "type": "topic",
                "label": topic["name"],
                "keywords": topic["keywords"],
                "description": topic.get("description", ""),
                "size": len([s for s in data["segments"] if s["topic"] == topic["id"]]),
                "community": community_id,
                "community_label": community_label,
                "is_central": is_central,
                "docs": []
            })
        
        # Process document segments
        for segment in data["segments"]:
            doc_id = f"doc_{segment['id']}"
            topic_id = f"topic_{segment['topic']}"
            
            # Add document node
            nodes.append({
                "id": doc_id,
                "type": "document",
                "label": segment["text"][:50] + "..." if len(segment["text"]) > 50 else segment["text"],
                "text": segment["text"],
                "topic": segment["topic"]
            })
            
            # Add document to topic's docs list
            for node in nodes:
                if node["id"] == topic_id:
                    node["docs"].append(doc_id)
            
            # Create link between document and topic
            links.append({
                "source": doc_id,
                "target": topic_id,
                "weight": 0.9,  # Default weight for document-topic links
                "type": "belongs_to"
            })
        
        # Process relationships between topics
        for rel in data["relationships"]:
            source_id = f"topic_{rel['source']}"
            target_id = f"topic_{rel['target']}"
            
            links.append({
                "source": source_id,
                "target": target_id,
                "weight": rel["strength"],
                "type": "related_to"
            })
        
        return {
            "nodes": nodes,
            "links": links
        }
    
    def generate_graph(self, document_text, **kwargs):
        """
        Generate a knowledge graph from document text using OpenAI API.
        
        Args:
            document_text: The full text of the document to analyze
            **kwargs: Additional arguments
                - max_chunk_size: Maximum size of text chunks to process (default: 12000)
                - api_key: Override the API key (default: None, uses instance key)
            
        Returns:
            dict: D3.js compatible graph structure
        """
        # Update API key if provided
        if 'api_key' in kwargs:
            self.api_key = kwargs['api_key']
            if OPENAI_AVAILABLE and self.api_key:
                openai.api_key = self.api_key
                self.client = openai.OpenAI(api_key=self.api_key)
        
        max_chunk_size = kwargs.get('max_chunk_size', 12000)
        
        # Split text into chunks
        chunks = self._split_text(document_text, max_chunk_size)
        logger.info(f"Split document into {len(chunks)} chunks")
        
        # Process each chunk with OpenAI
        results = []
        for i, chunk in enumerate(chunks):
            logger.info(f"Processing chunk {i+1}/{len(chunks)}")
            prompt = self._create_prompt(chunk)
            result = self._query_openai(prompt)
            results.append(result)
            
            # Rate limiting - sleep between API calls
            if i < len(chunks) - 1:
                time.sleep(2)
        
        # Combine results from all chunks
        combined_data = self._combine_results(results)
        logger.info(f"Combined data: {len(combined_data['topics'])} topics, {len(combined_data['segments'])} segments")
        
        # Convert to D3.js format
        graph_data = self._convert_to_d3_format(combined_data)
        logger.info(f"Generated graph with {len(graph_data['nodes'])} nodes and {len(graph_data['links'])} links")
        
        return graph_data