// Global test setup
import { setupTestDirectories } from './setup'

export default async function globalSetup() {
  console.log('🧪 Setting up LLM-Charge test environment...')
  
  // Create test directories and files
  await setupTestDirectories()
  
  // Set test environment variables
  process.env.NODE_ENV = 'test'
  process.env.LLM_CHARGE_TEST_MODE = 'true'
  process.env.LLM_CHARGE_LOG_LEVEL = 'error'
  
  console.log('✅ Test environment setup complete')
}