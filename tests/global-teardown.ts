// Global test teardown
import { cleanupTestDirectories } from './setup'

export default async function globalTeardown() {
  console.log('🧹 Cleaning up test environment...')
  
  // Cleanup test directories
  await cleanupTestDirectories()
  
  console.log('✅ Test cleanup complete')
}