#!/bin/bash

# LLM-Charge Pseudo-Git Update Tool
# Extracts a zip file and intelligently updates the current project with diffs

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔄 LLM-Charge Pseudo-Git Update Tool${NC}"
echo "====================================="

# Function to show usage
show_usage() {
    echo -e "${YELLOW}Usage: $0 <zip-file> [options]${NC}"
    echo ""
    echo "Options:"
    echo "  --dry-run     Show what would be changed without making changes"
    echo "  --force       Force update even if there are conflicts"
    echo "  --backup      Create backup before applying changes"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 llm-charge-20240315_143022.zip"
    echo "  $0 project-update.zip --dry-run"
    echo "  $0 changes.zip --backup --force"
}

# Parse command line arguments
ZIP_FILE=""
DRY_RUN=false
FORCE=false
BACKUP=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --backup)
            BACKUP=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        -*)
            echo -e "${RED}❌ Unknown option: $1${NC}"
            show_usage
            exit 1
            ;;
        *)
            if [[ -z "$ZIP_FILE" ]]; then
                ZIP_FILE="$1"
            else
                echo -e "${RED}❌ Multiple zip files specified${NC}"
                show_usage
                exit 1
            fi
            shift
            ;;
    esac
done

# Check if zip file was provided
if [[ -z "$ZIP_FILE" ]]; then
    echo -e "${RED}❌ Error: No zip file specified${NC}"
    show_usage
    exit 1
fi

# Check if zip file exists
if [[ ! -f "$ZIP_FILE" ]]; then
    echo -e "${RED}❌ Error: Zip file '$ZIP_FILE' not found${NC}"
    exit 1
fi

# Check if we're in the right directory
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

echo -e "${YELLOW}📁 Processing zip file: ${ZIP_FILE}${NC}"

# Create temporary directory
TEMP_DIR=$(mktemp -d)
BACKUP_DIR=""

if [[ "$BACKUP" == true ]]; then
    TIMESTAMP=$(date '+%Y%m%d_%H%M%S')
    BACKUP_DIR="backup-${TIMESTAMP}"
    echo -e "${BLUE}💾 Creating backup directory: ${BACKUP_DIR}${NC}"
    mkdir -p "$BACKUP_DIR"
fi

