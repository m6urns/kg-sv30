"""
Gunicorn configuration for production deployment
"""
import os
import multiprocessing

# Bind to host and port
bind = f"{os.environ.get('HOST', '0.0.0.0')}:{os.environ.get('PORT', '5000')}"

# Number of worker processes
# Recommended formula: (2 * CPU_CORES) + 1
workers = int(os.environ.get('GUNICORN_WORKERS', (multiprocessing.cpu_count() * 2) + 1))

# Number of threads per worker
threads = int(os.environ.get('GUNICORN_THREADS', 2))

# Worker type - using a sync worker for simpler setup
worker_class = 'sync'

# Timeout for worker processes in seconds
timeout = int(os.environ.get('GUNICORN_TIMEOUT', 60))

# Keep the process alive for this many seconds after handling a request
keepalive = int(os.environ.get('GUNICORN_KEEPALIVE', 5))

# Log level
loglevel = os.environ.get('GUNICORN_LOGLEVEL', 'info')

# Access log format
accesslog = os.environ.get('GUNICORN_ACCESS_LOG', '-')  # '-' means log to stdout

# Error log file
errorlog = os.environ.get('GUNICORN_ERROR_LOG', '-')  # '-' means log to stderr

# Max number of requests before a worker is restarted to free resources
max_requests = int(os.environ.get('GUNICORN_MAX_REQUESTS', 1000))
max_requests_jitter = int(os.environ.get('GUNICORN_MAX_REQUESTS_JITTER', 50))

# Preload the application - reduces memory usage when using multiple workers
preload_app = True

# Server hooks
def on_starting(server):
    """Log when server starts"""
    print(f"Starting Gunicorn server with {workers} workers")

def on_exit(server):
    """Log when server exits"""
    print("Gunicorn server is shutting down")