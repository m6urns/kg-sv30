from flask import Flask, jsonify, request, render_template, send_from_directory
import os
import json
import logging
import html
from flask_cors import CORS

# Import configuration
from .config import get_config

# Get config based on environment
config = get_config()

# Set up logging with config-based level
logging_level = getattr(logging, config.LOG_LEVEL)
logging.basicConfig(
    level=logging_level,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = Flask(__name__, 
            static_folder=config.STATIC_FOLDER,
            template_folder=config.TEMPLATE_FOLDER)

# Apply configuration
app.config.from_object(config)

# Configure CORS based on environment
if hasattr(config, 'CORS_ORIGINS'):
    # Production - use specific origins
    CORS(app, resources={r"/api/*": {"origins": config.CORS_ORIGINS, "supports_credentials": False}})
else:
    # Development - less restrictive
    CORS(app, resources={r"/api/*": {"origins": "*", "supports_credentials": False}})

# Security headers middleware
@app.after_request
def add_security_headers(response):
    # Content Security Policy to prevent XSS
    csp = "default-src 'self'; "
    
    # In development, allow unsafe-inline for easier debugging
    if app.config.get('DEBUG', False):
        csp += "script-src 'self' 'unsafe-inline' https://d3js.org https://cdn.jsdelivr.net; "
        csp += "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
    else:
        # In production, prefer stronger security
        csp += "script-src 'self' https://d3js.org https://cdn.jsdelivr.net; "
        csp += "style-src 'self' https://cdn.jsdelivr.net; "
    
    # Common settings for all environments
    csp += "img-src 'self' data:; font-src 'self' https://cdn.jsdelivr.net;"
    
    response.headers['Content-Security-Policy'] = csp
    
    # Prevent MIME type sniffing
    response.headers['X-Content-Type-Options'] = 'nosniff'
    
    # Prevents the browser from rendering the page if it detects a reflected XSS attack
    response.headers['X-XSS-Protection'] = '1; mode=block'
    
    # Prevents page from being displayed in an iframe
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    
    # Add Strict-Transport-Security header in production
    if not app.config.get('DEBUG', False):
        response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
    
    return response

# Global variable to store the processed graph data
graph_data = None

@app.route('/')
def index():
    """Render the main application page."""
    return render_template('index.html')

@app.route('/api/graph', methods=['GET'])
def get_graph():
    """Return the full graph data."""
    global graph_data
    
    if graph_data is None:
        return jsonify({"error": "Graph data not available. Run processing first."}), 404
    
    return jsonify(graph_data)

@app.route('/api/communities', methods=['GET'])
def get_communities():
    """Return information about detected communities."""
    global graph_data
    
    if graph_data is None:
        return jsonify({"error": "Graph data not available. Run processing first."}), 404
    
    communities = {}
    
    for node in graph_data["nodes"]:
        if node.get("type") == "topic" and "community" in node:
            comm_id = node["community"]
            if comm_id not in communities:
                communities[comm_id] = {
                    "id": comm_id,
                    "label": node.get("community_label", f"Cluster {comm_id}"),
                    "topics": [],
                    "central_topics": []
                }
            
            topic_info = {
                "id": node["id"],
                "label": node["label"],
                "keywords": node.get("keywords", []),
                "size": node.get("size", 1)
            }
            
            communities[comm_id]["topics"].append(topic_info)
            
            if node.get("is_central", False):
                communities[comm_id]["central_topics"].append(topic_info)
    
    return jsonify(list(communities.values()))

@app.route('/api/search', methods=['GET'])
def search():
    """Search for nodes matching query in keywords and text content."""
    global graph_data
    
    if graph_data is None:
        return jsonify({"error": "Graph data not available. Run processing first."}), 404
    
    query = request.args.get('q', '').lower()
    if not query:
        return jsonify([])
    
    results = []
    for node in graph_data["nodes"]:
        # Initialize match info
        match_info = {
            "score": 0,
            "matches": []
        }
        
        # Search in node label (highest priority)
        if query in node.get("label", "").lower():
            match_info["score"] += 10
            match_info["matches"].append({
                "field": "label",
                "text": html.escape(node.get("label", "")),
                "priority": "high"
            })
        
        # Search in keywords (high priority)
        keyword_matches = [html.escape(kw) for kw in node.get("keywords", []) if query in kw.lower()]
        if keyword_matches:
            match_info["score"] += 8 * len(keyword_matches)
            match_info["matches"].append({
                "field": "keywords",
                "text": ", ".join(keyword_matches),
                "priority": "high"
            })
        
        # Search in type-specific text content
        node_type = node.get("type", "")
        
        # For topic/theme nodes
        if node_type == "topic":
            # Search in description
            description = node.get("description", "")
            if description and query in description.lower():
                match_info["score"] += 5
                match_info["matches"].append({
                    "field": "description",
                    "text": html.escape(description),
                    "priority": "medium"
                })
            
            # Search in overview
            overview = node.get("overview", "")
            if overview and query in overview.lower():
                match_info["score"] += 3
                match_info["matches"].append({
                    "field": "overview",
                    "text": html.escape(overview),
                    "priority": "medium"
                })
        
        # For document/goal nodes
        elif node_type == "document":
            # Search in text/goal title
            goal_text = node.get("text", "")
            if goal_text and query in goal_text.lower():
                match_info["score"] += 6
                match_info["matches"].append({
                    "field": "text",
                    "text": html.escape(goal_text),
                    "priority": "medium"
                })
                
            # Search in strategies HTML (contains all strategy text)
            strategies_html = node.get("strategies_html", "")
            if strategies_html and query in strategies_html.lower():
                match_info["score"] += 4
                match_info["matches"].append({
                    "field": "strategies",
                    "text": "Strategy content match",
                    "priority": "medium"
                })
        
        # For strategy nodes
        elif node_type == "strategy":
            # Search in text/strategy content
            strategy_text = node.get("text", "")
            if strategy_text and query in strategy_text.lower():
                match_info["score"] += 6
                match_info["matches"].append({
                    "field": "text",
                    "text": html.escape(strategy_text),
                    "priority": "medium"
                })
            
            # Search in summary
            summary = node.get("summary", "")
            if summary and query in summary.lower():
                match_info["score"] += 3
                match_info["matches"].append({
                    "field": "summary",
                    "text": html.escape(summary),
                    "priority": "low"
                })
        
        # If any matches were found, add to results with match info
        if match_info["score"] > 0:
            # Create a copy of the node with match information
            result_node = node.copy()
            
            # Sanitize node fields that will be displayed
            if "label" in result_node:
                result_node["label"] = html.escape(result_node["label"])
            
            result_node["match_info"] = match_info
            results.append(result_node)
    
    # Sort results by score (descending)
    results.sort(key=lambda x: x["match_info"]["score"], reverse=True)
    
    return jsonify(results)

@app.route('/api/node/<node_id>', methods=['GET'])
def get_node(node_id):
    """Get detailed information about a specific node."""
    global graph_data
    
    if graph_data is None:
        return jsonify({"error": "Graph data not available. Run processing first."}), 404
    
    for node in graph_data["nodes"]:
        if node["id"] == node_id:
            # Create a sanitized copy of the node
            sanitized_node = node.copy()
            
            # Sanitize text fields that will be displayed
            text_fields = ["label", "description", "overview", "text", "summary"]
            for field in text_fields:
                if field in sanitized_node:
                    sanitized_node[field] = html.escape(str(sanitized_node[field]))
            
            # Sanitize arrays of text
            if "keywords" in sanitized_node:
                sanitized_node["keywords"] = [html.escape(str(kw)) for kw in sanitized_node["keywords"]]
            
            # Get connected nodes
            connected = []
            for link in graph_data["links"]:
                if link["source"] == node_id:
                    connected_node = next((n.copy() for n in graph_data["nodes"] if n["id"] == link["target"]), None)
                    if connected_node:
                        # Sanitize the connected node
                        for field in text_fields:
                            if field in connected_node:
                                connected_node[field] = html.escape(str(connected_node[field]))
                        
                        connected.append({
                            "node": connected_node,
                            "relationship": html.escape(link.get("type", "related_to"))
                        })
                elif link["target"] == node_id:
                    connected_node = next((n.copy() for n in graph_data["nodes"] if n["id"] == link["source"]), None)
                    if connected_node:
                        # Sanitize the connected node
                        for field in text_fields:
                            if field in connected_node:
                                connected_node[field] = html.escape(str(connected_node[field]))
                        
                        connected.append({
                            "node": connected_node,
                            "relationship": html.escape(link.get("type", "related_to"))
                        })
            
            return jsonify({
                "node": sanitized_node,
                "connections": connected
            })
    
    return jsonify({"error": "Node not found"}), 404

@app.route('/api/process', methods=['POST'])
def process_document():
    """
    Process the strategic vision document and build the knowledge graph.
    
    Note: This endpoint is being simplified as we transition away from automated
    text processing to human-created knowledge graphs. For now, it only uses the
    sample generator for consistent demo functionality.
    """
    global graph_data
    
    try:
        # Import project modules - handle relative import paths
        import sys
        import os
        
        # Add the src directory to the path if needed
        current_dir = os.path.dirname(os.path.abspath(__file__))
        if current_dir not in sys.path:
            sys.path.append(current_dir)
        
        # Use the structured data generator by default
        from graph_generators import StructuredDataGraphGenerator
        generator = StructuredDataGraphGenerator()
        logger.info(f"Using generator: {generator.get_name()}")
        
        # Get absolute path to JSON data
        script_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.dirname(script_dir)
        json_path = os.path.join(base_dir, 'data', 'longbeach_2030', 'index.json')
        
        # Load the structured JSON data
        with open(json_path, 'r') as f:
            document_data = json.load(f)
        
        # Use the vision statement as a placeholder for the document text
        document_text = document_data.get('vision_statement', '')
        logger.info(f"Loaded data from JSON: {len(document_text)} characters")
        
        # Generate the graph with sample data generator
        logger.info("Generating knowledge graph using sample data...")
        graph_data = generator.generate_graph(document_text)
        logger.info(f"Generated graph with {len(graph_data['nodes'])} nodes and {len(graph_data['links'])} links")
        
        # Save to file for persistence
        static_dir = os.path.join(base_dir, 'static')
        os.makedirs(static_dir, exist_ok=True)
        
        with open(os.path.join(static_dir, 'graph_data.json'), 'w') as f:
            json.dump(graph_data, f)
        
        return jsonify({
            "success": True, 
            "message": f"Document processed successfully using {generator.get_name()}",
            "generator": generator.get_name(),
            "nodes": len(graph_data["nodes"]),
            "links": len(graph_data["links"])
        })
        
    except Exception as e:
        logger.exception("Error processing document")
        
        # Try to use sample data as fallback
        try:
            logger.info("Using structured data generator as fallback after processing error")
            from graph_generators import StructuredDataGraphGenerator
            generator = StructuredDataGraphGenerator()
            
            # Try to get the vision statement from JSON if possible
            try:
                script_dir = os.path.dirname(os.path.abspath(__file__))
                base_dir = os.path.dirname(script_dir)
                json_path = os.path.join(base_dir, 'data', 'longbeach_2030', 'index.json')
                with open(json_path, 'r') as f:
                    document_data = json.load(f)
                document_text = document_data.get('vision_statement', '')
            except:
                document_text = ""  # Empty text is fine for sample
                
            graph_data = generator.generate_graph(document_text)
            
            # Save to file for persistence
            script_dir = os.path.dirname(os.path.abspath(__file__))
            base_dir = os.path.dirname(script_dir)
            static_dir = os.path.join(base_dir, 'static')
            os.makedirs(static_dir, exist_ok=True)
            
            with open(os.path.join(static_dir, 'graph_data.json'), 'w') as f:
                json.dump(graph_data, f)
            
            return jsonify({
                "success": True, 
                "message": "Using sample data (processing failed)",
                "warning": f"Original processing error: {str(e)}",
                "generator": "Sample Data Generator (fallback)"
            })
        except Exception as fallback_error:
            logger.exception("Error generating fallback sample data")
            return jsonify({
                "success": False, 
                "error": f"Processing failed: {str(e)}. Fallback also failed: {str(fallback_error)}"
            }), 500

@app.route('/api/load', methods=['GET'])
def load_saved_graph():
    """Load previously saved graph data."""
    global graph_data
    
    try:
        # Use absolute path to ensure file is found
        script_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.dirname(script_dir)
        graph_path = os.path.join(base_dir, 'static', 'graph_data.json')
        
        if os.path.exists(graph_path):
            with open(graph_path, 'r') as f:
                graph_data = json.load(f)
            logger.info(f"Loaded graph data with {len(graph_data['nodes'])} nodes and {len(graph_data['links'])} links")
            return jsonify({"success": True, "message": "Graph data loaded successfully"})
        else:
            logger.warning(f"No saved graph data found at {graph_path}")
            return jsonify({"success": False, "error": "No saved graph data found"}), 404
        
    except Exception as e:
        logger.exception("Error loading graph data")
        return jsonify({"success": False, "error": str(e)}), 500

# Initialize data on startup using with_app_context instead of before_first_request
# (before_first_request is deprecated in newer Flask versions)
with app.app_context():
    try:
        # First check if we have saved data
        script_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.dirname(script_dir)
        graph_path = os.path.join(base_dir, 'static', 'graph_data.json')
        
        if os.path.exists(graph_path):
            with open(graph_path, 'r') as f:
                graph_data = json.load(f)
            logger.info(f"Pre-loaded graph data with {len(graph_data['nodes'])} nodes and {len(graph_data['links'])} links")
        else:
            # No saved data, generate using structured data
            from graph_generators import StructuredDataGraphGenerator
            logger.info("Initializing with structured data (no saved data found)")
            generator = StructuredDataGraphGenerator()
            graph_data = generator.generate_graph("")
            
            # Save the generated data
            static_dir = os.path.join(base_dir, 'static')
            os.makedirs(static_dir, exist_ok=True)
            
            with open(os.path.join(static_dir, 'graph_data.json'), 'w') as f:
                json.dump(graph_data, f)
            
            logger.info("Generated and saved structured data graph")
    except Exception as e:
        logger.warning(f"Error loading or generating initial data: {e}")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)