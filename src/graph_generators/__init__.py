"""
Knowledge graph generators module.

This module provides different strategies for generating knowledge graphs
from document text.
"""
from .base_generator import BaseGraphGenerator
from .sample_generator import SampleGraphGenerator
from .openai_generator import OpenAIGraphGenerator


def get_available_generators():
    """
    Get a list of all available graph generators.
    
    Returns:
        list: List of generator classes
    """
    return [SampleGraphGenerator, OpenAIGraphGenerator]


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
        'openai': OpenAIGraphGenerator
    }
    
    if generator_name.lower() not in generators:
        raise ValueError(f"Unknown generator: {generator_name}. "
                         f"Available generators: {', '.join(generators.keys())}")
    
    generator_class = generators[generator_name.lower()]
    return generator_class(**kwargs)