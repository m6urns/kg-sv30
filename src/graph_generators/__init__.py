"""
Knowledge graph generators module.

This module provides different strategies for generating knowledge graphs.
The codebase is transitioning away from automated text processing toward
human-created knowledge graphs.
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
    # Include both sample and structured data generators
    return [SampleGraphGenerator, StructuredDataGraphGenerator]


def create_generator(generator_name, **kwargs):
    """
    Create a graph generator by name.
    
    Note: This function is being simplified as we transition away from
    automated text processing. It currently only supports the sample generator.
    
    Args:
        generator_name: Name of the generator to create
        **kwargs: Arguments to pass to the generator constructor
        
    Returns:
        BaseGraphGenerator: An instance of the requested generator
        
    Raises:
        ValueError: If the generator name is not recognized
    """
    # Update generators dictionary to include the structured data generator
    generators = {
        'sample': SampleGraphGenerator,
        'structured': StructuredDataGraphGenerator
    }
    
    if generator_name.lower() not in generators:
        # Always default to sample generator with a warning
        return SampleGraphGenerator(**kwargs)
    
    generator_class = generators[generator_name.lower()]
    return generator_class(**kwargs)