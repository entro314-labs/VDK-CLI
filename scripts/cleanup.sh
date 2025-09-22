#!/bin/bash

# VDK-CLI Cleanup Script
# Removes unnecessary files before release
# Author: Claude Code Assistant
# Date: 2025-08-10

set -e  # Exit on any error

# Check for --yes flag
YES_TO_ALL=false
if [[ "$1" == "--yes" ]] || [[ "$1" == "-y" ]]; then
    YES_TO_ALL=true
fi

echo "🧹 VDK-CLI Cleanup Script"
echo "========================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to prompt for confirmation
confirm() {
    local message="$1"
    if [[ "$YES_TO_ALL" == "true" ]]; then
        echo -e "${GREEN}$message (auto-confirmed)${NC}"
        return 0
    fi
    echo -e "${YELLOW}$message${NC}"
    read -p "Continue? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aborted by user${NC}"
        exit 1
    fi
}

# Function to safely remove files with confirmation
safe_remove() {
    local pattern="$1"
    local description="$2"
    
    echo -e "\n${BLUE}Checking for: $description${NC}"
    
    # Use find to locate files matching the pattern
    local files
    files=$(find . -name "$pattern" -type f 2>/dev/null || true)
    
    if [[ -n "$files" ]]; then
        echo -e "${YELLOW}Found files to remove:${NC}"
        echo "$files" | sed 's/^/  /'
        
        local count
        count=$(echo "$files" | wc -l | xargs)
        confirm "Remove $count $description files?"
        
        echo "$files" | xargs rm -f
        echo -e "${GREEN}✅ Removed $count files${NC}"
    else
        echo -e "${GREEN}✅ No $description files found${NC}"
    fi
}

# Function to safely remove directories
safe_remove_dirs() {
    local pattern="$1"
    local description="$2"
    
    echo -e "\n${BLUE}Checking for: $description${NC}"
    
    # Use find to locate directories matching the pattern
    local dirs
    dirs=$(find . -name "$pattern" -type d 2>/dev/null || true)
    
    if [[ -n "$dirs" ]]; then
        echo -e "${YELLOW}Found directories to remove:${NC}"
        echo "$dirs" | sed 's/^/  /'
        
        local count
        count=$(echo "$dirs" | wc -l | xargs)
        confirm "Remove $count $description directories?"
        
        echo "$dirs" | xargs rm -rf
        echo -e "${GREEN}✅ Removed $count directories${NC}"
    else
        echo -e "${GREEN}✅ No $description directories found${NC}"
    fi
}

# Check if we're in the right directory
if [[ ! -f "package.json" ]] || [[ ! -f "cli.js" ]]; then
    echo -e "${RED}❌ Error: Not in VDK-CLI project root directory${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Confirmed: Running in VDK-CLI project directory${NC}"

# 1. Remove backup files (.bak)
safe_remove "*.bak" "backup (.bak)"

# 2. Remove coverage directory (will be regenerated)
safe_remove_dirs "coverage" "coverage report"

# 3. Remove test directories with special characters (these seem to be test artifacts)
echo -e "\n${BLUE}Checking for test directories with special characters${NC}"

# List the problematic directories
test_dirs=()
if [[ -d "path with spaces" ]]; then
    test_dirs+=("path with spaces")
fi
if [[ -d "path-with-dashes" ]]; then
    test_dirs+=("path-with-dashes")
fi
if [[ -d "path_with_underscores" ]]; then
    test_dirs+=("path_with_underscores")
fi
if [[ -d "päth-wîth-ümlauts" ]]; then
    test_dirs+=("päth-wîth-ümlauts")
fi

if [[ ${#test_dirs[@]} -gt 0 ]]; then
    echo -e "${YELLOW}Found test directories with special characters:${NC}"
    printf '  %s\n' "${test_dirs[@]}"
    
    confirm "Remove ${#test_dirs[@]} test directories? (These appear to be test artifacts)"
    
    for dir in "${test_dirs[@]}"; do
        rm -rf "$dir"
        echo -e "${GREEN}✅ Removed: $dir${NC}"
    done
else
    echo -e "${GREEN}✅ No test directories with special characters found${NC}"
fi

# 4. Remove node_modules/.cache if it exists (safe to regenerate)
if [[ -d "node_modules/.cache" ]]; then
    echo -e "\n${BLUE}Found node_modules/.cache directory${NC}"
    confirm "Remove node_modules/.cache? (Will be regenerated as needed)"
    rm -rf "node_modules/.cache"
    echo -e "${GREEN}✅ Removed node_modules/.cache${NC}"
fi

# 5. Remove any temporary files
safe_remove "*.tmp" "temporary (.tmp)"
safe_remove "*.temp" "temporary (.temp)"

# 6. Remove any log files that might have been created
safe_remove "*.log" "log"
safe_remove "npm-debug.log*" "npm debug log"
safe_remove "yarn-debug.log*" "yarn debug log"
safe_remove "yarn-error.log*" "yarn error log"

# 7. Remove any OS-specific files
safe_remove ".DS_Store" "macOS .DS_Store"
safe_remove "Thumbs.db" "Windows Thumbs.db"

# Summary
echo -e "\n${GREEN}🎉 Cleanup completed successfully!${NC}"
echo -e "${BLUE}Summary of actions taken:${NC}"
echo "• Removed backup files (.bak)"
echo "• Removed coverage directories"
echo "• Removed test directories with special characters" 
echo "• Removed temporary files"
echo "• Removed OS-specific files"
echo ""
echo -e "${YELLOW}⚠️  Remember to run tests after cleanup to ensure everything still works${NC}"
echo -e "${BLUE}Next steps:${NC}"
echo "1. Run: pnpm test"
echo "2. Commit changes: git add -A && git commit"
echo "3. Ready for release!"