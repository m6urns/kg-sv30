import networkx as nx
from networkx.algorithms import community
import json
import random

def build_knowledge_graph(topics_data, doc_segments, threshold=0.3):
    """
    Build knowledge graph from topic model.
    
    Args:
        topics_data: Output from topic_modeling.extract_topics
        doc_segments: List of document segments
        threshold: Similarity threshold for connecting topics
        
    Returns:
        NetworkX graph object
    """
    G = nx.Graph()
    
    # Add topic nodes
    for topic_id, keywords in topics_data["topic_keywords"].items():
        # Convert topic_id to int if it's a string or numpy type
        topic_id = int(topic_id) if not isinstance(topic_id, int) else topic_id
        
        G.add_node(
            f"topic_{topic_id}",
            type="topic",
            label=f"Topic {topic_id}",
            keywords=keywords[:5],  # Top 5 keywords
            size=len([t for t in topics_data["doc_topics"] if t == topic_id]),
            docs=[]  # Will store document segments belonging to this topic
        )
    
    # Add document segment nodes and connect to topics
    for i, (segment, topic_id, prob) in enumerate(zip(
            doc_segments, 
            topics_data["doc_topics"], 
            topics_data["doc_probs"])):
        
        # Convert topic_id to int if it's a string or numpy type
        topic_id = int(topic_id) if not isinstance(topic_id, int) else topic_id
        
        doc_node_id = f"doc_{i}"
        G.add_node(
            doc_node_id,
            type="document",
            label=segment[:50] + "..." if len(segment) > 50 else segment,
            text=segment,
            topic=topic_id
        )
        
        # Connect document to its topic
        G.add_edge(
            doc_node_id, 
            f"topic_{topic_id}",
            weight=float(prob),  # Convert to native Python float
            type="belongs_to"
        )
        
        # Add this document to the topic's document list
        G.nodes[f"topic_{topic_id}"]["docs"].append(doc_node_id)
    
    # Add edges between related topics
    similarities = topics_data["topic_similarities"]
    
    # Make sure threshold is not too high, which would result in insufficient connectivity
    # Lower threshold for the demo version
    threshold = min(threshold, 0.2)
    
    # Count how many edges we've added
    edge_count = 0
    
    for i in range(len(similarities)):
        for j in range(i+1, len(similarities)):
            similarity = float(similarities[i, j])  # Convert to native Python float
            if similarity > threshold:
                G.add_edge(
                    f"topic_{i}", 
                    f"topic_{j}",
                    weight=similarity,
                    type="related_to"
                )
                edge_count += 1
    
    # Get topic IDs
    topic_ids = sorted([int(k) for k in topics_data["topic_keywords"].keys()])
    
    # If we have too few edges, add additional edges based on highest similarities
    if edge_count < len(topic_ids) / 2:
        print(f"Adding additional edges to ensure connectivity ({edge_count} is too few)")
        
        # Get all possible topic pairs and their similarities
        pairs_with_sim = []
        for i in range(len(similarities)):
            for j in range(i+1, len(similarities)):
                if i in topic_ids and j in topic_ids:
                    similarity = float(similarities[i, j])
                    pairs_with_sim.append((i, j, similarity))
        
        # Sort by similarity descending
        pairs_with_sim.sort(key=lambda x: x[2], reverse=True)
        
        # Add edges for top N similarities that don't already have edges
        for i, j, similarity in pairs_with_sim:
            if not G.has_edge(f"topic_{i}", f"topic_{j}"):
                G.add_edge(
                    f"topic_{i}", 
                    f"topic_{j}",
                    weight=similarity,
                    type="related_to"
                )
                edge_count += 1
                
                # Stop once we've added enough edges
                if edge_count >= len(topic_ids):
                    break
    
    return G

