"""
Analytics Manager for Strategic Vision Navigator

This module handles the storage, retrieval, and processing of usage analytics data.
It provides a simple CSV-based storage system that can be replaced with a database
solution in the future.
"""

import os
import csv
import json
import logging
import uuid
import time
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union

# Import the schema definitions
from .analytics_schema import (
    EVENT_CATEGORIES, 
    EVENT_TYPES, 
    CSV_HEADERS, 
    ANALYTICS_DIR,
    DAILY_FILE_FORMAT
)

# Set up logging
logger = logging.getLogger(__name__)

class AnalyticsManager:
    """
    Manages analytics data collection, storage, and retrieval.
    
    This class provides methods to:
    - Record analytics events to CSV files
    - Read analytics data for visualization and analysis
    - Maintain the analytics file structure
    - Handle data export and cleanup
    """
    
    def __init__(self, base_dir: Optional[str] = None):
        """
        Initialize the analytics manager.
        
        Args:
            base_dir: Base directory for storing analytics data.
                     If None, uses the default from ANALYTICS_DIR relative to app root.
        """
        if base_dir:
            self.base_dir = base_dir
        else:
            # Default to a directory at the project root
            try:
                from flask import current_app
                app_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
                self.base_dir = os.path.join(app_root, ANALYTICS_DIR)
            except Exception as e:
                # Fallback if we can't get the app root
                logger.warning(f"Couldn't determine app root: {e}, using current directory")
                self.base_dir = os.path.join(os.getcwd(), ANALYTICS_DIR)
        
        # Ensure the analytics directory exists
        try:
            os.makedirs(self.base_dir, exist_ok=True)
            # Test write access by creating a test file
            test_file = os.path.join(self.base_dir, 'test_write_access.txt')
            with open(test_file, 'w') as f:
                f.write('Write access test')
            os.remove(test_file)  # Clean up the test file
            logger.info(f"Analytics manager initialized with data directory: {self.base_dir}")
        except Exception as e:
            logger.error(f"Failed to create or write to analytics directory {self.base_dir}: {e}")
            # Try to use a temp directory as fallback
            import tempfile
            self.base_dir = os.path.join(tempfile.gettempdir(), ANALYTICS_DIR)
            os.makedirs(self.base_dir, exist_ok=True)
            logger.warning(f"Falling back to temporary directory for analytics: {self.base_dir}")
    
    def _get_current_file_path(self) -> str:
        """Get the path to the current day's analytics file."""
        filename = datetime.now().strftime(DAILY_FILE_FORMAT)
        return os.path.join(self.base_dir, filename)
    
    def _ensure_file_exists(self, filepath: str) -> None:
        """
        Ensure the CSV file exists with headers.
        
        Creates the file with headers if it doesn't exist.
        """
        if not os.path.exists(filepath):
            try:
                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                with open(filepath, 'w', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow(CSV_HEADERS)
                logger.info(f"Created new analytics file: {filepath}")
            except Exception as e:
                logger.error(f"Error creating analytics file: {e}")
                # Continue without creating the file - next operations will handle failures gracefully
    
    def record_event(self, 
                    session_id: str,
                    category: str, 
                    event_type: str, 
                    event_value: str = "", 
                    duration_ms: int = 0, 
                    metadata: Optional[Dict[str, Any]] = None) -> bool:
        """
        Record an analytics event to the current day's CSV file.
        
        Args:
            session_id: Anonymous session identifier
            category: Event category (should be from EVENT_CATEGORIES)
            event_type: Specific event type (should be from EVENT_TYPES)
            event_value: Primary value for the event (e.g., node ID, search query)
            duration_ms: Duration in milliseconds (if applicable)
            metadata: Additional event data as a dictionary (will be JSON encoded)
            
        Returns:
            bool: True if event was recorded successfully, False otherwise
        """
        # Validate category and event_type
        if category not in EVENT_CATEGORIES:
            logger.warning(f"Invalid event category: {category}")
            return False
        
        if event_type not in EVENT_TYPES.get(category, []):
            logger.warning(f"Invalid event type '{event_type}' for category '{category}'")
            return False
        
        # Prepare the metadata JSON
        metadata_json = "{}"
        if metadata:
            try:
                metadata_json = json.dumps(metadata)
            except Exception as e:
                logger.error(f"Error encoding metadata to JSON: {e}")
                metadata_json = "{}"
        
        # Prepare the event record
        timestamp = datetime.now().isoformat()
        event_record = [
            timestamp,
            session_id,
            category,
            event_type,
            event_value,
            str(duration_ms),
            metadata_json
        ]
        
        # Get the current file path and ensure it exists
        filepath = self._get_current_file_path()
        self._ensure_file_exists(filepath)
        
        # Append the event to the CSV file
        try:
            with open(filepath, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(event_record)
            return True
        except Exception as e:
            logger.error(f"Error recording analytics event: {e}")
            return False
    
    def get_events(self, 
                  days: int = 7, 
                  category: Optional[str] = None, 
                  event_type: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Retrieve analytics events from the past N days.
        
        Args:
            days: Number of days of data to retrieve (default: 7)
            category: Filter by event category
            event_type: Filter by specific event type
            
        Returns:
            List of events as dictionaries
        """
        events = []
        
        # Calculate the start date
        start_date = datetime.now() - timedelta(days=days)
        
        # Iterate through files for each day in the range
        current_date = datetime.now()
        while current_date >= start_date:
            # Get the file for this day
            date_str = current_date.strftime(DAILY_FILE_FORMAT)
            filepath = os.path.join(self.base_dir, date_str)
            
            # Check if the file exists
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'r', newline='') as f:
                        reader = csv.DictReader(f, fieldnames=CSV_HEADERS)
                        next(reader, None)  # Skip header row
                        
                        for row in reader:
                            # Apply filters if provided
                            if category and row['category'] != category:
                                continue
                            if event_type and row['event_type'] != event_type:
                                continue
                            
                            # Parse metadata JSON
                            try:
                                row['metadata'] = json.loads(row['metadata'])
                            except json.JSONDecodeError:
                                row['metadata'] = {}
                            
                            # Convert duration to integer
                            try:
                                row['duration_ms'] = int(row['duration_ms'])
                            except (ValueError, TypeError):
                                row['duration_ms'] = 0
                                
                            events.append(row)
                except Exception as e:
                    logger.error(f"Error reading analytics file {filepath}: {e}")
            
            # Move to the previous day
            current_date -= timedelta(days=1)
        
        return events
    
    def get_daily_summary(self, days: int = 30) -> List[Dict[str, Any]]:
        """
        Generate a daily summary of events.
        
        Args:
            days: Number of days to include in the summary
            
        Returns:
            List of daily summaries with counts by category and event type
        """
        summary = []
        
        # Calculate the start date
        start_date = datetime.now() - timedelta(days=days)
        
        # Iterate through each day
        current_date = datetime.now()
        while current_date >= start_date:
            date_str = current_date.strftime("%Y-%m-%d")
            file_date_str = current_date.strftime(DAILY_FILE_FORMAT)
            filepath = os.path.join(self.base_dir, file_date_str)
            
            # Initialize summary for this day
            day_summary = {
                "date": date_str,
                "total_events": 0,
                "categories": {},
                "unique_sessions": set()
            }
            
            # Check if the file exists
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'r', newline='') as f:
                        reader = csv.DictReader(f, fieldnames=CSV_HEADERS)
                        next(reader, None)  # Skip header row
                        
                        for row in reader:
                            # Increment total events
                            day_summary["total_events"] += 1
                            
                            # Track unique sessions
                            day_summary["unique_sessions"].add(row["session_id"])
                            
                            # Update category counts
                            category = row["category"]
                            event_type = row["event_type"]
                            
                            if category not in day_summary["categories"]:
                                day_summary["categories"][category] = {
                                    "count": 0,
                                    "event_types": {}
                                }
                            
                            day_summary["categories"][category]["count"] += 1
                            
                            # Update event type counts
                            if event_type not in day_summary["categories"][category]["event_types"]:
                                day_summary["categories"][category]["event_types"][event_type] = 0
                            
                            day_summary["categories"][category]["event_types"][event_type] += 1
                            
                except Exception as e:
                    logger.error(f"Error generating summary for {filepath}: {e}")
            
            # Convert unique sessions set to count
            day_summary["unique_sessions"] = len(day_summary["unique_sessions"])
            
            summary.append(day_summary)
            current_date -= timedelta(days=1)
        
        return summary
    
    def export_data(self, start_date: str, end_date: str, format: str = 'csv') -> str:
        """
        Export analytics data within a date range.
        
        Args:
            start_date: Start date in YYYY-MM-DD format
            end_date: End date in YYYY-MM-DD format
            format: Export format ('csv' or 'json')
            
        Returns:
            Path to the exported file
        """
        # Parse dates
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        
        # Create export filename
        export_dir = os.path.join(self.base_dir, "exports")
        os.makedirs(export_dir, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        export_filename = f"analytics_export_{start_date}_to_{end_date}_{timestamp}.{format}"
        export_path = os.path.join(export_dir, export_filename)
        
        # Collect data from all files in the date range
        all_events = []
        current_date = start
        
        while current_date <= end:
            date_str = current_date.strftime(DAILY_FILE_FORMAT)
            filepath = os.path.join(self.base_dir, date_str)
            
            if os.path.exists(filepath):
                try:
                    with open(filepath, 'r', newline='') as f:
                        reader = csv.DictReader(f, fieldnames=CSV_HEADERS)
                        next(reader, None)  # Skip header row
                        
                        for row in reader:
                            all_events.append(row)
                except Exception as e:
                    logger.error(f"Error reading file {filepath} for export: {e}")
            
            current_date += timedelta(days=1)
        
        # Write the export file
        if format == 'csv':
            try:
                with open(export_path, 'w', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=CSV_HEADERS)
                    writer.writeheader()
                    writer.writerows(all_events)
            except Exception as e:
                logger.error(f"Error writing CSV export: {e}")
                return ""
        
        elif format == 'json':
            try:
                # Parse metadata in each event
                for event in all_events:
                    try:
                        event['metadata'] = json.loads(event['metadata'])
                    except:
                        event['metadata'] = {}
                
                with open(export_path, 'w') as f:
                    json.dump(all_events, f, indent=2)
            except Exception as e:
                logger.error(f"Error writing JSON export: {e}")
                return ""
        
        return export_path
    
    def cleanup_old_data(self, max_age_days: int = 90) -> int:
        """
        Delete analytics files older than the specified age.
        
        Args:
            max_age_days: Maximum age in days for files to keep
            
        Returns:
            Number of files deleted
        """
        deleted_count = 0
        cutoff_date = datetime.now() - timedelta(days=max_age_days)
        
        for filename in os.listdir(self.base_dir):
            # Skip directories and non-CSV files
            filepath = os.path.join(self.base_dir, filename)
            if os.path.isdir(filepath) or not filename.startswith('events_') or not filename.endswith('.csv'):
                continue
            
            # Try to parse the date from the filename
            try:
                file_date_str = filename[7:-4]  # Extract YYYY-MM-DD part
                file_date = datetime.strptime(file_date_str, "%Y-%m-%d")
                
                # Delete if older than cutoff
                if file_date < cutoff_date:
                    os.remove(filepath)
                    deleted_count += 1
                    logger.info(f"Deleted old analytics file: {filename}")
            
            except Exception as e:
                logger.error(f"Error processing file {filename} during cleanup: {e}")
        
        return deleted_count
    
    def generate_session_id(self) -> str:
        """
        Generate a unique anonymous session ID.
        
        Returns:
            A unique session identifier string
        """
        return f"anon_{uuid.uuid4().hex[:16]}"


# Create a singleton instance for app-wide use
_instance = None

def get_analytics_manager() -> AnalyticsManager:
    """
    Get or create the singleton instance of AnalyticsManager.
    
    Returns:
        The AnalyticsManager instance
    """
    global _instance
    if _instance is None:
        _instance = AnalyticsManager()
    return _instance