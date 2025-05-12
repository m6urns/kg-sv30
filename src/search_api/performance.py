"""
Performance monitoring and optimization for semantic search.

This module provides utilities for monitoring system performance and
optimizing search operations based on current load and resource usage.
"""
import time
import logging
import threading
from typing import Dict, Any, Optional, List

# Import from other modules
from ..search_utils.config import SYSTEM_LOAD_THRESHOLDS, LOAD_ADJUSTMENTS
from ..search_utils.logging import log_method_call
from ..search_utils.metrics import get_metrics, SystemLoadMonitor

# Set up logging
logger = logging.getLogger(__name__)

class PerformanceOptimizer:
    """
    Optimizes search parameters based on system performance.
    
    This class monitors system performance and adjusts search parameters
    to maintain responsiveness under varying load conditions.
    """
    
    def __init__(self):
        """Initialize the performance optimizer."""
        self.metrics = get_metrics()
        self.load_monitor = None
    
    @log_method_call()
    def start_monitoring(self, interval: float = 5.0) -> None:
        """
        Start system load monitoring.
        
        Args:
            interval: Monitoring interval in seconds
        """
        if self.load_monitor is None:
            self.load_monitor = SystemLoadMonitor(self.metrics, interval)
            self.load_monitor.start()
            logger.info(f"Started system load monitoring with {interval}s interval")
    
    @log_method_call()
    def stop_monitoring(self) -> None:
        """Stop system load monitoring."""
        if self.load_monitor is not None:
            self.load_monitor.stop()
            self.load_monitor = None
            logger.info("Stopped system load monitoring")
    
    @log_method_call()
    def get_load_level(self) -> str:
        """
        Get the current load level category.
        
        Returns:
            str: Load level ('low', 'medium', or 'high')
        """
        load = self.metrics.get_system_load()
        
        if load >= SYSTEM_LOAD_THRESHOLDS['high']:
            return 'high'
        elif load >= SYSTEM_LOAD_THRESHOLDS['medium']:
            return 'medium'
        else:
            return 'low'
    
    @log_method_call()
    def optimize_search_params(self, 
                              base_params: Dict[str, Any]) -> Dict[str, Any]:
        """
        Optimize search parameters based on current system load.
        
        Args:
            base_params: Base search parameters to optimize
            
        Returns:
            Optimized search parameters
        """
        load_level = self.get_load_level()
        optimized_params = base_params.copy()
        
        # Adjust timeout based on load
        if 'timeout' in base_params and base_params['timeout'] is not None:
            timeout_factor = LOAD_ADJUSTMENTS['timeout_factor'][load_level]
            optimized_params['timeout'] = base_params['timeout'] * timeout_factor
        
        # Adjust batch size based on load
        optimized_params['batch_size'] = LOAD_ADJUSTMENTS['batch_size'][load_level]
        
        # Log if high load causes significant adjustments
        if load_level == 'high':
            logger.info("High load optimizations applied to search parameters")
        
        return optimized_params
    
    @log_method_call()
    def get_performance_summary(self) -> Dict[str, Any]:
        """
        Get a summary of current performance metrics.
        
        Returns:
            Dictionary with performance metrics and statistics
        """
        return self.metrics.get_summary()


# Singleton instance
_optimizer_instance = None

def get_performance_optimizer() -> PerformanceOptimizer:
    """
    Get or create the singleton instance of PerformanceOptimizer.
    
    Returns:
        PerformanceOptimizer: The shared instance
    """
    global _optimizer_instance
    if _optimizer_instance is None:
        _optimizer_instance = PerformanceOptimizer()
    return _optimizer_instance