def detect_topic_communities(G):
    """
    Detect communities of related topics in the knowledge graph.
    
    Args:
        G: NetworkX graph of topics and documents
        
    Returns:
        Dictionary with community information
    """
    # Create a subgraph containing only topic nodes and their relationships
    topic_nodes = [node for node, attrs in G.nodes(data=True) 
                  if attrs.get('type') == 'topic']
    topic_graph = G.subgraph(topic_nodes)
    
    print(f"Created topic graph with {len(topic_nodes)} nodes and {topic_graph.number_of_edges()} edges")
    
    communities = []
    node_to_community = {}
    
    # Check if we have enough connectivity for community detection
    if topic_graph.number_of_edges() == 0 or len(topic_nodes) <= 1:
        print("Insufficient graph connectivity for community detection. Using simple clustering.")
        # Create artificial communities based on node properties instead
        communities = [set([node]) for node in topic_nodes]  # Each topic in its own community
        
        # Map nodes to community IDs
        for i, comm in enumerate(communities):
            for node in comm:
                node_to_community[node] = i
    else:
        # Try different community detection algorithms
        try:
            print("Attempting Louvain community detection...")
            communities = list(community.louvain_communities(topic_graph))
            
            # Map nodes to community IDs
            for i, comm in enumerate(communities):
                for node in comm:
                    node_to_community[node] = i
                    
        except Exception as e1:
            print(f"Louvain community detection failed: {e1}")
            try:
                print("Attempting greedy modularity community detection...")
                # Try another algorithm
                comp = community.greedy_modularity_communities(topic_graph)
                communities = list(comp)  # Convert to list of sets
                
                # Map nodes to community IDs
                for i, comm in enumerate(communities):
                    for node in comm:
                        node_to_community[node] = i
                        
            except Exception as e2:
                print(f"Greedy modularity community detection failed: {e2}")
                try:
                    print("Attempting label propagation community detection...")
                    # Try a simpler algorithm
                    comp = community.label_propagation_communities(topic_graph)
                    communities = list(comp)  # Convert to list of sets
                    
                    # Map nodes to community IDs
                    for i, comm in enumerate(communities):
                        for node in comm:
                            node_to_community[node] = i
                            
                except Exception as e3:
                    print(f"All community detection algorithms failed: {e3}")
                    print("Using manual community assignment as fallback.")
                    
                    # Manually group nodes by connectivity and similarity
                    communities = []
                    remaining_nodes = set(topic_nodes)
                    
                    while remaining_nodes:
                        # Start a new community with a random node
                        seed = next(iter(remaining_nodes))
                        community_nodes = {seed}
                        remaining_nodes.remove(seed)
                        
                        # Try to find connected nodes to add to this community
                        for node in list(remaining_nodes):
                            # If this node has an edge to any node in the current community, add it
                            if any(topic_graph.has_edge(node, comm_node) for comm_node in community_nodes):
                                community_nodes.add(node)
                                remaining_nodes.remove(node)
                        
                        communities.append(community_nodes)
                    
                    # If we still have more than 4 communities, merge the smallest ones
                    if len(communities) > 4:
                        communities.sort(key=len)  # Sort by size
                        while len(communities) > 4:
                            # Merge the two smallest communities
                            smallest = communities.pop(0)
                            second_smallest = communities.pop(0)
                            merged = smallest.union(second_smallest)
                            communities.append(merged)
                    
                    # Map nodes to community IDs
                    for i, comm in enumerate(communities):
                        for node in comm:
                            node_to_community[node] = i
    
    # Handle the case of empty communities list (shouldn't happen but just in case)
    if not communities:
        print("No communities detected. Creating a single community.")
        communities = [set(topic_nodes)]
        node_to_community = {node: 0 for node in topic_nodes}
    
    print(f"Detected {len(communities)} communities")
    
    # Generate descriptive labels for each community
    community_labels = generate_community_labels(G, communities)
    
    # Add community information to the original graph
    for node, comm_id in node_to_community.items():
        G.nodes[node]['community'] = comm_id
        G.nodes[node]['community_label'] = community_labels[comm_id]
    
    return {
        'node_to_community': node_to_community,
        'communities': communities,
        'labels': community_labels
    }

