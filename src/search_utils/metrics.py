"""
Metrics collection for semantic search performance monitoring.

This module provides utilities for tracking search performance metrics,
system load, and resource usage to help optimize search operations.
"""
import time
import logging
import threading
import uuid
from typing import Dict, Any, Optional, Callable, List

# Set up logging
logger = logging.getLogger(__name__)

# Import optional dependencies
try:
    import psutil
    PSUTIL_AVAILABLE = True
except ImportError:
    PSUTIL_AVAILABLE = False
    logger.warning("psutil not available, system load monitoring will be limited")

class PerformanceMetrics:
    """Track and store performance metrics for the search system."""
    
    def __init__(self):
        """Initialize the performance metrics tracker."""
        self.metrics = {
            'system_load': 0.5,  # Default value
            'search_times': [],  # List of recent search times
            'embedding_times': [],  # List of recent embedding generation times
            'cache_stats': {'hits': 0, 'misses': 0},  # Cache performance
            'request_counts': {  # Request counts by hour
                'total': 0,
                'by_hour': {}
            },
            'error_counts': {  # Error counts by type
                'total': 0,
                'by_type': {}
            }
        }
        self.lock = threading.Lock()
    
    def update_system_load(self, load_value: float) -> None:
        """
        Update the current system load metric.
        
        Args:
            load_value: System load value between 0.0 and 1.0
        """
        with self.lock:
            self.metrics['system_load'] = load_value
    
    def get_system_load(self) -> float:
        """
        Get the current system load value.
        
        Returns:
            float: System load value between 0.0 and 1.0
        """
        with self.lock:
            return self.metrics['system_load']
    
    def record_search_time(self, elapsed_seconds: float) -> None:
        """
        Record a search operation time.
        
        Args:
            elapsed_seconds: Time taken for the search operation in seconds
        """
        with self.lock:
            # Keep only the last 100 measurements
            self.metrics['search_times'].append(elapsed_seconds)
            if len(self.metrics['search_times']) > 100:
                self.metrics['search_times'].pop(0)
    
    def record_embedding_time(self, elapsed_seconds: float) -> None:
        """
        Record an embedding generation time.
        
        Args:
            elapsed_seconds: Time taken for embedding generation in seconds
        """
        with self.lock:
            # Keep only the last 100 measurements
            self.metrics['embedding_times'].append(elapsed_seconds)
            if len(self.metrics['embedding_times']) > 100:
                self.metrics['embedding_times'].pop(0)
    
    def record_cache_event(self, hit: bool) -> None:
        """
        Record a cache hit or miss event.
        
        Args:
            hit: True if cache hit, False if cache miss
        """
        with self.lock:
            if hit:
                self.metrics['cache_stats']['hits'] += 1
            else:
                self.metrics['cache_stats']['misses'] += 1
    
    def record_request(self) -> None:
        """Record a search request."""
        current_hour = time.strftime("%Y-%m-%d-%H")
        with self.lock:
            self.metrics['request_counts']['total'] += 1
            if current_hour not in self.metrics['request_counts']['by_hour']:
                self.metrics['request_counts']['by_hour'][current_hour] = 0
            self.metrics['request_counts']['by_hour'][current_hour] += 1
    
    def record_error(self, error_type: str) -> None:
        """
        Record an error event.
        
        Args:
            error_type: Type of error that occurred
        """
        with self.lock:
            self.metrics['error_counts']['total'] += 1
            if error_type not in self.metrics['error_counts']['by_type']:
                self.metrics['error_counts']['by_type'][error_type] = 0
            self.metrics['error_counts']['by_type'][error_type] += 1
    
    def get_summary(self) -> Dict[str, Any]:
        """
        Get a summary of current performance metrics.
        
        Returns:
            Dictionary containing performance metric summary
        """
        with self.lock:
            search_times = self.metrics['search_times']
            embedding_times = self.metrics['embedding_times']
            
            # Calculate averages if data is available
            avg_search_time = sum(search_times) / len(search_times) if search_times else 0
            avg_embedding_time = sum(embedding_times) / len(embedding_times) if embedding_times else 0
            
            # Calculate cache hit rate
            cache_hits = self.metrics['cache_stats']['hits']
            cache_misses = self.metrics['cache_stats']['misses']
            total_cache_lookups = cache_hits + cache_misses
            cache_hit_rate = (cache_hits / total_cache_lookups * 100) if total_cache_lookups else 0
            
            return {
                'system_load': self.metrics['system_load'],
                'avg_search_time': avg_search_time,
                'avg_embedding_time': avg_embedding_time,
                'cache_hit_rate': cache_hit_rate,
                'total_requests': self.metrics['request_counts']['total'],
                'total_errors': self.metrics['error_counts']['total'],
                'error_rate': (self.metrics['error_counts']['total'] / self.metrics['request_counts']['total'] * 100) 
                              if self.metrics['request_counts']['total'] > 0 else 0
            }


class SystemLoadMonitor:
    """Monitor system CPU and memory load."""
    
    def __init__(self, metrics: PerformanceMetrics, interval: float = 5.0):
        """
        Initialize the system load monitor.
        
        Args:
            metrics: PerformanceMetrics instance to update with load information
            interval: Monitoring interval in seconds
        """
        self.metrics = metrics
        self.interval = interval
        self.running = False
        self.thread = None
    
    def start(self) -> None:
        """Start the system load monitoring thread."""
        if self.running:
            return
        
        self.running = True
        self.thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self.thread.start()
        logger.info("System load monitoring started")
    
    def stop(self) -> None:
        """Stop the system load monitoring thread."""
        self.running = False
        if self.thread:
            self.thread.join(timeout=1.0)
            logger.info("System load monitoring stopped")
    
    def _monitor_loop(self) -> None:
        """Background thread function to periodically check system load."""
        while self.running:
            try:
                load_value = self._get_current_load()
                self.metrics.update_system_load(load_value)
                
                # Log if load is high
                if load_value > 0.8:
                    logger.warning(f"High system load detected: {load_value:.2f}")
                
                # Sleep for the interval
                time.sleep(self.interval)
            except Exception as e:
                logger.error(f"Error in system load monitor: {e}")
                time.sleep(self.interval)
    
    def _get_current_load(self) -> float:
        """
        Get the current system load as a value between 0.0 and 1.0.
        
        Returns:
            float: System load value between 0.0 and 1.0
        """
        if PSUTIL_AVAILABLE:
            try:
                # Get CPU and memory usage
                cpu_percent = psutil.cpu_percent(interval=1.0) / 100.0
                memory_percent = psutil.virtual_memory().percent / 100.0
                
                # Weighted average (CPU is more important for our workload)
                return (cpu_percent * 0.7) + (memory_percent * 0.3)
            except Exception as e:
                logger.error(f"Error getting system load from psutil: {e}")
                return 0.5  # Default value
        else:
            # Return a default value if psutil is not available
            return 0.5


# Create a singleton instance of the performance metrics
_metrics_instance = None

def get_metrics() -> PerformanceMetrics:
    """
    Get or create the singleton instance of PerformanceMetrics.
    
    Returns:
        PerformanceMetrics: The shared instance
    """
    global _metrics_instance
    if _metrics_instance is None:
        _metrics_instance = PerformanceMetrics()
    return _metrics_instance