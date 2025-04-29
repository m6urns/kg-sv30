import azure.functions as func
import json
import logging
import os
import urllib.request

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
        # Instead of trying to find the file locally, let's fetch it from the same domain
        # This ensures we're always using the same data that's deployed
        try:
            # First try to get the base URL from the request
            host = req.headers.get('host', 'localhost')
            # For localhost testing vs production
            if 'localhost' in host:
                base_url = f"http://{host}"
            else:
                base_url = f"https://{host}"
            
            # Fetch the graph data from the deployed static assets
            with urllib.request.urlopen(f"{base_url}/graph_data.json") as response:
                graph_data = json.loads(response.read())
        except Exception as url_error:
            logging.warning(f"Error fetching graph data from URL: {str(url_error)}")
            # Fallback to looking for the file locally
            try:
                # Azure Static Web Apps places static files in a known location
                static_dir = os.path.join(os.environ.get('AzureWebJobsScriptRoot', ''), '..', 'app')
                graph_path = os.path.join(static_dir, 'graph_data.json')
                
                with open(graph_path, 'r') as f:
                    graph_data = json.load(f)
            except Exception as file_error:
                logging.error(f"Error reading local graph data: {str(file_error)}")
                return func.HttpResponse(
                    body=json.dumps({"error": "Unable to load graph data"}),
                    mimetype="application/json",
                    status_code=500
                )
        
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