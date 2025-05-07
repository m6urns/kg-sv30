"""
Analytics API routes for Strategic Vision Navigator

These routes handle the collection, retrieval, and visualization of usage analytics data.
"""

from flask import Blueprint, request, jsonify, make_response, current_app, render_template, send_file
from datetime import datetime, timedelta
import json
import os

from .analytics_manager import get_analytics_manager
from .analytics_schema import EVENT_CATEGORIES, EVENT_TYPES, SESSION_ID_COOKIE, SESSION_EXPIRY_DAYS

# Create Blueprint for analytics routes
# Use a more neutral name less likely to be blocked by ad blockers
analytics_bp = Blueprint('stats', __name__, url_prefix='/api/usage')

@analytics_bp.route('/event', methods=['POST'])
def record_event():
    """
    Record an analytics event from the frontend.
    
    Expected JSON payload:
    {
        "category": "node_interaction",
        "event_type": "node_click",
        "event_value": "topic_123",
        "duration_ms": 0,
        "metadata": {"nodeType":"topic","source":"graph_view"}
    }
    
    Returns:
        JSON response with success status
    """
    # Get the analytics manager
    analytics_mgr = get_analytics_manager()
    
    # Get or create session ID from cookie
    session_id = request.cookies.get(SESSION_ID_COOKIE)
    if not session_id:
        session_id = analytics_mgr.generate_session_id()
    
    # Get event data from request
    try:
        data = request.get_json()
        if not data:
            return jsonify({"success": False, "error": "Missing event data"}), 400
        
        # Extract event fields
        category = data.get('category')
        event_type = data.get('event_type')
        event_value = data.get('event_value', '')
        duration_ms = data.get('duration_ms', 0)
        metadata = data.get('metadata', {})
        
        # Validate required fields
        if not category or not event_type:
            return jsonify({
                "success": False,
                "error": "Missing required fields: category and event_type"
            }), 400
        
        # Record the event
        success = analytics_mgr.record_event(
            session_id=session_id,
            category=category,
            event_type=event_type,
            event_value=event_value,
            duration_ms=duration_ms,
            metadata=metadata
        )
        
        # Create response
        resp = make_response(jsonify({"success": success}))
        
        # Set session cookie if needed
        if not request.cookies.get(SESSION_ID_COOKIE):
            expires = datetime.now() + timedelta(days=SESSION_EXPIRY_DAYS)
            resp.set_cookie(
                SESSION_ID_COOKIE, 
                session_id,
                expires=expires,
                httponly=True,
                secure=not current_app.config.get('DEBUG', False),
                samesite='Lax'
            )
        
        return resp
        
    except Exception as e:
        current_app.logger.error(f"Error recording analytics event: {e}")
        return jsonify({"success": False, "error": str(e)}), 500

@analytics_bp.route('/session', methods=['GET'])
def get_session():
    """
    Get or create a session ID for the current user.
    
    Returns:
        JSON with the session ID
    """
    # Get the analytics manager
    analytics_mgr = get_analytics_manager()
    
    # Get or create session ID from cookie
    session_id = request.cookies.get(SESSION_ID_COOKIE)
    if not session_id:
        session_id = analytics_mgr.generate_session_id()
    
    # Create response with session ID
    resp = make_response(jsonify({"session_id": session_id}))
    
    # Set session cookie if needed
    if not request.cookies.get(SESSION_ID_COOKIE):
        expires = datetime.now() + timedelta(days=SESSION_EXPIRY_DAYS)
        resp.set_cookie(
            SESSION_ID_COOKIE, 
            session_id,
            expires=expires,
            httponly=True,
            secure=not current_app.config.get('DEBUG', False),
            samesite='Lax'
        )
    
    return resp

@analytics_bp.route('/data', methods=['GET'])
def get_analytics_data():
    """
    Retrieve analytics data for authorized users.
    
    Query parameters:
        days: Number of days of data to retrieve (default: 7)
        category: Filter by event category (optional)
        event_type: Filter by specific event type (optional)
        format: Response format (json or csv, default: json)
        
    Returns:
        Analytics data in the requested format
    """
    # No debug override - require proper authentication
    debug_override = False
    
    # Simple authentication check - in a real app, you would use proper auth
    # This is a placeholder for demonstration purposes
    if current_app.config.get('DEBUG', False) is False and not debug_override:
        # In production, require authentication
        # Check both cookie and header for authentication
        auth_cookie = request.cookies.get('Authorization')
        auth_header = request.headers.get('Authorization')
        
        # If neither cookie nor header has valid token, require authentication
        if (not auth_cookie or not auth_cookie.startswith('Bearer ')) and \
           (not auth_header or not auth_header.startswith('Bearer ')):
            return jsonify({"error": "Authentication required"}), 401
        
        # In a real app, you would validate the token
        # For demo purposes, we're just checking for its presence
        
    # Parse query parameters
    days = request.args.get('days', '7')
    try:
        days = int(days)
    except ValueError:
        days = 7
    
    category = request.args.get('category')
    event_type = request.args.get('event_type')
    format_type = request.args.get('format', 'json')
    
    # Get analytics data
    analytics_mgr = get_analytics_manager()
    events = analytics_mgr.get_events(days=days, category=category, event_type=event_type)
    
    # Return in requested format
    if format_type == 'csv':
        from io import StringIO
        import csv
        
        # Create CSV in memory
        output = StringIO()
        writer = csv.DictWriter(output, fieldnames=[
            'timestamp', 'session_id', 'category', 'event_type', 
            'event_value', 'duration_ms', 'metadata'
        ])
        writer.writeheader()
        
        # Write events, handling metadata specially
        for event in events:
            # Convert metadata back to string if it's a dict
            event_copy = event.copy()
            if isinstance(event_copy['metadata'], dict):
                event_copy['metadata'] = json.dumps(event_copy['metadata'])
            writer.writerow(event_copy)
        
        # Create response
        response = make_response(output.getvalue())
        response.headers["Content-Disposition"] = f"attachment; filename=analytics_data_{datetime.now().strftime('%Y%m%d')}.csv"
        response.headers["Content-type"] = "text/csv"
        return response
    
    # Default to JSON response
    return jsonify(events)

