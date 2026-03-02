#!/bin/sh
# VDK CLI Installer
# Universal installer script for VDK CLI via NPM
# Usage: curl -fsSL https://raw.githubusercontent.com/vdkit/VDK-CLI/main/install.sh | sh

set -e

# Banner
echo "====================================="
echo "      VDK CLI Installer v2.0        "
echo "====================================="
echo "🚀 AI-Powered Development Toolkit"
echo "🎯 Project-Aware Assistant Rules"
echo "🔧 Universal AI Integration"
echo "====================================="
echo ""

# Parse arguments
INTERACTIVE=true
QUIET=false
PACKAGE_MANAGER=""

while [ "$#" -gt 0 ]; do
  case "$1" in
    --non-interactive)
      INTERACTIVE=false
      echo "🤖 Non-interactive mode enabled"
      ;;
    --quiet)
      QUIET=true
      ;;
    --npm)
      PACKAGE_MANAGER="npm"
      ;;
    --pnpm)
      PACKAGE_MANAGER="pnpm"
      ;;
    --help)
      echo "VDK CLI Installer"
      echo ""
      echo "Usage: curl -fsSL <installer-url> | sh [options]"
      echo ""
      echo "Options:"
      echo "  --non-interactive  Skip interactive setup"
      echo "  --quiet           Reduce output verbosity"
      echo "  --npm             Force npm as package manager"
      echo "  --pnpm            Force pnpm as package manager"
      echo "  --help            Show this help message"
      echo ""
      echo "Examples:"
      echo "  # Interactive install (recommended)"
      echo "  curl -fsSL <installer-url> | sh"
      echo ""
      echo "  # Quick install"
      echo "  curl -fsSL <installer-url> | sh -s -- --non-interactive"
      exit 0
      ;;
    *)
      echo "❌ Unknown option: $1"
      echo "Run with --help for usage information."
      exit 1
      ;;
  esac
  shift
done

# Set verbosity
if [ "$QUIET" = true ]; then
  exec 1>/dev/null 2>/dev/null
fi

# Detect package manager if not specified
if [ -z "$PACKAGE_MANAGER" ]; then
  if command -v pnpm >/dev/null 2>&1; then
    PACKAGE_MANAGER="pnpm"
  elif command -v npm >/dev/null 2>&1; then
    PACKAGE_MANAGER="npm"
  else
    echo "❌ Neither npm nor pnpm found. Please install Node.js first:"
    echo "   https://nodejs.org/"
    exit 1
  fi
fi

echo "📦 Using package manager: $PACKAGE_MANAGER"

# Check Node.js version
if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node --version | sed 's/v//')
  NODE_MAJOR=$(echo "$NODE_VERSION" | cut -d. -f1)

  if [ "$NODE_MAJOR" -lt 22 ]; then
    echo "⚠️  Warning: Node.js $NODE_VERSION detected. VDK CLI requires Node.js 22+."
    echo "   Please update Node.js: https://nodejs.org/"
  else
    echo "✅ Node.js $NODE_VERSION detected"
  fi
else
  echo "❌ Node.js not found. Please install Node.js 22+ first:"
  echo "   https://nodejs.org/"
  exit 1
fi

# Install VDK CLI globally
echo "📥 Installing VDK CLI..."

if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
  if ! pnpm add -g @vibe-dev-kit/cli; then
    echo "❌ Failed to install VDK CLI with pnpm"
    exit 1
  fi
else
  if ! npm install -g @vibe-dev-kit/cli; then
    echo "❌ Failed to install VDK CLI with npm"
    exit 1
  fi
fi

echo "✅ VDK CLI installed successfully!"

# Verify installation
if command -v vdk >/dev/null 2>&1; then
  VDK_VERSION=$(vdk --version 2>/dev/null || echo "unknown")
  echo "🎉 VDK CLI $VDK_VERSION is ready!"
else
  echo "⚠️  VDK CLI installed but not found in PATH"
  echo "   You may need to restart your terminal or add npm global bin to PATH"
fi

echo ""
echo "====================================="
echo "🚀 Ready to enhance your AI coding!"
echo ""
echo "📚 Quick Start:"
echo "   cd your-project"
echo "   vdk init"
echo ""
echo "📖 Documentation:"
echo "   vdk --help"
echo "   https://github.com/vdkit/VDK-CLI"
echo ""
echo "🎯 What's Next:"
if [ "$INTERACTIVE" = true ]; then
  echo "   • Run 'vdk init' in your project"
  echo "   • Follow the interactive setup"
  echo "   • Customize generated rules as needed"
else
  echo "   • Navigate to your project directory"
  echo "   • Run 'vdk init' to analyze and setup"
  echo "   • Check generated blueprints directory"
fi
echo "====================================="