def generate_community_labels(G, communities):
    """
    Generate descriptive labels for each community based on topic keywords.
    
    Args:
        G: NetworkX graph
        communities: List of community sets from community detection
        
    Returns:
        Dictionary mapping community IDs to labels
    """
    community_labels = {}
    
    for i, comm in enumerate(communities):
        # Collect all keywords from topics in this community
        all_keywords = []
        for node in comm:
            keywords = G.nodes[node].get('keywords', [])
            all_keywords.extend(keywords)
        
        # Count keyword frequencies
        keyword_counts = {}
        for keyword in all_keywords:
            keyword_counts[keyword] = keyword_counts.get(keyword, 0) + 1
        
        # Sort keywords by frequency
        sorted_keywords = sorted(keyword_counts.items(), 
                              key=lambda x: x[1], 
                              reverse=True)
        
        # Use top 3 keywords as community label
        top_keywords = [k for k, _ in sorted_keywords[:3]]
        label = " & ".join(top_keywords) if top_keywords else f"Cluster {i}"
        community_labels[i] = label
    
    return community_labels

def identify_central_topics(G, communities):
    """
    Identify the most central topics in each community.
    
    Args:
        G: NetworkX graph
        communities: List of community sets
        
    Returns:
        Dictionary mapping community IDs to central topics
    """
    central_topics = {}
    
    for i, comm in enumerate(communities):
        # Create subgraph for this community
        subgraph = G.subgraph(comm)
        
        # Skip if empty
        if len(subgraph) == 0:
            central_topics[i] = []
            continue
        
        try:
            # Try eigenvector centrality first
            centrality = nx.eigenvector_centrality_numpy(subgraph)
        except Exception as e:
            print(f"Error calculating eigenvector centrality: {e}")
            try:
                # Fall back to degree centrality (simpler)
                centrality = nx.degree_centrality(subgraph)
            except Exception as e2:
                print(f"Error calculating degree centrality: {e2}")
                # Last resort: just use degree as centrality
                centrality = {node: deg for node, deg in subgraph.degree()}
        
        # Sort nodes by centrality
        sorted_nodes = sorted(centrality.items(), 
                            key=lambda x: x[1], 
                            reverse=True)
        
        # Select up to 3 most central nodes (may have fewer)
        top_count = min(len(sorted_nodes), 3)
        top_nodes = [node for node, _ in sorted_nodes[:top_count]]
        central_topics[i] = top_nodes
    
    return central_topics

def analyze_graph(G):
    """
    Perform community detection and centrality analysis on the graph.
    
    Args:
        G: NetworkX graph
        
    Returns:
        Updated graph with community and centrality information
    """
    # Detect topic communities
    community_data = detect_topic_communities(G)
    
    # Identify central topics in each community
    central_topics = identify_central_topics(G, community_data['communities'])
    
    # Add central topic information to graph
    for comm_id, topics in central_topics.items():
        for topic in topics:
            G.nodes[topic]['is_central'] = True
    
    return G

def export_graph_for_d3(G):
    """
    Convert NetworkX graph to D3.js compatible format.
    
    Args:
        G: NetworkX graph
        
    Returns:
        Dictionary with nodes and links in D3 format
    """
    import numpy as np
    
    def convert_to_serializable(value):
        """Convert non-serializable types to JSON-compatible ones."""
        if isinstance(value, (str, bool)) or value is None:
            return value
        elif isinstance(value, (int, float, np.number)):
            return float(value) if isinstance(value, float) or isinstance(value, np.floating) else int(value)
        elif isinstance(value, (list, tuple, np.ndarray)):
            return [convert_to_serializable(item) for item in value]
        elif isinstance(value, dict):
            return {k: convert_to_serializable(v) for k, v in value.items()}
        else:
            # For other types, convert to string
            return str(value)
    
    data = {
        "nodes": [],
        "links": []
    }
    
    # Add nodes
    for node, attrs in G.nodes(data=True):
        node_data = {"id": node}
        # Add all attributes, converting any non-JSON serializable types
        for key, value in attrs.items():
            try:
                node_data[key] = convert_to_serializable(value)
            except Exception as e:
                print(f"Error converting node attribute {key}: {e}")
                # Skip this attribute
        data["nodes"].append(node_data)
    
    # Add links
    for source, target, attrs in G.edges(data=True):
        link_data = {
            "source": source,
            "target": target
        }
        # Add all attributes, converting any non-JSON serializable types
        for key, value in attrs.items():
            try:
                link_data[key] = convert_to_serializable(value)
            except Exception as e:
                print(f"Error converting edge attribute {key}: {e}")
                # Skip this attribute
        data["links"].append(link_data)
    
    return data