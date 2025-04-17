import os
import PyPDF2

def extract_text_from_pdf(file_path):
    """
    Extract text content from a PDF file.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        A string containing the extracted text
    """
    try:
        print(f"Attempting to open PDF: {file_path}")
        if not os.path.exists(file_path):
            print(f"PDF file not found: {file_path}")
            return get_sample_text()
        
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            
            # Get total page count for logging
            total_pages = len(pdf_reader.pages)
            print(f"PDF has {total_pages} pages")
            
            for page_num in range(total_pages):
                try:
                    page = pdf_reader.pages[page_num]
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text
                    else:
                        print(f"Warning: No text extracted from page {page_num+1}")
                except Exception as e:
                    print(f"Error extracting text from page {page_num+1}: {e}")
                    continue
            
            # If we couldn't extract any text, return demo text
            if not text.strip():
                print("No text extracted from PDF, using demo text")
                return get_sample_text()
                
            return text
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return get_sample_text()

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

# Keep a simplified version that just returns the sample text
def process_document(file_path, segmentation_method="paragraph", max_segments=None):
    """
    Process a document file - simplified version for demo purposes only.
    The text processing is being phased out in favor of human-created graphs.
    
    Args:
        file_path: Path to the document file
        segmentation_method: Not used in simplified version
        max_segments: Not used in simplified version
        
    Returns:
        Just the extracted text, no segmentation
    """
    # We still extract the text for display purposes
    return extract_text_from_pdf(file_path)