# Cleanup function
cleanup() {
    echo -e "${YELLOW}🧹 Cleaning up temporary files...${NC}"
    if [[ -d "$TEMP_DIR" ]]; then
        rm -rf "$TEMP_DIR"
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Extract zip file to temporary directory
echo -e "${BLUE}📦 Extracting zip file to temporary location...${NC}"
cd "$TEMP_DIR"
unzip -q "$OLDPWD/$ZIP_FILE"
cd "$OLDPWD"

# Find the extracted project directory
# Look for directories that contain package.json
EXTRACTED_DIRS=$(find "$TEMP_DIR" -name "package.json" -type f -exec dirname {} \; | head -1)

if [[ -z "$EXTRACTED_DIRS" ]]; then
    echo -e "${RED}❌ Error: No valid project found in zip file (no package.json found)${NC}"
    exit 1
fi

EXTRACTED_PROJECT="$EXTRACTED_DIRS"
echo -e "${CYAN}📂 Found project in: ${EXTRACTED_PROJECT}${NC}"

# Function to get file hash
get_file_hash() {
    local file="$1"
    if [[ -f "$file" ]]; then
        if command -v sha256sum >/dev/null 2>&1; then
            sha256sum "$file" | cut -d' ' -f1
        elif command -v shasum >/dev/null 2>&1; then
            shasum -a 256 "$file" | cut -d' ' -f1
        else
            # Fallback to md5
            md5 -q "$file" 2>/dev/null || md5sum "$file" | cut -d' ' -f1
        fi
    else
        echo "FILE_NOT_EXISTS"
    fi
}

# Initialize counters
ADDED_COUNT=0
MODIFIED_COUNT=0
DELETED_COUNT=0
UNCHANGED_COUNT=0

echo -e "${BLUE}🔍 Analyzing differences...${NC}"

# Arrays to store changes
declare -a ADDED_FILES
declare -a MODIFIED_FILES
declare -a DELETED_FILES

# Check for new and modified files
while IFS= read -r -d '' file; do
    # Get relative path from extracted project
    REL_PATH="${file#$EXTRACTED_PROJECT/}"
    
    # Skip if it's the root directory
    if [[ "$REL_PATH" == "$file" ]]; then
        continue
    fi
    
    # Skip excluded files (similar to zip exclusions)
    if [[ "$REL_PATH" =~ ^(node_modules|dist|build|\.vite|\.next|\.nuxt|\.output|logs|coverage|\.nyc_output|\.cache|tmp|temp)/.*$ ]] ||
       [[ "$REL_PATH" =~ \.(log|pid|seed|lcov|tgz|tar\.gz)$ ]] ||
       [[ "$REL_PATH" =~ ^\.env.*$ ]] ||
       [[ "$REL_PATH" == ".DS_Store" ]] ||
       [[ "$REL_PATH" == "Thumbs.db" ]] ||
       [[ "$REL_PATH" =~ ^\._.*$ ]] ||
       [[ "$REL_PATH" =~ \.zip$ ]]; then
        continue
    fi
    
    CURRENT_FILE="./$REL_PATH"
    
    if [[ -f "$CURRENT_FILE" ]]; then
        # File exists, check if it's different
        CURRENT_HASH=$(get_file_hash "$CURRENT_FILE")
        NEW_HASH=$(get_file_hash "$file")
        
        if [[ "$CURRENT_HASH" != "$NEW_HASH" ]]; then
            MODIFIED_FILES+=("$REL_PATH")
            ((MODIFIED_COUNT++))
        else
            ((UNCHANGED_COUNT++))
        fi
    else
        # New file
        ADDED_FILES+=("$REL_PATH")
        ((ADDED_COUNT++))
    fi
done < <(find "$EXTRACTED_PROJECT" -type f -print0)

# Check for deleted files (files in current project but not in zip)
while IFS= read -r -d '' file; do
    # Get relative path
    REL_PATH="${file#./}"
    
    # Skip excluded files
    if [[ "$REL_PATH" =~ ^(node_modules|dist|build|\.vite|\.next|\.nuxt|\.output|logs|coverage|\.nyc_output|\.cache|tmp|temp)/.*$ ]] ||
       [[ "$REL_PATH" =~ \.(log|pid|seed|lcov|tgz|tar\.gz)$ ]] ||
       [[ "$REL_PATH" =~ ^\.env.*$ ]] ||
       [[ "$REL_PATH" == ".DS_Store" ]] ||
       [[ "$REL_PATH" == "Thumbs.db" ]] ||
       [[ "$REL_PATH" =~ ^\._.*$ ]] ||
       [[ "$REL_PATH" =~ \.zip$ ]]; then
        continue
    fi
    
    EXTRACTED_FILE="$EXTRACTED_PROJECT/$REL_PATH"
    
    if [[ ! -f "$EXTRACTED_FILE" ]]; then
        # File was deleted
        DELETED_FILES+=("$REL_PATH")
        ((DELETED_COUNT++))
    fi
done < <(find . -type f -print0)

# Display summary
echo ""
echo -e "${BLUE}📊 Change Summary:${NC}"
echo -e "  ${GREEN}Added:      ${ADDED_COUNT} files${NC}"
echo -e "  ${YELLOW}Modified:   ${MODIFIED_COUNT} files${NC}"
echo -e "  ${RED}Deleted:    ${DELETED_COUNT} files${NC}"
echo -e "  ${CYAN}Unchanged:  ${UNCHANGED_COUNT} files${NC}"

# Show detailed changes if not too many
if [[ $((ADDED_COUNT + MODIFIED_COUNT + DELETED_COUNT)) -le 20 ]]; then
    echo ""
    echo -e "${BLUE}📝 Detailed Changes:${NC}"
    
    for file in "${ADDED_FILES[@]}"; do
        echo -e "  ${GREEN}+ $file${NC}"
    done
    
    for file in "${MODIFIED_FILES[@]}"; do
        echo -e "  ${YELLOW}~ $file${NC}"
    done
    
    for file in "${DELETED_FILES[@]}"; do
        echo -e "  ${RED}- $file${NC}"
    done
fi

# Check if there are any changes
if [[ $((ADDED_COUNT + MODIFIED_COUNT + DELETED_COUNT)) -eq 0 ]]; then
    echo -e "${GREEN}✅ No changes detected. Project is up to date!${NC}"
    exit 0
fi

# Dry run mode
if [[ "$DRY_RUN" == true ]]; then
    echo ""
    echo -e "${YELLOW}🔍 Dry run mode - no changes will be applied${NC}"
    echo -e "${BLUE}To apply these changes, run without --dry-run flag${NC}"
    exit 0
fi

# Confirm changes unless force mode
if [[ "$FORCE" != true ]]; then
    echo ""
    echo -e "${YELLOW}⚠️  Ready to apply changes. Continue? (y/N)${NC}"
    read -r CONFIRM
    if [[ "$CONFIRM" != "y" && "$CONFIRM" != "Y" ]]; then
        echo -e "${BLUE}Operation cancelled by user${NC}"
        exit 0
    fi
fi

echo ""
echo -e "${BLUE}🚀 Applying changes...${NC}"

# Apply changes
ERRORS=0

# Handle added and modified files
for file in "${ADDED_FILES[@]}" "${MODIFIED_FILES[@]}"; do
    SOURCE_FILE="$EXTRACTED_PROJECT/$file"
    TARGET_FILE="./$file"
    
    # Create directory if needed
    TARGET_DIR=$(dirname "$TARGET_FILE")
    if [[ ! -d "$TARGET_DIR" ]]; then
        mkdir -p "$TARGET_DIR"
    fi
    
    # Backup if requested and file exists
    if [[ "$BACKUP" == true && -f "$TARGET_FILE" ]]; then
        BACKUP_TARGET_DIR="$BACKUP_DIR/$(dirname "$file")"
        mkdir -p "$BACKUP_TARGET_DIR"
        cp "$TARGET_FILE" "$BACKUP_DIR/$file"
    fi
    
    # Copy file
    if cp "$SOURCE_FILE" "$TARGET_FILE"; then
        if [[ " ${ADDED_FILES[*]} " =~ " ${file} " ]]; then
            echo -e "  ${GREEN}✓ Added: $file${NC}"
        else
            echo -e "  ${YELLOW}✓ Updated: $file${NC}"
        fi
    else
        echo -e "  ${RED}✗ Failed to copy: $file${NC}"
        ((ERRORS++))
    fi
done

# Handle deleted files
for file in "${DELETED_FILES[@]}"; do
    TARGET_FILE="./$file"
    
    # Backup if requested
    if [[ "$BACKUP" == true && -f "$TARGET_FILE" ]]; then
        BACKUP_TARGET_DIR="$BACKUP_DIR/$(dirname "$file")"
        mkdir -p "$BACKUP_TARGET_DIR"
        cp "$TARGET_FILE" "$BACKUP_DIR/$file"
    fi
    
    # Delete file
    if rm "$TARGET_FILE"; then
        echo -e "  ${RED}✓ Deleted: $file${NC}"
        
        # Remove empty parent directories
        TARGET_DIR=$(dirname "$TARGET_FILE")
        while [[ "$TARGET_DIR" != "." && -d "$TARGET_DIR" && -z "$(ls -A "$TARGET_DIR")" ]]; do
            rmdir "$TARGET_DIR"
            TARGET_DIR=$(dirname "$TARGET_DIR")
        done
    else
        echo -e "  ${RED}✗ Failed to delete: $file${NC}"
        ((ERRORS++))
    fi
done

echo ""

# Final summary
if [[ $ERRORS -eq 0 ]]; then
    echo -e "${GREEN}✅ Successfully updated project!${NC}"
    echo -e "  • Applied ${ADDED_COUNT} additions"
    echo -e "  • Applied ${MODIFIED_COUNT} modifications"
    echo -e "  • Applied ${DELETED_COUNT} deletions"
    
    if [[ "$BACKUP" == true ]]; then
        echo -e "  • Backup created in: ${BACKUP_DIR}"
    fi
else
    echo -e "${RED}⚠️  Update completed with ${ERRORS} errors${NC}"
    echo -e "  • Check the error messages above"
    echo -e "  • Some files may not have been updated properly"
    exit 1
fi