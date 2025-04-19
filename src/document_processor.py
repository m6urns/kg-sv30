"""
JSON data processor for Strategic Vision data.
This module provides a simple API to access the JSON structured data.
"""
import os
import json

def extract_text_from_json(file_path):
    """
    Extract text content from the structured JSON data.
    
    Args:
        file_path: Path to the JSON file (not used, kept for API compatibility)
        
    Returns:
        A string containing the vision statement and other text
    """
    try:
        # Locate the JSON file regardless of the provided path (for compatibility)
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        json_path = os.path.join(base_dir, 'data', 'longbeach_2030', 'index.json')
        
        if not os.path.exists(json_path):
            print(f"JSON file not found: {json_path}")
            return get_sample_text()
        
        with open(json_path, 'r') as f:
            data = json.load(f)
            
        # Extract the vision statement as the main text
        vision_text = data.get('vision_statement', '')
        
        # Add descriptions from each theme
        theme_texts = []
        for section in data.get('sections', []):
            for theme in section.get('themes', []):
                theme_texts.append(theme.get('description', ''))
                
                # Also load the detailed theme data if available
                theme_path = os.path.join(base_dir, 'data', 'longbeach_2030', 
                                         theme.get('file_path', ''))
                if os.path.exists(theme_path):
                    try:
                        with open(theme_path, 'r') as tf:
                            theme_data = json.load(tf)
                            # Add overview text
                            if 'theme' in theme_data and 'overview' in theme_data['theme']:
                                theme_texts.append(theme_data['theme']['overview'])
                                
                            # Add goal texts
                            if 'theme' in theme_data and 'goals' in theme_data['theme']:
                                for goal in theme_data['theme']['goals']:
                                    theme_texts.append(goal.get('title', ''))
                                    # Add strategies
                                    for strategy in goal.get('strategies', []):
                                        theme_texts.append(strategy)
                    except Exception as e:
                        print(f"Error reading theme file {theme_path}: {e}")
        
        # Combine all text
        full_text = vision_text + "\n\n" + "\n\n".join(theme_texts)
        
        if not full_text.strip():
            print("No text extracted from JSON, using demo text")
            return get_sample_text()
            
        return full_text
        
    except Exception as e:
        print(f"Error extracting text from JSON: {e}")
        return get_sample_text()

# Alias for backward compatibility
extract_text_from_pdf = extract_text_from_json

def get_sample_text():
    """Return sample text for demo purposes."""
    return """
    Strategic Vision 2030: Building a Sustainable Future
    
    Executive Summary:
    Our strategic vision outlines the roadmap for sustainable growth over the next decade. We will focus on digital transformation, environmental sustainability, and inclusive innovation to drive progress across all business units.
    
    Key Focus Areas:
    1. Digital Transformation: Implementing advanced technologies to streamline operations and enhance customer experiences through AI, cloud computing, and data analytics.
    2. Environmental Sustainability: Reducing carbon footprint by 40% and developing eco-friendly products and services with renewable energy sources.
    3. Inclusive Innovation: Fostering an environment where diverse perspectives drive creative solutions to complex problems.
    4. Global Expansion: Strategically entering new markets with localized approaches in emerging economies.
    5. Talent Development: Investing in continuous learning and skills development for our workforce.
    
    Implementation Timeline:
    Phase 1 (2023-2025): Establish digital infrastructure and sustainability framework. Begin pilot programs in select markets.
    Phase 2 (2026-2028): Scale innovations and expand market presence. Implement advanced technologies across all business units.
    Phase 3 (2029-2030): Consolidate gains and position for future growth. Evaluate outcomes and refine strategies.
    
    Success Metrics:
    - 30% reduction in carbon emissions by 2030
    - Digital processes implemented across 90% of operations
    - Customer satisfaction increased to 95%
    - Revenue growth of 50% with 40% from new markets
    - 85% employee engagement score
    - 25% of revenue from sustainable products and services
    
    Resource Allocation:
    - Technology Infrastructure: 30%
    - Sustainability Initiatives: 25%
    - Market Expansion: 20%
    - Research & Development: 15%
    - Talent Development: 10%
    
    Risk Assessment:
    - Technological disruption
    - Regulatory changes
    - Competitive pressures
    - Geopolitical instability
    - Climate change impacts
    
    Mitigation strategies include scenario planning, strategic partnerships, and adaptive governance frameworks.
    
    This vision document is a living guide that will evolve as we progress and adapt to changing market conditions.
    """

# Keep a simplified version that just returns the text
def process_document(file_path, segmentation_method="paragraph", max_segments=None):
    """
    Process a document file - simplified version for demo purposes only.
    
    Args:
        file_path: Path to the document file
        segmentation_method: Not used in simplified version
        max_segments: Not used in simplified version
        
    Returns:
        Just the extracted text, no segmentation
    """
    # We extract the text for display purposes
    return extract_text_from_json(file_path)