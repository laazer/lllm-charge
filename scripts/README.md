# Scripts Directory

This directory contains utility scripts for the LLM-Charge project.

## Available Scripts

### 📦 Release Zip Creation

Creates a clean project archive with timestamp in the filename, excluding development artifacts.

#### Usage Options:

**1. Using NPM Scripts (Recommended):**
```bash
# macOS/Linux
npm run zip

# Windows
npm run zip:win
```

**2. Direct Execution:**
```bash
# macOS/Linux
./scripts/create-release-zip.sh

# Windows
scripts\create-release-zip.bat
```

#### Features:
- ✅ Automatic datetime naming (e.g., `llm-charge-20260330_090449.zip`)
- ✅ Excludes development artifacts (node_modules, build files, logs, etc.)
- ✅ Includes all essential project files
- ✅ Shows file size and contents summary
- ✅ Cross-platform support (bash + batch scripts)
- ✅ Colorized output for better readability

#### What's Included:
- Source code (`src/`)
- Configuration files (`package.json`, `tsconfig.json`, etc.)
- Documentation (`.md` files)
- Tests (`tests/`)
- Database files (`data/`)
- Docker files
- Essential config directories

#### What's Excluded:
- `node_modules/` (all levels)
- Build artifacts (`dist/`, `build/`, `.vite/`, etc.)
- Environment files (`.env*`)
- Log files (`*.log`, `logs/`)
- Cache directories (`.cache/`, `.eslintcache`, etc.)
- Temporary files (`tmp/`, `temp/`)
- OS-specific files (`.DS_Store`, `Thumbs.db`)
- Test directories (`test-*/`)
- Git history (`.git/`)

#### Output Example:
```
🚀 LLM-Charge Release Zip Creator
==================================
📦 Creating zip file: llm-charge-20260330_090449.zip
🧹 Removing existing zip files...
📦 Creating clean project archive...
✅ Success! Created llm-charge-20260330_090449.zip (3MB)

📋 Zip file contents:
• Source code (src/)
• Configuration files
• Documentation
• Tests
• Database files
• Scripts
• Docker files

🎉 Ready for distribution!
```

---

## Adding New Scripts

When adding new scripts to this directory:

1. **Make them executable** (Unix-like systems):
   ```bash
   chmod +x scripts/your-script.sh
   ```

2. **Add NPM script entry** in `package.json`:
   ```json
   "scripts": {
     "your-command": "bash scripts/your-script.sh"
   }
   ```

3. **Follow naming conventions**:
   - Use kebab-case for script files
   - Include file extension (`.sh`, `.bat`, `.js`, etc.)
   - Use descriptive names that indicate purpose

4. **Include documentation** in this README or create dedicated docs.