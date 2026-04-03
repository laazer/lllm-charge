#!/bin/bash

# LLM-Charge Release Zip Creator
# Creates a clean project zip with datetime in the filename

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 LLM-Charge Release Zip Creator${NC}"
echo "=================================="

# Generate timestamp
TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
PROJECT_NAME="llm-charge"
ZIP_NAME="${PROJECT_NAME}-${TIMESTAMP}.zip"

echo -e "${YELLOW}📦 Creating zip file: ${ZIP_NAME}${NC}"

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

# Remove any existing zip files to avoid conflicts
if ls *.zip 1> /dev/null 2>&1; then
    echo -e "${YELLOW}🧹 Removing existing zip files...${NC}"
    rm -f *.zip
fi

# Create the zip file with exclusions
echo -e "${BLUE}📦 Creating clean project archive...${NC}"

zip -r "${ZIP_NAME}" . -x \
    "node_modules/*" \
    "*/node_modules/*" \
    "*/*/*/node_modules/*" \
    "*/*/*/*/node_modules/*" \
    "dist/*" \
    "build/*" \
    ".vite/*" \
    ".next/*" \
    ".nuxt/*" \
    ".output/*" \
    ".svelte-kit/*" \
    ".env*" \
    ".DS_Store" \
    "*.log" \
    "logs/*" \
    "coverage/*" \
    ".nyc_output/*" \
    ".eslintcache" \
    ".parcel-cache/*" \
    ".fusebox/*" \
    ".dynamodb/*" \
    ".vscode-test/*" \
    ".codegraph/*" \
    "tmp/*" \
    "temp/*" \
    "*.tgz" \
    "*.tar.gz" \
    "*.pid" \
    "*.seed" \
    "*.pid.lock" \
    "*.lcov" \
    "ehthumbs.db" \
    "Thumbs.db" \
    "._*" \
    ".Spotlight-V100" \
    ".Trashes" \
    ".cache/*" \
    "jest-*" \
    "*.zip" \
    ".git/*" \
    ".claude/*" \
    "test-*/\*" \
    "test-*/*" \
    "sample-projects/*" \
    "data/*.db" \
    "*.db" \
    "*.db.bak" \
    > /dev/null

# Check if zip was created successfully
if [[ -f "${ZIP_NAME}" ]]; then
    # Get file size
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        FILE_SIZE=$(stat -f%z "${ZIP_NAME}")
    else
        # Linux
        FILE_SIZE=$(stat -c%s "${ZIP_NAME}")
    fi
    
    # Convert to human readable format
    if (( FILE_SIZE > 1048576 )); then
        SIZE_MB=$(( FILE_SIZE / 1048576 ))
        SIZE_DISPLAY="${SIZE_MB}MB"
    elif (( FILE_SIZE > 1024 )); then
        SIZE_KB=$(( FILE_SIZE / 1024 ))
        SIZE_DISPLAY="${SIZE_KB}KB"
    else
        SIZE_DISPLAY="${FILE_SIZE}B"
    fi
    
    echo -e "${GREEN}✅ Success! Created ${ZIP_NAME} (${SIZE_DISPLAY})${NC}"
    echo ""
    echo -e "${BLUE}📋 Zip file contents:${NC}"
    echo "• Source code (src/)"
    echo "• Configuration files"
    echo "• Documentation"
    echo "• Tests"
    echo "• Database files"
    echo "• Scripts"
    echo "• Docker files"
    echo ""
    echo -e "${GREEN}🎉 Ready for distribution!${NC}"
    
    # Optional: List the zip contents (first 20 entries)
    echo -e "${BLUE}📁 Archive contents (first 20 files):${NC}"
    unzip -l "${ZIP_NAME}" | head -25 | tail -20
    
else
    echo -e "${RED}❌ Error: Failed to create zip file${NC}"
    exit 1
fi