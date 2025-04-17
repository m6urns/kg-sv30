#!/usr/bin/env python3
"""
Strategic Vision Knowledge Graph Demo Runner
"""
import os
import sys
import webbrowser
import subprocess
import time
import logging

# Set up logging
logging.basicConfig(level=logging.INFO, 
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def check_dependencies():
    """Check if all required dependencies are installed."""
    try:
        with open('requirements.txt', 'r') as f:
            requirements = f.read().strip().split('\n')
        
        logger.info("Checking dependencies...")
        missing = []
        
        for req in requirements:
            req_name = req.split('==')[0]
            try:
                __import__(req_name)
            except ImportError:
                missing.append(req)
        
        if missing:
            logger.warning(f"Missing {len(missing)} dependencies. Installing...")
            subprocess.run([sys.executable, "-m", "pip", "install"] + missing, check=True)
            logger.info("Dependencies installed successfully.")
        else:
            logger.info("All dependencies are already installed.")
            
        return True
    except Exception as e:
        logger.error(f"Error checking dependencies: {e}")
        return False

def check_file_structure():
    """Check if the file structure is correct."""
    required_dirs = ['src', 'static', 'static/css', 'static/js', 'templates', 'data']
    required_files = [
        'src/app.py', 
        'src/document_processor.py',
        'src/topic_modeling.py',
        'src/knowledge_graph.py',
        'static/css/styles.css',
        'static/js/graph.js',
        'templates/index.html',
        'data/2030-strategic-vision.pdf'
    ]
    
    logger.info("Checking file structure...")
    
    # Check directories
    for dir_path in required_dirs:
        if not os.path.isdir(dir_path):
            logger.error(f"Directory {dir_path} not found!")
            return False
    
    # Check files
    for file_path in required_files:
        if not os.path.isfile(file_path):
            logger.error(f"File {file_path} not found!")
            return False
    
    logger.info("File structure verified.")
    return True

def run_flask_app():
    """Run the Flask application."""
    try:
        logger.info("Starting Flask application...")
        
        # Create static directory for graph data if it doesn't exist
        os.makedirs('static', exist_ok=True)
        
        # Import the app module
        sys.path.append('src')
        from app import app
        
        # Open browser
        webbrowser.open('http://localhost:5000')
        
        # Run the app
        app.run(debug=True)
        
        return True
    except Exception as e:
        logger.error(f"Error running Flask app: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Strategic Vision Knowledge Graph Demo")
    print("=" * 60)
    
    # Check dependencies and file structure
    # if not check_dependencies() or not check_file_structure():
    #     print("\nSetup failed. Please check the errors above.")
    #     sys.exit(1)
    
    # Run the Flask app
    print("\nStarting the application...")
    run_flask_app()