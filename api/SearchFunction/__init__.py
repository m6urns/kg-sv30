import azure.functions as func
import json
import logging
import os

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Python HTTP trigger function processed a search request.')
    
    query = req.params.get('q', '').lower()
    if not query:
        return func.HttpResponse(
            body=json.dumps([]),
            mimetype="application/json",
            status_code=200
        )
    
    try:
        # In production, the static files would be available at a known location
        # For Azure Static Web Apps with Functions, we need to determine the correct path
        try:
            # First try the path structure in Azure Static Web Apps
            static_dir = os.path.join(os.environ.get('StaticWebAppsContentLocation', ''), 'static')
            graph_path = os.path.join(static_dir, 'graph_data.json')
            
            # Check if file exists at this path
            if not os.path.exists(graph_path):
                # Try alternative path - going up from current directory
                script_dir = os.path.dirname(os.path.realpath(__file__))
                # Go up directories to find the static folder
                static_dir = os.path.join(script_dir, '..', '..', 'static')
                graph_path = os.path.join(static_dir, 'graph_data.json')
        except Exception as path_error:
            logging.warning(f"Error determining file path: {str(path_error)}")
            # Final fallback - try direct relative path that might work in production
            graph_path = "static/graph_data.json"
        
        with open(graph_path, 'r') as f:
            graph_data = json.load(f)
        
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
                    "text": node.get("label", ""),
                    "priority": "high"
                })
            
            # Search in keywords (high priority)
            keyword_matches = [kw for kw in node.get("keywords", []) if query in kw.lower()]
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
                        "text": description,
                        "priority": "medium"
                    })
                
                # Search in overview
                overview = node.get("overview", "")
                if overview and query in overview.lower():
                    match_info["score"] += 3
                    match_info["matches"].append({
                        "field": "overview",
                        "text": overview,
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
                        "text": goal_text,
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
                        "text": strategy_text,
                        "priority": "medium"
                    })
                
                # Search in summary
                summary = node.get("summary", "")
                if summary and query in summary.lower():
                    match_info["score"] += 3
                    match_info["matches"].append({
                        "field": "summary",
                        "text": summary,
                        "priority": "low"
                    })
            
            # If any matches were found, add to results with match info
            if match_info["score"] > 0:
                # Create a copy of the node with match information
                result_node = node.copy()
                result_node["match_info"] = match_info
                results.append(result_node)
        
        # Sort results by score (descending)
        results.sort(key=lambda x: x["match_info"]["score"], reverse=True)
        
        return func.HttpResponse(
            body=json.dumps(results),
            mimetype="application/json",
            status_code=200
        )
    except Exception as e:
        logging.error(f"Error in search: {str(e)}")
        return func.HttpResponse(
            body=json.dumps({"error": f"Search error: {str(e)}"}),
            mimetype="application/json",
            status_code=500
        )