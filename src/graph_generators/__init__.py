"""
Knowledge graph generators module.

This module provides different strategies for generating knowledge graphs.
"""
from .base_generator import BaseGraphGenerator
from .sample_generator import SampleGraphGenerator
from .structured_data_generator import StructuredDataGraphGenerator


def get_available_generators():
    """
    Get a list of all available graph generators.
    
    Returns:
        list: List of generator classes
    """
    return [SampleGraphGenerator, StructuredDataGraphGenerator]


def create_generator(generator_name, **kwargs):
    """
    Create a graph generator by name.
    
    Args:
        generator_name: Name of the generator to create
        **kwargs: Arguments to pass to the generator constructor
        
    Returns:
        BaseGraphGenerator: An instance of the requested generator
        
    Raises:
        ValueError: If the generator name is not recognized
    """
    generators = {
        'sample': SampleGraphGenerator,
        'structured': StructuredDataGraphGenerator,
        'json': StructuredDataGraphGenerator  # Alias for convenience
    }
    
    if generator_name.lower() not in generators:
        # Default to structured data generator
        return StructuredDataGraphGenerator(**kwargs)
    
    generator_class = generators[generator_name.lower()]
    return generator_class(**kwargs)