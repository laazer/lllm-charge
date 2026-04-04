#!/bin/bash

# Download Sample Projects for LLM-Charge
# Clones open-source projects used for testing CodeGraph, hybrid reasoning, and skills.
# Run: bash scripts/download-sample-projects.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SAMPLE_DIR="sample-projects"

echo -e "${BLUE}📦 LLM-Charge Sample Project Downloader${NC}"
echo "=========================================="
echo ""

# Check if git is available
if ! command -v git &> /dev/null; then
    echo -e "${RED}❌ git is required but not installed.${NC}"
    exit 1
fi

# Ensure we're in the project root
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}❌ Run this script from the project root.${NC}"
    exit 1
fi

clone_repo() {
    local url="$1"
    local language="$2"
    local name="$3"
    local target="${SAMPLE_DIR}/${language}/${name}"

    if [[ -d "${target}" ]]; then
        echo -e "  ${YELLOW}⏭  ${name} already exists, skipping${NC}"
        return
    fi

    echo -e "  ${BLUE}⬇  Cloning ${name}...${NC}"
    git clone --depth 1 "${url}" "${target}" 2>/dev/null
    echo -e "  ${GREEN}✅ ${name}${NC}"
}

# === TypeScript ===
echo -e "${BLUE}📁 TypeScript projects${NC}"
mkdir -p "${SAMPLE_DIR}/typescript"
clone_repo "https://github.com/excalidraw/excalidraw" "typescript" "excalidraw"
clone_repo "https://github.com/calcom/cal.com" "typescript" "cal.com"

# === Python ===
echo ""
echo -e "${BLUE}📁 Python projects${NC}"
mkdir -p "${SAMPLE_DIR}/python"
clone_repo "https://github.com/fastapi/full-stack-fastapi-template" "python" "full-stack-fastapi-template"
clone_repo "https://github.com/apache/airflow" "python" "airflow"

# === Godot ===
echo ""
echo -e "${BLUE}📁 Godot projects${NC}"
mkdir -p "${SAMPLE_DIR}/godot"
clone_repo "https://github.com/lampe-games/godot-open-rts" "godot" "godot-open-rts"
clone_repo "https://github.com/godotengine/godot-demo-projects" "godot" "godot-demo-projects"

echo ""
echo -e "${GREEN}✅ All sample projects downloaded to ${SAMPLE_DIR}/${NC}"
echo ""
echo -e "${YELLOW}📝 Note: Projects are cloned with --depth 1 (shallow clone) to save space.${NC}"
echo -e "   To get full history for a project, run: git fetch --unshallow"
echo -e "   inside the project directory."
