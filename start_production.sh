#!/bin/bash
# Production startup script for the Knowledge Graph application

# Load environment variables from .env file if it exists
if [ -f .env ]; then
    echo "Loading environment variables from .env file"
    export $(grep -v '^#' .env | xargs)
fi

# Set default environment to production if not specified
export FLASK_ENV=${FLASK_ENV:-production}

# Check if required Python packages are installed
python -m pip install -r requirements.txt

# Start Gunicorn with our configuration
echo "Starting Gunicorn server in $FLASK_ENV mode"
gunicorn -c gunicorn_config.py wsgi:app