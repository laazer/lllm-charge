#!/bin/bash

# Onboard Sample Projects into LLM-Charge
# Indexes with CodeGraph, imports into the dashboard, and runs initial analysis.
# Requires: server running on localhost:3001, codegraph CLI installed
# Run: bash scripts/onboard-sample-projects.sh

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SAMPLE_DIR="sample-projects"
BASE_URL="${LLM_CHARGE_URL:-http://localhost:3001}"
CODEGRAPH_BIN="${CODEGRAPH_BIN:-$(which codegraph 2>/dev/null || echo "")}"

echo -e "${BLUE}🚀 LLM-Charge Sample Project Onboarding${NC}"
echo "=========================================="
echo ""

# Check prerequisites
if [[ ! -f "package.json" ]]; then
    echo -e "${RED}❌ Run this script from the project root.${NC}"
    exit 1
fi

if [[ ! -d "${SAMPLE_DIR}" ]]; then
    echo -e "${YELLOW}⚠️  No sample-projects directory found. Run first:${NC}"
    echo "   npm run download:samples"
    exit 1
fi

# Check server
if ! curl -s "${BASE_URL}/api/reasoning/stats" > /dev/null 2>&1; then
    echo -e "${RED}❌ Server not running at ${BASE_URL}${NC}"
    echo "   Start with: npm run dev:server:comprehensive"
    exit 1
fi
echo -e "${GREEN}✅ Server running at ${BASE_URL}${NC}"

# Check codegraph
if [[ -z "${CODEGRAPH_BIN}" ]]; then
    echo -e "${YELLOW}⚠️  codegraph CLI not found. Projects will be imported without indexing.${NC}"
    echo "   Install codegraph to enable code analysis."
    SKIP_INDEX=true
else
    echo -e "${GREEN}✅ CodeGraph CLI: ${CODEGRAPH_BIN}${NC}"
    SKIP_INDEX=false
fi

echo ""

IMPORTED=0
INDEXED=0
ANALYZED=0
SKIPPED=0

onboard_project() {
    local project_path="$1"
    local project_name="$(basename "$project_path")"
    local language="$(basename "$(dirname "$project_path")")"
    local abs_path="$(cd "$project_path" && pwd)"

    echo -e "${BLUE}📦 Onboarding: ${language}/${project_name}${NC}"

    # Check if already imported
    local existing
    existing=$(curl -s "${BASE_URL}/api/projects" | python3 -c "
import sys, json
projects = json.load(sys.stdin)
match = [p for p in projects if p.get('name') == '${project_name}']
print(match[0]['id'] if match else '')
" 2>/dev/null || echo "")

    if [[ -n "$existing" ]]; then
        echo -e "  ${YELLOW}⏭  Already imported (${existing}), skipping${NC}"
        SKIPPED=$((SKIPPED + 1))
        return
    fi

    # Index with CodeGraph
    if [[ "$SKIP_INDEX" != "true" ]]; then
        echo -e "  ${BLUE}🔍 Indexing with CodeGraph...${NC}"
        if (mkdir -p "${abs_path}/.codegraph" && cd "${abs_path}" && "${CODEGRAPH_BIN}" index .) > /dev/null 2>&1; then
            echo -e "  ${GREEN}✅ Indexed${NC}"
            INDEXED=$((INDEXED + 1))
        else
            echo -e "  ${YELLOW}⚠️  Index failed (continuing anyway)${NC}"
        fi
    fi

    # Detect project type
    local project_type="software"
    if [[ -f "${abs_path}/project.godot" ]]; then
        project_type="demo"
    fi

    # Import via API
    echo -e "  ${BLUE}📥 Importing into dashboard...${NC}"
    local import_result
    import_result=$(curl -s -X POST "${BASE_URL}/api/projects" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"${project_name}\",
            \"description\": \"Sample ${language} project: ${project_name}\",
            \"key\": \"$(echo "${project_name}" | tr '[:lower:].' '[:upper:]-' | head -c 12)\",
            \"type\": \"${project_type}\",
            \"lead\": \"sample\",
            \"codeGraphPath\": \"${abs_path}\"
        }" 2>/dev/null)

    if echo "$import_result" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d.get('id')" 2>/dev/null; then
        echo -e "  ${GREEN}✅ Imported${NC}"
        IMPORTED=$((IMPORTED + 1))
    else
        echo -e "  ${YELLOW}⚠️  Import may have failed${NC}"
    fi

    # Run hybrid reasoning analysis
    echo -e "  ${BLUE}🧠 Running architecture analysis...${NC}"
    local analysis
    analysis=$(curl -s -X POST "${BASE_URL}/mcp/call/hybrid_reasoning" \
        -H "Content-Type: application/json" \
        -d "{
            \"prompt\": \"Analyze the architecture of the ${project_name} project (${language}). What are its main components, patterns, and notable design decisions?\",
            \"complexity\": \"medium\",
            \"preferLocal\": true
        }" --max-time 60 2>/dev/null)

    if [[ -n "$analysis" ]]; then
        echo -e "  ${GREEN}✅ Analysis complete${NC}"
        ANALYZED=$((ANALYZED + 1))
    else
        echo -e "  ${YELLOW}⚠️  Analysis timed out or failed${NC}"
    fi

    echo ""
}

# Find and onboard all sample projects
for language_dir in "${SAMPLE_DIR}"/*/; do
    if [[ ! -d "$language_dir" ]]; then continue; fi
    language="$(basename "$language_dir")"

    for project_dir in "${language_dir}"*/; do
        if [[ ! -d "$project_dir" ]]; then continue; fi
        # Skip if it's just a README
        project_name="$(basename "$project_dir")"
        if [[ "$project_name" == "README.md" ]]; then continue; fi

        onboard_project "$project_dir"
    done
done

echo -e "${GREEN}=========================================${NC}"
echo -e "${GREEN}✅ Onboarding complete!${NC}"
echo -e "   Imported: ${IMPORTED} projects"
echo -e "   Indexed:  ${INDEXED} with CodeGraph"
echo -e "   Analyzed: ${ANALYZED} with hybrid reasoning"
echo -e "   Skipped:  ${SKIPPED} (already imported)"
echo ""
echo -e "${BLUE}Next steps:${NC}"
echo "  1. Open the dashboard: http://localhost:3000"
echo "  2. Go to Projects to see imported sample projects"
echo "  3. Go to CodeGraph to explore indexed code"
echo "  4. Go to Playground to analyze projects with hybrid reasoning"
