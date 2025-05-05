#!/bin/bash
# Simple build script for Azure Static Web Apps

echo "Starting build process..."

# Ensure static directory exists
mkdir -p static

# Copy templates to static directory
cp templates/index.html static/

echo "Build completed successfully."