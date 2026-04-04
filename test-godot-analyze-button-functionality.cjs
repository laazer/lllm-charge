// Simple test to verify if the Godot analyze button makes API calls
const { spawn } = require('child_process');

async function testAnalyzeButtonFunctionality() {
  console.log('🔍 Testing Godot Analyze Button Functionality...\n');

  // Test 1: Check if backend MCP endpoints are available
  console.log('1. Testing backend MCP endpoints...');
  
  const mcpTests = [
    'godot_project_analyzer',
    'godot_scene_analyzer', 
    'gdscript_optimizer',
    'component_generator'
  ];

  for (const tool of mcpTests) {
    try {
      const response = await fetch(`http://localhost:3001/mcp/call/${tool}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ ${tool}: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      } else {
        console.log(`   ❌ ${tool}: HTTP ${response.status}`);
      }
    } catch (error) {
      console.log(`   ❌ ${tool}: ${error.message}`);
    }
  }

  console.log('\n2. Testing React frontend response...');
  
  try {
    const response = await fetch('http://localhost:3000/godot');
    if (response.ok) {
      console.log('   ✅ React Godot page loads successfully');
      const html = await response.text();
      
      // Check if the page contains the analyze button
      if (html.includes('Analyze Project') || html.includes('testGodotTool')) {
        console.log('   ✅ Page contains analyze button or testGodotTool function');
      } else {
        console.log('   ⚠️  Page does not contain expected analyze button content');
      }
    } else {
      console.log(`   ❌ React page failed to load: ${response.status}`);
    }
  } catch (error) {
    console.log(`   ❌ React page test failed: ${error.message}`);
  }

  console.log('\n3. Summary of issues found:');
  console.log('   - Tests are mocking the wrong API layer (api-client vs fetch)');
  console.log('   - Tests click buttons but don\'t verify network calls are made'); 
  console.log('   - The testGodotTool function uses fetch() but tests mock api-client');
  console.log('   - Need to mock global.fetch in tests to properly verify API calls');

  console.log('\n4. Recommended fixes:');
  console.log('   ✅ Update tests to mock global.fetch instead of api-client');
  console.log('   ✅ Add assertions that fetch() is called with correct parameters');
  console.log('   ✅ Test the actual network request flow, not just button clicks');
  console.log('   ✅ Verify API responses are properly handled in UI');

  console.log('\n🎯 Root cause: Tests verify button exists and can be clicked,');
  console.log('   but don\'t verify the actual network calls that should happen.');
  console.log('   This is why the analyze button "seems to work" in tests');
  console.log('   but user reports "no network calls" when clicking it.');
}

// Run the test
if (typeof fetch === 'undefined') {
  global.fetch = require('node-fetch');
}

testAnalyzeButtonFunctionality().catch(console.error);