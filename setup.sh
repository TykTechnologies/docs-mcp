#!/bin/bash
# Setup script for docs-mcp example

# Change to the example directory
cd "$(dirname "$0")"

# Install dependencies
echo "Installing dependencies..."
npm install

# Run the build script
echo "Building the docs-mcp example..."
node scripts/build.js

# Make the executable script executable
chmod +x bin/mcp.js

echo "Setup completed successfully!"
echo "You can now run the example with: ./bin/probe-docs-mcp"
echo "Or test it with: node test.js"
