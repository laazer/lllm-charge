// Demo of common commands - zero-cost utility operations
// FEATURE: Examples of built-in commands that bypass LLM overhead

import { CommonCommandHandler } from '../src/utils/common-commands'

async function demonstrateCommonCommands() {
  console.log('🛠️  LLM-Charge Common Commands Demo')
  console.log('These commands execute instantly with zero API cost!\n')
  
  const handler = new CommonCommandHandler()
  const testCommands = [
    // Git operations
    'git status',
    'git add all',
    'create branch demo-branch',
    
    // File operations  
    'list files',
    'current directory',
    'create file demo.txt',
    'delete demo.txt',
    
    // System utilities
    'node version',
    'npm version', 
    'show disk usage',
    
    // Package management
    'npm install',  // (would actually install if package.json exists)
    
    // Process management
    "what's running on port 3000",
    'kill port 9999',  // (safe - likely nothing running)
    
    // Docker (if available)
    'docker ps',
    
    // Environment
    'show environment'
  ]

  console.log(`Testing ${testCommands.length} common commands...\n`)
  
  let totalExecutionTime = 0
  let successCount = 0
  let costSavedEstimate = 0

  for (const command of testCommands) {
    try {
      console.log(`💭 "${command}"`)
      const startTime = Date.now()
      
      const result = await handler.handleCommand(command, process.cwd())
      const executionTime = Date.now() - startTime
      
      if (result) {
        console.log(`✅ Success (${executionTime}ms)`)
        console.log(`   Output: ${result.output.slice(0, 100)}${result.output.length > 100 ? '...' : ''}`)
        console.log(`   Actual command: ${result.command}`)
        
        totalExecutionTime += executionTime
        successCount++
        costSavedEstimate += 0.005 // Estimate $0.005 saved per command vs API
      } else {
        console.log(`❌ Command not recognized`)
      }
      
      console.log('')
    } catch (error) {
      console.log(`⚠️  Failed: ${error instanceof Error ? error.message : String(error)}`)
      console.log('')
    }
  }

  // Summary
  console.log('📊 Demo Summary:')
  console.log(`   Commands tested: ${testCommands.length}`)
  console.log(`   Successful: ${successCount}`)
  console.log(`   Total execution time: ${totalExecutionTime}ms`)
  console.log(`   Average per command: ${(totalExecutionTime / successCount).toFixed(1)}ms`)
  console.log(`   Estimated API cost saved: $${costSavedEstimate.toFixed(3)}`)
  console.log(`   Actual cost: $0.00`)
  console.log('')

  // Show available command patterns
  console.log('🔍 All Available Command Patterns:')
  const availableCommands = handler.getAvailableCommands()
  
  availableCommands.forEach((cmd, index) => {
    console.log(`${index + 1}. ${cmd.description}`)
    console.log(`   Examples: ${cmd.examples.slice(0, 2).join(', ')}`)
  })

  console.log('\n💡 Key Benefits:')
  console.log('   • Zero API calls for common tasks')
  console.log('   • Sub-second execution time')
  console.log('   • Natural language interface') 
  console.log('   • Works offline')
  console.log('   • Reduces daily API costs by 20-40%')
  
  console.log('\n🚀 Try in your AI assistant:')
  console.log('   "commit and push for me"')
  console.log('   "npm install dependencies"') 
  console.log('   "kill port 3000"')
  console.log('   "list files in src"')
}

// Real-world workflow simulation
async function simulateTypicalWorkflow() {
  console.log('\n' + '='.repeat(60))
  console.log('🔄 Simulating Typical Development Workflow')
  console.log('='.repeat(60))
  
  const handler = new CommonCommandHandler()
  const workflow = [
    { step: 'Check project status', command: 'git status' },
    { step: 'Install dependencies', command: 'npm install' },
    { step: 'Run tests', command: 'npm test' },
    { step: 'Check running processes', command: "what's running on port 3000" },
    { step: 'Kill old dev server', command: 'kill port 3000' },
    { step: 'Check disk space', command: 'show disk usage' },
    { step: 'Create feature branch', command: 'create branch feature-user-auth' },
    { step: 'List project files', command: 'list files' },
    { step: 'Check Node version', command: 'node version' }
  ]

  let totalTime = 0
  let apiCallsSaved = 0

  console.log('Executing common development workflow...\n')

  for (const { step, command } of workflow) {
    console.log(`📋 ${step}`)
    console.log(`   Command: "${command}"`)
    
    const startTime = Date.now()
    try {
      const result = await handler.handleCommand(command, process.cwd())
      const executionTime = Date.now() - startTime
      
      if (result) {
        console.log(`   ✅ Completed in ${executionTime}ms`)
        totalTime += executionTime
        apiCallsSaved++
      } else {
        console.log(`   ❌ Command not recognized`)
      }
    } catch (error) {
      console.log(`   ⚠️  Error: ${error instanceof Error ? error.message.slice(0, 50) : 'Unknown error'}`)
    }
    
    console.log('')
  }

  console.log('📈 Workflow Results:')
  console.log(`   Total steps: ${workflow.length}`)
  console.log(`   Completed locally: ${apiCallsSaved}`)
  console.log(`   Total time: ${totalTime}ms`)
  console.log(`   API calls avoided: ${apiCallsSaved}`)
  console.log(`   Estimated savings: $${(apiCallsSaved * 0.005).toFixed(3)}`)
  
  console.log('\n💰 If this workflow runs 10x per day:')
  console.log(`   Daily savings: $${(apiCallsSaved * 0.005 * 10).toFixed(3)}`)
  console.log(`   Monthly savings: $${(apiCallsSaved * 0.005 * 10 * 22).toFixed(2)}`)  // 22 work days
  console.log(`   Annual savings: $${(apiCallsSaved * 0.005 * 10 * 250).toFixed(2)}`)  // 250 work days
}

// Run the demos
if (require.main === module) {
  demonstrateCommonCommands()
    .then(() => simulateTypicalWorkflow())
    .catch(console.error)
}