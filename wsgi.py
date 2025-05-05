"""
WSGI entry point for production deployment
"""
from src.app import app

if __name__ == "__main__":
    app.run()