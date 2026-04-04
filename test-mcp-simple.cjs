// Simple MCP Test Script
// Test the MCP tools without TypeScript compilation issues

const { spawn } = require('child_process');

console.log('🚀 Testing MCP Tools...\n');

async function testMCPClient() {
  try {
    // Import the compiled JavaScript files
    const { MCPFactory } = await import('./dist/src/mcp/index.js');
    
    console.log('✅ MCP Factory imported successfully');
    
    // Create minimal stack
    const { clientManager } = await MCPFactory.createMinimal();
    
    console.log('✅ MCP Client Manager created');
    
    // Test health status
    const status = clientManager.getHealthStatus();
    console.log('📊 Health Status:', {
      initialized: status.initialized,
      connectedServers: status.connectedServers,
      uptime: status.uptime
    });
    
    // Test tool listing
    const tools = await clientManager.listAvailableTools('llm-charge');
    console.log(`📋 Available tools: ${tools['llm-charge']?.length || 0}`);
    
    if (tools['llm-charge']?.length > 0) {
      console.log('🔧 Sample tools:', tools['llm-charge'].slice(0, 3).map(t => t.name));
    }
    
    // Test simple tool execution
    console.log('\n⚡ Testing tool execution...');
    const result = await clientManager.executeTool(
      'llm-charge',
      'get_system_status',
      {},
      { assistant: 'test' }
    );
    
    console.log('📤 Tool execution result:', {
      success: result.success,
      executionTime: result.executionTime + 'ms',
      cost: result.cost ? `$${result.cost.toFixed(4)}` : 'N/A',
      contentLength: result.content[0]?.text?.length || 0
    });
    
    if (result.success) {
      const parsed = JSON.parse(result.content[0].text);
      console.log('📊 System Status:', {
        status: parsed.status,
        uptime: parsed.uptime ? `${parsed.uptime.toFixed(1)}s` : 'N/A'
      });
    }
    
    // Test batch execution
    console.log('\n⚡ Testing batch tool execution...');
    const batchResults = await clientManager.batchExecuteTools([
      {
        serverId: 'llm-charge',
        toolName: 'get_system_status',
        args: {},
        context: { assistant: 'test' }
      },
      {
        serverId: 'llm-charge',
        toolName: 'list_available_commands',
        args: {},
        context: { assistant: 'test' }
      }
    ]);
    
    console.log('📤 Batch execution results:', {
      toolsExecuted: batchResults.length,
      allSuccessful: batchResults.every(r => r.success),
      totalTime: batchResults.reduce((sum, r) => sum + r.executionTime, 0) + 'ms'
    });
    
    // Test tool recommendation
    console.log('\n🎯 Testing tool recommendation...');
    const recommendation = await clientManager.findBestToolForTask(
      'search for code symbols',
      { assistant: 'test' }
    );
    
    if (recommendation) {
      console.log('🎯 Recommended tool:', {
        tool: recommendation.toolName,
        confidence: (recommendation.confidence * 100).toFixed(1) + '%'
      });
    }
    
    // Cleanup
    await clientManager.cleanup();
    console.log('\n✅ MCP Client test completed successfully!');
    
    return true;
    
  } catch (error) {
    console.error('❌ MCP Client test failed:', error.message);
    return false;
  }
}

async function testMCPResourceManager() {
  try {
    console.log('\n📁 Testing MCP Resource Manager...');
    
    const { MCPFactory } = await import('./dist/src/mcp/index.js');
    const { MCPResourceManager } = await import('./dist/src/mcp/resource-manager.js');
    
    const { clientManager } = await MCPFactory.createMinimal();
    
    const resourceManager = new MCPResourceManager(clientManager, {
      autoDiscovery: false,
      discoveryInterval: 60000,
      maxResourcesPerServer: 100,
      cacheResourceList: true,
      enableMetrics: false // Disable to avoid CostTracker issues
    });
    
    await resourceManager.initialize();
    console.log('✅ Resource Manager initialized');
    
    // Test resource discovery
    const index = await resourceManager.discoverResources('llm-charge');
    console.log('📋 Resource discovery:', {
      totalResources: index.totalResources,
      serverCount: index.serverCount
    });
    
    // Test statistics
    const stats = resourceManager.getResourceStatistics();
    console.log('📊 Resource statistics:', {
      totalResources: stats.totalResources,
      totalCached: stats.totalCached
    });
    
    await resourceManager.cleanup();
    await clientManager.cleanup();
    
    console.log('✅ Resource Manager test completed');
    return true;
    
  } catch (error) {
    console.error('❌ Resource Manager test failed:', error.message);
    return false;
  }
}

async function testMCPSkillOrchestrator() {
  try {
    console.log('\n🎭 Testing MCP Skill Orchestrator...');
    
    const { MCPFactory } = await import('./dist/src/mcp/index.js');
    const { MCPSkillOrchestrator } = await import('./dist/src/mcp/client-tools.js');
    
    const { clientManager } = await MCPFactory.createMinimal();
    const orchestrator = new MCPSkillOrchestrator(clientManager);
    
    console.log('✅ Skill Orchestrator created');
    
    // Test built-in skill execution
    const result = await orchestrator.executeSkill(
      'analyze_codebase',
      { query: 'MCP implementation' }
    );
    
    console.log('🎭 Skill execution result:', {
      success: result.success,
      executionTime: result.executionTime + 'ms',
      steps: result.metadata?.stepCount || 0
    });
    
    // Test custom skill creation
    const skillId = await orchestrator.createCompositeSkill(
      'Test Analysis',
      [
        {
          toolName: 'get_system_status',
          serverId: 'llm-charge',
          args: {}
        }
      ]
    );
    
    console.log('🆕 Created custom skill:', skillId);
    
    const customResult = await orchestrator.executeSkill(skillId, {});
    console.log('🎭 Custom skill result:', {
      success: customResult.success,
      executionTime: customResult.executionTime + 'ms'
    });
    
    await clientManager.cleanup();
    console.log('✅ Skill Orchestrator test completed');
    return true;
    
  } catch (error) {
    console.error('❌ Skill Orchestrator test failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('🎯 Starting MCP Integration Tests...\n');
  
  const results = {
    client: false,
    resources: false,
    skills: false
  };
  
  try {
    results.client = await testMCPClient();
    results.resources = await testMCPResourceManager();
    results.skills = await testMCPSkillOrchestrator();
    
    const passed = Object.values(results).filter(Boolean).length;
    const total = Object.keys(results).length;
    
    console.log(`\n📊 Test Results: ${passed}/${total} passed`);
    
    if (passed === total) {
      console.log('🎉 All MCP tests passed successfully!');
      process.exit(0);
    } else {
      console.log('❌ Some MCP tests failed');
      console.log('Failed tests:', Object.entries(results)
        .filter(([_, passed]) => !passed)
        .map(([name]) => name)
        .join(', '));
      process.exit(1);
    }
    
  } catch (error) {
    console.error('❌ Test runner failed:', error);
    process.exit(1);
  }
}

// Check if we need to build first
const fs = require('fs');
const path = require('path');

if (!fs.existsSync(path.join(__dirname, 'dist', 'src', 'mcp', 'index.js'))) {
  console.log('📦 Building project first...');
  
  const buildProcess = spawn('npm', ['run', 'build'], { stdio: 'inherit' });
  
  buildProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Build completed, starting tests...\n');
      runTests();
    } else {
      console.log('❌ Build failed, trying to run tests anyway...\n');
      runTests();
    }
  });
} else {
  runTests();
}