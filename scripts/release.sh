#!/bin/bash

# Exit on error
set -e

echo "Running validation..."
npm run prepublishOnly

echo "Publishing to npm..."
npm publish

# Extract version from package.json
VERSION=$(grep '"version"' package.json | cut -d '"' -f4)

echo "Tagging release v$VERSION..."
git add .
git commit -m "Release v$VERSION" || echo "Could not commit - maybe no changes? Continuing..."
git tag "v$VERSION"
git push origin main --tags
