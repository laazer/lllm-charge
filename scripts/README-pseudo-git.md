# Pseudo-Git Update Tool

A smart script that extracts zip files and intelligently applies only the differences to your existing project, similar to how git applies patches.

## Features

- 🔍 **Smart Diff Analysis**: Compares files using SHA256 hashes to detect actual changes
- 📦 **Intelligent File Handling**: Adds new files, updates modified files, removes deleted files
- 🧹 **Automatic Exclusions**: Skips build artifacts, node_modules, logs, and other generated files
- 💾 **Backup Support**: Optional backup of changed files before applying updates
- 🔍 **Dry Run Mode**: Preview changes without applying them
- 🚀 **Force Mode**: Apply changes without confirmation prompts
- 🖥️ **Cross-Platform**: Works on Unix/Linux/macOS (full features) and Windows (basic features)

## Usage

### Basic Usage
```bash
# Apply updates from a zip file
npm run update project-update.zip

# Or directly with the script
./scripts/pseudo-git-update.sh project-update.zip
```

### Available NPM Commands
```bash
npm run update <zip-file>           # Basic update
npm run update:dry-run <zip-file>   # Preview changes only
npm run update:backup <zip-file>    # Update with backup
npm run update:force <zip-file>     # Update without confirmation
npm run update:win <zip-file>       # Windows version (if on Windows)
```

### Command Line Options
```bash
./scripts/pseudo-git-update.sh <zip-file> [options]

Options:
  --dry-run     Show what would be changed without making changes
  --force       Force update even if there are conflicts  
  --backup      Create timestamped backup before applying changes
  --help        Show detailed help message
```

## Examples

### Preview Changes
```bash
# See what would change without applying
npm run update:dry-run llm-charge-20240315_143022.zip
```

### Safe Update with Backup
```bash
# Create backup before applying changes
npm run update:backup project-changes.zip
```

### Automated Update
```bash
# Apply changes without prompts (for CI/CD)
npm run update:force automated-update.zip
```

## How It Works

1. **Extract**: Extracts the zip file to a temporary directory
2. **Analyze**: Compares each file using SHA256 hashes to detect:
   - 🟢 **New files** (present in zip, missing in project)
   - 🟡 **Modified files** (different hash between zip and project)  
   - 🔴 **Deleted files** (present in project, missing in zip)
3. **Filter**: Automatically excludes build artifacts and temporary files
4. **Preview**: Shows a summary of changes and asks for confirmation
5. **Apply**: Copies new/modified files and removes deleted files
6. **Cleanup**: Removes temporary files and empty directories

## Change Detection

The script detects three types of changes:

### Added Files (🟢)
Files that exist in the zip but not in your current project.

### Modified Files (🟡)  
Files that exist in both locations but have different content (detected via SHA256 hash).

### Deleted Files (🔴)
Files that exist in your project but not in the zip.

## Excluded Files

The script automatically ignores these file patterns (similar to .gitignore):

- `node_modules/` - Dependencies
- `dist/`, `build/` - Build output  
- `.vite/`, `.next/`, `.nuxt/` - Build caches
- `logs/`, `coverage/` - Generated reports
- `.env*` - Environment files
- `*.log`, `*.pid` - Temporary files
- `.DS_Store`, `Thumbs.db` - OS files
- `*.zip` - Archive files

## Safety Features

### Backup Mode
```bash
npm run update:backup project.zip
```
Creates a timestamped backup directory with copies of all files that would be changed.

### Dry Run Mode  
```bash
npm run update:dry-run project.zip
```
Shows exactly what would change without making any modifications.

### Confirmation Prompts
By default, the script shows a summary and asks for confirmation before applying changes.

## Output Example

```
🔄 LLM-Charge Pseudo-Git Update Tool
=====================================
📁 Processing zip file: project-update.zip
📦 Extracting zip file to temporary location...
📂 Found project in: /tmp/extracted-project
🔍 Analyzing differences...

📊 Change Summary:
  Added:      3 files
  Modified:   5 files  
  Deleted:    1 files
  Unchanged:  247 files

📝 Detailed Changes:
  + src/new-feature.ts
  + docs/api-guide.md
  + tests/new-test.ts
  ~ src/main.ts
  ~ package.json
  ~ README.md
  ~ src/utils.ts
  ~ src/config.ts
  - src/old-deprecated.ts

⚠️  Ready to apply changes. Continue? (y/N)
```

## Platform Differences

### Unix/Linux/macOS (Full Features)
- SHA256 hash-based change detection
- Precise file comparison
- Detailed change analysis
- Full backup support

### Windows (Basic Features)  
- File size-based comparison (less precise)
- Basic change detection
- Simplified output
- PowerShell or tar extraction

For best results on Windows, use WSL (Windows Subsystem for Linux) to run the Unix version.

## Error Handling

The script includes comprehensive error handling:

- ✅ Validates zip file exists
- ✅ Checks for package.json to confirm project root
- ✅ Creates directories as needed
- ✅ Reports copy/delete failures
- ✅ Cleans up temporary files on exit
- ✅ Provides clear error messages

## Integration with Existing Workflow

This tool complements the existing zip creation script:

1. **Create Release**: `npm run zip` - Creates timestamped zip files
2. **Update Project**: `npm run update <zip-file>` - Applies zip contents as updates

Perfect for:
- Applying patches from collaborators
- Updating projects from backup zips  
- Synchronizing changes between environments
- Testing different versions of your project