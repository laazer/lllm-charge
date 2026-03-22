// Integration tests for expanded common commands system
// Tests all major command categories without making actual system changes

import { CommonCommandHandler } from '../../src/utils/common-commands'
import * as fs from 'fs/promises'
import * as path from 'path'

describe('Expanded Common Commands Integration', () => {
  let handler: CommonCommandHandler
  let testDir: string
  
  beforeAll(async () => {
    handler = new CommonCommandHandler()
    testDir = await fs.mkdtemp(path.join(process.cwd(), 'test-'))
  })
  
  afterAll(async () => {
    // Clean up test directory
    await fs.rm(testDir, { recursive: true }).catch(() => {})
  })

  describe('Build System Commands', () => {
    test('should recognize make commands', async () => {
      const testCases = [
        'make',
        'make build', 
        'make clean',
        'make install'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        // Commands may fail without actual makefiles, but should be recognized
        expect(result).not.toBeNull()
        expect(result?.command).toContain('make')
      }
    })
    
    test('should recognize GoTasks commands', async () => {
      const testCases = [
        'task',
        'task build',
        'gotask test',
        'task clean'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toContain('task')
      }
    })
    
    test('should recognize npx commands', async () => {
      const testCases = [
        'npx prettier --write .',
        'npx tsc --noEmit',
        'npx create-react-app my-app'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toContain('npx')
      }
    })
  })
  
  describe('CLI Tool Commands', () => {
    test('should recognize GitHub CLI commands', async () => {
      const testCases = [
        'gh status',
        'gh pr list',
        'gh issue create',
        'gh repo view'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toContain('gh')
      }
    })
    
    test('should recognize AWS CLI commands', async () => {
      const testCases = [
        'aws s3 ls',
        'aws ec2 describe-instances',
        'aws lambda list-functions'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toContain('aws')
      }
    })
  })
  
  describe('Bash Utility Commands', () => {
    test('should recognize file viewing commands', async () => {
      // Create a test file first
      const testFile = path.join(testDir, 'test.txt')
      await fs.writeFile(testFile, 'test content\nline 2\nline 3')
      
      const testCases = [
        'cat test.txt',
        'head -n 2 test.txt',
        'tail -n 1 test.txt'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        if (result?.success) {
          expect(result.output).toContain('test content')
        }
      }
    })
    
    test('should recognize grep commands', async () => {
      const testCases = [
        'grep "test" package.json',
        'grep -r "function" src/',
        'egrep "[0-9]+" data.txt'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toBe(cmd)
      }
    })
    
    test('should recognize process commands', async () => {
      const testCases = [
        'ps aux',
        'jobs',
        'top'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toBe(cmd)
      }
    })
    
    test('should recognize file operation commands', async () => {
      const testCases = [
        'cp file1.txt file2.txt',
        'mv old.txt new.txt',
        'chmod 755 script.sh',
        'chown user:group file.txt'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toBe(cmd)
      }
    })
    
    test('should recognize download commands', async () => {
      const testCases = [
        'curl https://api.github.com',
        'wget https://example.com/file.zip'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toBe(cmd)
      }
    })
    
    test('should recognize archive commands', async () => {
      const testCases = [
        'tar -czf backup.tar.gz files/',
        'zip -r archive.zip folder/',
        'unzip file.zip'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toBe(cmd)
      }
    })
    
    test('should recognize shell info commands', async () => {
      const testCases = [
        'history',
        'which node',
        'whereis python',
        'type ls'
      ]
      
      for (const cmd of testCases) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toBe(cmd)
      }
    })
  })
  
  describe('Command Coverage Analysis', () => {
    test('should have expanded command coverage', async () => {
      const availableCommands = handler.getAvailableCommands()
      
      // Should have significantly more than the original 25 commands
      expect(availableCommands.length).toBeGreaterThan(40)
      
      // Check for specific command categories
      const patterns = availableCommands.map(cmd => cmd.pattern)
      const categories = {
        make: patterns.some(p => p.includes('make')),
        task: patterns.some(p => p.includes('task')),
        npx: patterns.some(p => p.includes('npx')),
        gh: patterns.some(p => p.includes('gh')),
        aws: patterns.some(p => p.includes('aws')),
        bash: patterns.some(p => p.includes('cat|head|tail')),
        grep: patterns.some(p => p.includes('grep')),
        process: patterns.some(p => p.includes('ps|jobs|top'))
      }
      
      // All categories should be present
      Object.values(categories).forEach(present => {
        expect(present).toBe(true)
      })
    })
    
    test('should maintain backward compatibility', async () => {
      // Original commands should still work
      const originalCommands = [
        'git status',
        'commit and push for me',
        'npm install',
        'list files',
        'kill port 3000',
        'docker ps'
      ]
      
      for (const cmd of originalCommands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
      }
    })
    
    test('should have realistic execution times', async () => {
      // Test a safe command that should work
      const result = await handler.handleCommand('current directory', testDir)
      
      expect(result).not.toBeNull()
      expect(result?.success).toBe(true)
      expect(result?.executionTime).toBeDefined()
      expect(result?.executionTime).toBeGreaterThanOrEqual(0)
    })
    
    test('should provide meaningful error handling', async () => {
      // Test a command that might fail but should be handled gracefully
      const result = await handler.handleCommand('make nonexistent-target', testDir)
      
      expect(result).not.toBeNull()
      if (!result?.success) {
        expect(result?.output).toContain('Error')
      }
    })
  })
  
  describe('Natural Language Processing', () => {
    test('should handle variations in command phrasing', async () => {
      const variations = [
        ['task', 'gotask'],
        ['gh pr list', 'gh pr list --state open'],
        ['make', 'make build']
      ]
      
      for (const [simple, complex] of variations) {
        const simpleResult = await handler.handleCommand(simple, testDir)
        const complexResult = await handler.handleCommand(complex, testDir)
        
        expect(simpleResult).not.toBeNull()
        expect(complexResult).not.toBeNull()
      }
    })
    
    test('should reject unrecognized commands', async () => {
      const unrecognizedCommands = [
        'completely invalid command',
        'xyzzy magic spell',
        'rm -rf / --no-preserve-root' // Dangerous command
      ]
      
      for (const cmd of unrecognizedCommands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).toBeNull()
      }
    })
  })
  
  describe('Performance Characteristics', () => {
    test('should execute commands quickly', async () => {
      const startTime = Date.now()
      const result = await handler.handleCommand('current directory', testDir)
      const executionTime = Date.now() - startTime
      
      expect(result).not.toBeNull()
      expect(executionTime).toBeLessThan(1000) // Should complete in under 1 second
    })
    
    test('should handle batch recognition efficiently', async () => {
      const batchCommands = [
        'git status',
        'npm install', 
        'make build',
        'task test',
        'gh pr list',
        'aws s3 ls',
        'current directory',
        'ps aux'
      ]
      
      const startTime = Date.now()
      const results = await Promise.all(
        batchCommands.map(cmd => handler.handleCommand(cmd, testDir))
      )
      const totalTime = Date.now() - startTime
      
      expect(results.every(r => r !== null)).toBe(true)
      expect(totalTime).toBeLessThan(2000) // Batch should complete quickly
    })
  })
})