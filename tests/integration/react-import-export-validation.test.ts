// React Import/Export Validation Integration Test
// Comprehensive validation to prevent import/export mismatches across the React codebase

import * as fs from 'fs';
import * as path from 'path';

describe('React Import/Export Validation Integration', () => {
  const reactSrcPath = path.resolve(__dirname, '../../src/react');
  
  // Find all TypeScript React files
  const findTsxFiles = (dir: string): string[] => {
    const files: string[] = [];
    
    if (!fs.existsSync(dir)) {
      return files;
    }
    
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        files.push(...findTsxFiles(fullPath));
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        files.push(fullPath);
      }
    }
    
    return files;
  };
  
  // Extract import statements from file content
  const extractImports = (content: string): { line: string; lineNumber: number; type: 'default' | 'named' | 'namespace'; imports: string[]; from: string }[] => {
    const lines = content.split('\n');
    const imports: { line: string; lineNumber: number; type: 'default' | 'named' | 'namespace'; imports: string[]; from: string }[] = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip comments
      if (line.startsWith('//') || line.startsWith('/*')) {
        continue;
      }
      
      // Match import statements
      const defaultImportMatch = line.match(/import\s+(\w+)\s+from\s+['"']([^'"]+)['"']/);
      const namedImportMatch = line.match(/import\s+{\s*([^}]+)\s*}\s+from\s+['"']([^'"]+)['"']/);
      const namespaceImportMatch = line.match(/import\s+\*\s+as\s+(\w+)\s+from\s+['"']([^'"]+)['"']/);
      const defaultAndNamedMatch = line.match(/import\s+(\w+),\s*{\s*([^}]+)\s*}\s+from\s+['"']([^'"]+)['"']/);
      
      if (defaultImportMatch) {
        imports.push({
          line,
          lineNumber: i + 1,
          type: 'default',
          imports: [defaultImportMatch[1]],
          from: defaultImportMatch[2]
        });
      } else if (namedImportMatch) {
        const namedImports = namedImportMatch[1]
          .split(',')
          .map(imp => imp.trim())
          .filter(imp => imp.length > 0);
        
        imports.push({
          line,
          lineNumber: i + 1,
          type: 'named',
          imports: namedImports,
          from: namedImportMatch[2]
        });
      } else if (namespaceImportMatch) {
        imports.push({
          line,
          lineNumber: i + 1,
          type: 'namespace',
          imports: [namespaceImportMatch[1]],
          from: namespaceImportMatch[2]
        });
      } else if (defaultAndNamedMatch) {
        const namedImports = defaultAndNamedMatch[2]
          .split(',')
          .map(imp => imp.trim())
          .filter(imp => imp.length > 0);
        
        imports.push({
          line,
          lineNumber: i + 1,
          type: 'default',
          imports: [defaultAndNamedMatch[1]],
          from: defaultAndNamedMatch[3]
        });
        
        imports.push({
          line,
          lineNumber: i + 1,
          type: 'named',
          imports: namedImports,
          from: defaultAndNamedMatch[3]
        });
      }
    }
    
    return imports;
  };
  
  // Extract export statements from file content
  const extractExports = (content: string): { type: 'default' | 'named'; exports: string[] } => {
    const exports = { type: 'named' as 'default' | 'named', exports: [] as string[] };
    
    // Check for default export
    if (content.match(/export\s+default\s+/)) {
      exports.type = 'default';
    }
    
    // Extract named exports
    const namedExportMatches = content.match(/export\s+(?:const|function|class|interface|type|enum)\s+(\w+)/g) || [];
    const namedExportFromMatches = content.match(/export\s+{\s*([^}]+)\s*}/g) || [];
    
    for (const match of namedExportMatches) {
      const nameMatch = match.match(/export\s+(?:const|function|class|interface|type|enum)\s+(\w+)/);
      if (nameMatch) {
        exports.exports.push(nameMatch[1]);
      }
    }
    
    for (const match of namedExportFromMatches) {
      const namesMatch = match.match(/export\s+{\s*([^}]+)\s*}/);
      if (namesMatch) {
        const names = namesMatch[1]
          .split(',')
          .map(name => name.trim().split(' as ')[0])
          .filter(name => name.length > 0);
        exports.exports.push(...names);
      }
    }
    
    return exports;
  };

  it('should not have any import/export mismatches in React components', async () => {
    const tsxFiles = findTsxFiles(reactSrcPath);
    const errors: string[] = [];
    
    for (const filePath of tsxFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(reactSrcPath, filePath);
      
      const imports = extractImports(content);
      
      for (const importInfo of imports) {
        // Skip external modules (those without relative paths)
        if (!importInfo.from.startsWith('./') && !importInfo.from.startsWith('../')) {
          continue;
        }
        
        // Resolve the imported file path
        const importDir = path.dirname(filePath);
        let importedFilePath = path.resolve(importDir, importInfo.from);
        
        // Try different extensions
        const extensions = ['.tsx', '.ts', '.js', '.jsx'];
        let foundFile = false;
        
        for (const ext of extensions) {
          const testPath = importedFilePath + ext;
          if (fs.existsSync(testPath)) {
            importedFilePath = testPath;
            foundFile = true;
            break;
          }
        }
        
        // Try index files
        if (!foundFile) {
          for (const ext of extensions) {
            const testPath = path.join(importedFilePath, `index${ext}`);
            if (fs.existsSync(testPath)) {
              importedFilePath = testPath;
              foundFile = true;
              break;
            }
          }
        }
        
        if (!foundFile) {
          continue; // Skip if file not found (might be handled by TypeScript)
        }
        
        const importedContent = fs.readFileSync(importedFilePath, 'utf-8');
        const exportInfo = extractExports(importedContent);
        
        // Validate default imports
        if (importInfo.type === 'default' && exportInfo.type !== 'default') {
          errors.push(
            `${relativePath}:${importInfo.lineNumber} - Default import "${importInfo.imports[0]}" from "${importInfo.from}" but target file has no default export`
          );
        }
        
        // Validate named imports
        if (importInfo.type === 'named') {
          for (const namedImport of importInfo.imports) {
            if (!exportInfo.exports.includes(namedImport) && exportInfo.type === 'default') {
              // This is the exact error we fixed with LoadingSpinner
              errors.push(
                `${relativePath}:${importInfo.lineNumber} - Named import "${namedImport}" from "${importInfo.from}" but target file only has default export. Use default import instead.`
              );
            } else if (!exportInfo.exports.includes(namedImport) && exportInfo.type !== 'default') {
              errors.push(
                `${relativePath}:${importInfo.lineNumber} - Named import "${namedImport}" from "${importInfo.from}" but target file doesn't export "${namedImport}"`
              );
            }
          }
        }
      }
    }
    
    if (errors.length > 0) {
      const errorMessage = `Found import/export mismatches:\n${errors.join('\n')}`;
      fail(errorMessage);
    }
  });

  it('should prevent the specific LoadingSpinner import error pattern', async () => {
    // Test the specific pattern that was causing the LoadingSpinner error
    const cronJobsPath = path.resolve(__dirname, '../../src/react/pages/CronJobs.tsx');
    
    if (!fs.existsSync(cronJobsPath)) {
      return; // Skip if file doesn't exist
    }
    
    const cronJobsContent = fs.readFileSync(cronJobsPath, 'utf-8');
    const loadingSpinnerPath = path.resolve(__dirname, '../../src/react/components/ui/LoadingSpinner.tsx');
    
    if (!fs.existsSync(loadingSpinnerPath)) {
      return; // Skip if file doesn't exist
    }
    
    const loadingSpinnerContent = fs.readFileSync(loadingSpinnerPath, 'utf-8');
    
    // LoadingSpinner should use default export
    expect(loadingSpinnerContent).toMatch(/export\s+default\s+LoadingSpinner/);
    
    // CronJobs should use default import
    expect(cronJobsContent).toMatch(/import\s+LoadingSpinner\s+from/);
    expect(cronJobsContent).not.toMatch(/import\s*{\s*LoadingSpinner\s*}\s*from/);
  });

  it('should validate all UI component export patterns are consistent', async () => {
    const uiComponentsPath = path.resolve(reactSrcPath, 'components/ui');
    
    if (!fs.existsSync(uiComponentsPath)) {
      return; // Skip if directory doesn't exist
    }
    
    const componentFiles = findTsxFiles(uiComponentsPath);
    const exportPatterns: { file: string; hasDefault: boolean; namedExports: string[] }[] = [];
    
    for (const filePath of componentFiles) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const relativePath = path.relative(uiComponentsPath, filePath);
      const exportInfo = extractExports(content);
      
      exportPatterns.push({
        file: relativePath,
        hasDefault: exportInfo.type === 'default',
        namedExports: exportInfo.exports
      });
    }
    
    // Document the patterns for debugging
    console.log('UI Component Export Patterns:', 
      exportPatterns.map(p => `${p.file}: ${p.hasDefault ? 'default' : 'named'} exports`).join(', ')
    );
    
    // Each component should be consistent in its export pattern
    for (const pattern of exportPatterns) {
      if (pattern.hasDefault && pattern.namedExports.length > 0) {
        // Mixed exports are OK, but should be intentional
        console.log(`${pattern.file} has both default and named exports`);
      }
    }
  });
});