#!/usr/bin/env node

/**
 * API Documentation Checker Script
 * Validates that documented API endpoints match actual implementation
 * Part of MODERATE-002: API Endpoint Validation ticket
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class APIDocumentationChecker {
  constructor() {
    this.serverFile = path.join(__dirname, '..', 'src', 'server', 'comprehensive-working-server.mjs');
    this.readmeFile = path.join(__dirname, '..', 'README.md');
    this.claudeFile = path.join(__dirname, '..', 'CLAUDE.md');
    
    this.implementedEndpoints = new Set();
    this.documentedEndpoints = new Set();
    this.results = {
      implemented: [],
      documented: [],
      undocumented: [],
      unimplemented: [],
      discrepancies: []
    };
  }

  /**
   * Extract actual API endpoints from server implementation
   */
  extractImplementedEndpoints() {
    console.log('🔍 Scanning server implementation for API endpoints...');
    
    if (!fs.existsSync(this.serverFile)) {
      throw new Error(`Server file not found: ${this.serverFile}`);
    }

    const serverContent = fs.readFileSync(this.serverFile, 'utf8');
    
    // Extract endpoints from pathname checks and route handlers
    const endpointPatterns = [
      // Standard pathname matches: pathname === '/api/endpoint'
      /pathname\s*===\s*['"`]([^'"`]+)['"`]/g,
      // Startswith patterns: pathname.startsWith('/api/endpoint')
      /pathname\.startsWith\(['"`]([^'"`]+)['"`]\)/g,
      // Route handler patterns: app.get('/api/endpoint', ...)
      /app\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g,
      // Express route patterns: router.method('/endpoint', ...)
      /router\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g
    ];

    endpointPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(serverContent)) !== null) {
        let endpoint = match[2] || match[1]; // Handle different capture groups
        
        // Clean up the endpoint
        if (endpoint && endpoint.startsWith('/')) {
          // Remove query parameters and fragments
          endpoint = endpoint.split('?')[0].split('#')[0];
          
          // Skip non-API endpoints and invalid matches
          if (endpoint.includes('/api/') || endpoint.includes('/mcp/')) {
            this.implementedEndpoints.add(endpoint);
          }
        }
      }
    });

    // Additional manual extraction for complex patterns
    this.extractComplexEndpoints(serverContent);
    
    this.results.implemented = Array.from(this.implementedEndpoints).sort();
    console.log(`✅ Found ${this.results.implemented.length} implemented endpoints`);
  }

  /**
   * Extract complex endpoint patterns that regex might miss
   */
  extractComplexEndpoints(content) {
    // Extract dynamic route patterns
    const dynamicPatterns = [
      '/api/projects/:projectId/specs',
      '/api/projects/:projectId/agents',
      '/api/projects/:projectId/workflows',
      '/api/projects/:projectId/notes',
      '/api/projects/:projectId/checkpoints',
      '/api/specs/:id',
      '/api/agents/:id',
      '/api/workflows/:id',
      '/api/workflows/:id/execute',
      '/api/memory/notes/:id',
      '/api/memory/checkpoints/:id',
      '/mcp/call/:tool'
    ];

    // Check if these patterns are actually implemented
    dynamicPatterns.forEach(pattern => {
      const staticPart = pattern.split('/:')[0];
      if (content.includes(staticPart) || content.includes(pattern)) {
        this.implementedEndpoints.add(pattern);
      }
    });

    // Extract endpoints from specific code sections
    const specificEndpoints = [
      '/api/health',
      '/api/metrics', 
      '/api/test',
      '/api/projects',
      '/api/specs',
      '/api/agents',
      '/api/workflows', 
      '/api/memory/notes',
      '/api/memory/checkpoints',
      '/api/codegraph/status',
      '/api/codegraph/search',
      '/api/reasoning/stats',
      '/api/reasoning/logs',
      '/api/providers/status',
      '/api/setup/status',
      '/api/setup/defaults',
      '/api/devdocs/languages',
      '/api/devdocs/search',
      '/api/universal-lang/languages',
      '/api/llm-providers/status',
      '/api/hybrid-routing/metrics',
      '/api/hybrid-routing/route',
      '/api/cron/jobs',
      '/api/cron/jobs/:id',
      '/api/cron/jobs/:id/execute',
      '/api/blender/generate',
      '/api/blender/status',
      '/mcp/tools',
      '/mcp/resources', 
      '/mcp/status'
    ];

    specificEndpoints.forEach(endpoint => {
      if (content.includes(endpoint.replace('/:id', '')) || content.includes(endpoint)) {
        this.implementedEndpoints.add(endpoint);
      }
    });
  }

  /**
   * Extract documented API endpoints from README and CLAUDE.md
   */
  extractDocumentedEndpoints() {
    console.log('📚 Scanning documentation files for API endpoints...');
    
    const files = [
      { file: this.readmeFile, name: 'README.md' },
      { file: this.claudeFile, name: 'CLAUDE.md' }
    ];

    files.forEach(({ file, name }) => {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8');
        this.extractEndpointsFromText(content, name);
      } else {
        console.warn(`⚠️  Documentation file not found: ${name}`);
      }
    });

    this.results.documented = Array.from(this.documentedEndpoints).sort();
    console.log(`✅ Found ${this.results.documented.length} documented endpoints`);
  }

  /**
   * Extract endpoints from documentation text
   */
  extractEndpointsFromText(content, filename) {
    // Patterns to find API endpoints in documentation
    const docPatterns = [
      // Code blocks with HTTP methods
      /(?:GET|POST|PUT|DELETE|PATCH)\s+([\/\w\-:]+)/gi,
      // URL patterns in text
      /(?:https?:\/\/[^\/\s]+)?([\/]api[\/\w\-:]*)/gi,
      // Markdown code spans with endpoints
      /`([\/](?:api|mcp)[\/\w\-:]*)`/gi,
      // Route examples
      /\/api\/[\w\-\/:]*/gi,
      /\/mcp\/[\w\-\/:]*/gi
    ];

    docPatterns.forEach(pattern => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        let endpoint = match[1] || match[0];
        
        // Clean and validate endpoint
        if (endpoint && endpoint.startsWith('/')) {
          endpoint = endpoint.split('?')[0].split('#')[0];
          if (endpoint.includes('/api/') || endpoint.includes('/mcp/')) {
            this.documentedEndpoints.add(endpoint);
          }
        }
      }
    });
  }

  /**
   * Compare implemented vs documented endpoints
   */
  compareEndpoints() {
    console.log('🔍 Comparing implemented vs documented endpoints...');
    
    // Find undocumented endpoints (implemented but not documented)
    this.results.undocumented = this.results.implemented.filter(
      endpoint => !this.documentedEndpoints.has(endpoint)
    );

    // Find unimplemented endpoints (documented but not implemented) 
    this.results.unimplemented = this.results.documented.filter(
      endpoint => !this.implementedEndpoints.has(endpoint)
    );

    // Identify potential discrepancies (similar but not exact matches)
    this.findDiscrepancies();
  }

  /**
   * Find potential discrepancies between documented and implemented endpoints
   */
  findDiscrepancies() {
    this.results.discrepancies = [];
    
    this.results.documented.forEach(docEndpoint => {
      if (!this.implementedEndpoints.has(docEndpoint)) {
        // Look for similar implemented endpoints
        const similar = this.results.implemented.filter(implEndpoint => {
          const docBase = docEndpoint.replace(/\/:[^\/]+/g, '');
          const implBase = implEndpoint.replace(/\/:[^\/]+/g, '');
          return docBase === implBase || 
                 this.calculateSimilarity(docEndpoint, implEndpoint) > 0.7;
        });

        if (similar.length > 0) {
          this.results.discrepancies.push({
            documented: docEndpoint,
            similar: similar
          });
        }
      }
    });
  }

  /**
   * Calculate string similarity between two endpoints
   */
  calculateSimilarity(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0 || len2 === 0) return 0;
    
    let matches = 0;
    const minLen = Math.min(len1, len2);
    
    for (let i = 0; i < minLen; i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return matches / Math.max(len1, len2);
  }

  /**
   * Generate comprehensive report
   */
  generateReport() {
    console.log('\n📊 API Documentation Validation Report');
    console.log('=' .repeat(50));
    
    // Summary statistics
    console.log(`\n📈 Summary Statistics:`);
    console.log(`   Implemented endpoints: ${this.results.implemented.length}`);
    console.log(`   Documented endpoints: ${this.results.documented.length}`);
    console.log(`   Undocumented endpoints: ${this.results.undocumented.length}`);
    console.log(`   Unimplemented endpoints: ${this.results.unimplemented.length}`);
    console.log(`   Potential discrepancies: ${this.results.discrepancies.length}`);

    // Coverage calculation
    const totalUnique = new Set([...this.results.implemented, ...this.results.documented]).size;
    const coverage = totalUnique > 0 ? 
      ((totalUnique - this.results.undocumented.length - this.results.unimplemented.length) / totalUnique * 100).toFixed(1) : 0;
    console.log(`   Documentation coverage: ${coverage}%`);

    // Undocumented endpoints (high priority)
    if (this.results.undocumented.length > 0) {
      console.log(`\n❌ Undocumented Endpoints (${this.results.undocumented.length}):`);
      this.results.undocumented.forEach(endpoint => {
        console.log(`   • ${endpoint}`);
      });
    }

    // Unimplemented endpoints (medium priority)
    if (this.results.unimplemented.length > 0) {
      console.log(`\n⚠️  Unimplemented Endpoints (${this.results.unimplemented.length}):`);
      this.results.unimplemented.forEach(endpoint => {
        console.log(`   • ${endpoint}`);
      });
    }

    // Discrepancies (low priority but worth noting)
    if (this.results.discrepancies.length > 0) {
      console.log(`\n🔍 Potential Discrepancies (${this.results.discrepancies.length}):`);
      this.results.discrepancies.forEach(({ documented, similar }) => {
        console.log(`   • Documented: ${documented}`);
        console.log(`     Similar: ${similar.join(', ')}`);
      });
    }

    // All implemented endpoints for reference
    if (process.argv.includes('--verbose') || process.argv.includes('-v')) {
      console.log(`\n✅ All Implemented Endpoints (${this.results.implemented.length}):`);
      this.results.implemented.forEach(endpoint => {
        console.log(`   • ${endpoint}`);
      });
    }

    // Recommendations
    console.log(`\n💡 Recommendations:`);
    if (this.results.undocumented.length > 0) {
      console.log(`   • Add documentation for ${this.results.undocumented.length} undocumented endpoints`);
    }
    if (this.results.unimplemented.length > 0) {
      console.log(`   • Remove or implement ${this.results.unimplemented.length} documented but unimplemented endpoints`);
    }
    if (this.results.discrepancies.length > 0) {
      console.log(`   • Review ${this.results.discrepancies.length} potential discrepancies for accuracy`);
    }
    if (coverage < 90) {
      console.log(`   • Improve documentation coverage from ${coverage}% to 90%+`);
    }

    return {
      success: this.results.undocumented.length === 0 && this.results.unimplemented.length === 0,
      coverage: parseFloat(coverage),
      ...this.results
    };
  }

  /**
   * Save results to JSON file for programmatic access
   */
  saveResults() {
    const outputFile = path.join(__dirname, '..', 'docs', 'api-validation-results.json');
    const outputDir = path.dirname(outputFile);
    
    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const output = {
      timestamp: new Date().toISOString(),
      summary: {
        implemented: this.results.implemented.length,
        documented: this.results.documented.length,
        undocumented: this.results.undocumented.length,
        unimplemented: this.results.unimplemented.length,
        discrepancies: this.results.discrepancies.length,
        coverage: this.generateReport().coverage
      },
      details: this.results
    };

    fs.writeFileSync(outputFile, JSON.stringify(output, null, 2));
    console.log(`\n💾 Results saved to: ${outputFile}`);
  }

  /**
   * Run the complete validation process
   */
  async run() {
    try {
      console.log('🚀 Starting API Documentation Validation...\n');
      
      this.extractImplementedEndpoints();
      this.extractDocumentedEndpoints();
      this.compareEndpoints();
      
      const report = this.generateReport();
      this.saveResults();
      
      console.log('\n✅ API Documentation Validation Complete!');
      
      // Exit with appropriate code
      process.exit(report.success ? 0 : 1);
      
    } catch (error) {
      console.error('❌ API Documentation Validation Failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const checker = new APIDocumentationChecker();
  checker.run();
}

export default APIDocumentationChecker;