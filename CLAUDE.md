# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build/Lint/Test Commands
- Install dependencies: `pip install -r requirements.txt`
- Run API server: `python src/app.py`
- Run tests: `pytest tests/`
- Run single test: `pytest tests/test_file.py::test_function`
- Lint Python code: `flake8 src/ tests/`
- Type checking: `mypy src/`

## Code Style Guidelines
- Python: Follow PEP 8 style guide
- JavaScript: 2-space indentation, camelCase for variables/functions
- Import order: standard library, third-party, local modules
- Type hints required for all Python functions
- Use docstrings for all functions and classes
- Prefer NetworkX for graph operations, BERTopic for topic modeling
- Handle errors with try/except blocks with specific exceptions
- For D3.js, follow functional programming patterns with proper chaining