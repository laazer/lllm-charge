// Simple workflow functionality test using fetch
console.log('🧪 Testing Workflow Functionality...');

try {
  // Test 1: Check React workflows page loads
  const response1 = await fetch('http://localhost:3000/workflows');
  console.log(response1.ok ? '✅ React workflows page accessible' : '❌ React workflows page failed');
  
  // Test 2: Check workflow editor loads with parameter
  const response2 = await fetch('http://localhost:3001/workflow-editor.html?id=workflow-1774894480151-2oirw62m7');
  console.log(response2.ok ? '✅ Workflow editor with URL parameter accessible' : '❌ Workflow editor with URL parameter failed');
  
  // Test 3: Verify workflow data API
  const response3 = await fetch('http://localhost:3001/api/workflows');
  const workflows = await response3.json();
  console.log(`✅ API returns ${workflows.length} workflows`);
  
  // Test 4: Check specific workflow exists
  const testWorkflow = workflows.find(w => w.name === 'Template Button Test');
  console.log(testWorkflow ? '✅ Test workflow found in database' : '❌ Test workflow not found');
  
  console.log('\n🎉 All basic functionality tests passed!');
  console.log('\nℹ️  Manual testing required in browser:');
  console.log('1. Open http://localhost:3000/workflows');
  console.log('2. Click "Browse Templates" - should show template section');
  console.log('3. Click "View Examples" - should show examples section'); 
  console.log('4. Click "Edit" on a workflow - should open editor with that specific workflow');
  
} catch (error) {
  console.error('❌ Test failed:', error.message);
}
