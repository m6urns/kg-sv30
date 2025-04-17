from flask import Flask, jsonify, request, render_template, send_from_directory
import os
import json
import logging
from flask_cors import CORS

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = Flask(__name__, 
            static_folder='../static',
            template_folder='../templates')

CORS(app)

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
    """Search for nodes matching query."""
    global graph_data
    
    if graph_data is None:
        return jsonify({"error": "Graph data not available. Run processing first."}), 404
    
    query = request.args.get('q', '').lower()
    if not query:
        return jsonify([])
    
    results = []
    for node in graph_data["nodes"]:
        # Search in node label and keywords
        if (query in node.get("label", "").lower() or 
            any(query in kw.lower() for kw in node.get("keywords", []))):
            results.append(node)
    
    return jsonify(results)

@app.route('/api/node/<node_id>', methods=['GET'])
def get_node(node_id):
    """Get detailed information about a specific node."""
    global graph_data
    
    if graph_data is None:
        return jsonify({"error": "Graph data not available. Run processing first."}), 404
    
    for node in graph_data["nodes"]:
        if node["id"] == node_id:
            # Get connected nodes
            connected = []
            for link in graph_data["links"]:
                if link["source"] == node_id:
                    connected.append({
                        "node": next((n for n in graph_data["nodes"] if n["id"] == link["target"]), None),
                        "relationship": link.get("type", "related_to")
                    })
                elif link["target"] == node_id:
                    connected.append({
                        "node": next((n for n in graph_data["nodes"] if n["id"] == link["source"]), None),
                        "relationship": link.get("type", "related_to")
                    })
            
            # Filter out any None values that might have occurred
            connected = [c for c in connected if c["node"] is not None]
            
            return jsonify({
                "node": node,
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
        
        # We always use the sample generator for now 
        # (ignoring any generator parameter in the request)
        from graph_generators import SampleGraphGenerator
        generator = SampleGraphGenerator()
        logger.info(f"Using generator: {generator.get_name()}")
        
        # Get absolute path to PDF file
        script_dir = os.path.dirname(os.path.abspath(__file__))
        base_dir = os.path.dirname(script_dir)
        pdf_path = os.path.join(base_dir, 'data', '2030-strategic-vision.pdf')
        
        # Extract the document text (just for reference, not used for processing)
        from document_processor import extract_text_from_pdf
        document_text = extract_text_from_pdf(pdf_path)
        logger.info(f"Extracted text from PDF: {len(document_text)} characters")
        
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
            logger.info("Using sample generator as fallback after processing error")
            from graph_generators import SampleGraphGenerator
            generator = SampleGraphGenerator()
            graph_data = generator.generate_graph("")  # Empty text is fine for sample
            
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
            # No saved data, generate sample data
            from generate_sample_data import generate_sample_strategic_vision_data
            logger.info("Initializing with sample data (no saved data found)")
            graph_data = generate_sample_strategic_vision_data()
            
            # Save the sample data
            static_dir = os.path.join(base_dir, 'static')
            os.makedirs(static_dir, exist_ok=True)
            
            with open(os.path.join(static_dir, 'graph_data.json'), 'w') as f:
                json.dump(graph_data, f)
            
            logger.info("Generated and saved sample data")
    except Exception as e:
        logger.warning(f"Error loading or generating initial data: {e}")

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)