@analytics_bp.route('/summary', methods=['GET'])
def get_summary():
    """
    Get a summary of analytics data.
    
    Query parameters:
        days: Number of days to include in summary (default: 30)
        
    Returns:
        JSON summary of analytics data
    """
    # No debug override - require proper authentication
    debug_override = False
    
    # Simple authentication check (same as get_analytics_data)
    if current_app.config.get('DEBUG', False) is False and not debug_override:
        # Check both cookie and header for authentication
        auth_cookie = request.cookies.get('Authorization')
        auth_header = request.headers.get('Authorization')
        
        # If neither cookie nor header has valid token, require authentication
        if (not auth_cookie or not auth_cookie.startswith('Bearer ')) and \
           (not auth_header or not auth_header.startswith('Bearer ')):
            return jsonify({"error": "Authentication required"}), 401
    
    # Parse days parameter
    days = request.args.get('days', '30')
    try:
        days = int(days)
    except ValueError:
        days = 30
    
    # Get summary data
    analytics_mgr = get_analytics_manager()
    summary = analytics_mgr.get_daily_summary(days=days)
    
    return jsonify(summary)

@analytics_bp.route('/export', methods=['GET'])
def export_data():
    """
    Export analytics data in CSV or JSON format.
    
    Query parameters:
        start_date: Start date in YYYY-MM-DD format (required)
        end_date: End date in YYYY-MM-DD format (required)
        format: Export format (csv or json, default: csv)
        
    Returns:
        Downloadable file in the requested format
    """
    # No debug override - require proper authentication
    debug_override = False
    
    # Authentication check
    if current_app.config.get('DEBUG', False) is False and not debug_override:
        # Check both cookie and header for authentication
        auth_cookie = request.cookies.get('Authorization')
        auth_header = request.headers.get('Authorization')
        
        # If neither cookie nor header has valid token, require authentication
        if (not auth_cookie or not auth_cookie.startswith('Bearer ')) and \
           (not auth_header or not auth_header.startswith('Bearer ')):
            return jsonify({"error": "Authentication required"}), 401
    
    # Parse parameters
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    format_type = request.args.get('format', 'csv')
    
    # Validate parameters
    if not start_date or not end_date:
        return jsonify({"error": "start_date and end_date parameters are required"}), 400
    
    try:
        # Validate date format
        datetime.strptime(start_date, "%Y-%m-%d")
        datetime.strptime(end_date, "%Y-%m-%d")
    except ValueError:
        return jsonify({"error": "Invalid date format. Use YYYY-MM-DD."}), 400
    
    # Get analytics manager and export the data
    analytics_mgr = get_analytics_manager()
    export_path = analytics_mgr.export_data(start_date, end_date, format=format_type)
    
    if not export_path or not os.path.exists(export_path):
        return jsonify({"error": "Failed to generate export"}), 500
    
    # Return the file for download
    return send_file(
        export_path,
        as_attachment=True,
        download_name=os.path.basename(export_path),
        mimetype='text/csv' if format_type == 'csv' else 'application/json'
    )

@analytics_bp.route('/dashboard', methods=['GET'])
def dashboard():
    """
    Render the analytics dashboard for authorized users.
    
    Returns:
        HTML dashboard page
    """
    # No debug override - require proper authentication
    debug_override = False
    
    # Authentication check - first try cookie, then header
    if current_app.config.get('DEBUG', False) is False and not debug_override:
        # Check for token in cookie
        auth_cookie = request.cookies.get('Authorization')
        # Check for token in header
        auth_header = request.headers.get('Authorization')
        
        # If neither cookie nor header has valid token, show login page
        if (not auth_cookie or not auth_cookie.startswith('Bearer ')) and \
           (not auth_header or not auth_header.startswith('Bearer ')):
            return render_template('analytics_login.html')
    
    # If we're here, either we're in debug mode or authentication succeeded
    current_app.logger.info("Rendering analytics dashboard")
    
    # Render the dashboard template
    return render_template('analytics_dashboard.html')

# Function to register the analytics blueprint with the Flask app
def register_analytics_routes(app):
    """
    Register analytics routes with the Flask app.
    
    Args:
        app: Flask application instance
    """
    app.register_blueprint(analytics_bp)
    app.logger.info("Registered analytics routes")