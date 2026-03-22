// Unit tests for CommonCommandHandler
import { CommonCommandHandler } from '../../src/utils/common-commands'
import { TEST_CONFIG } from '../setup'
import * as path from 'path'
import * as fs from 'fs/promises'

describe('CommonCommandHandler', () => {
  let handler: CommonCommandHandler
  let testDir: string

  beforeEach(async () => {
    handler = new CommonCommandHandler()
    testDir = path.join(TEST_CONFIG.TEST_CACHE_DIR, 'command-tests')
    await fs.mkdir(testDir, { recursive: true })
  })

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Command Recognition', () => {
    it('should recognize git commands', async () => {
      const gitCommands = [
        'git status',
        'git add all',
        'commit and push for me',
        'create branch feature-test'
      ]

      for (const cmd of gitCommands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toBeTruthy()
      }
    })

    it('should recognize npm commands', async () => {
      const npmCommands = [
        'npm install',
        'install dependencies for me',
        'npm run build',
        'build for me',
        'run tests'
      ]

      for (const cmd of npmCommands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toBeTruthy()
      }
    })

    it('should recognize make commands', async () => {
      const makeCommands = [
        'make',
        'make build',
        'make clean',
        'make install'
      ]

      for (const cmd of makeCommands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toContain('make')
      }
    })

    it('should recognize npx commands', async () => {
      const npxCommands = [
        'npx prettier --write .',
        'npx tsc --noEmit',
        'npx create-react-app my-app'
      ]

      for (const cmd of npxCommands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toContain('npx')
      }
    })

    it('should recognize file operations', async () => {
      const fileCommands = [
        'list files',
        'current directory',
        'create file test.txt',
        'create directory test-dir'
      ]

      for (const cmd of fileCommands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
      }
    })
  })

  describe('Command Execution', () => {
    it('should execute file listing', async () => {
      // Create some test files
      await fs.writeFile(path.join(testDir, 'test1.txt'), 'content1')
      await fs.writeFile(path.join(testDir, 'test2.txt'), 'content2')

      const result = await handler.handleCommand('list files', testDir)
      
      expect(result).not.toBeNull()
      expect(result?.success).toBe(true)
      expect(result?.output).toContain('test1.txt')
      expect(result?.output).toContain('test2.txt')
    })

    it('should show current directory', async () => {
      const result = await handler.handleCommand('current directory', testDir)
      
      expect(result).not.toBeNull()
      expect(result?.success).toBe(true)
      expect(result?.output).toBe(testDir)
      expect(result?.command).toBe('pwd')
    })

    it('should create files and directories', async () => {
      const fileResult = await handler.handleCommand('create file newfile.txt', testDir)
      expect(fileResult?.success).toBe(true)
      expect(await fs.access(path.join(testDir, 'newfile.txt'))).toBeUndefined()

      const dirResult = await handler.handleCommand('create directory newdir', testDir)
      expect(dirResult?.success).toBe(true)
      expect(await fs.access(path.join(testDir, 'newdir'))).toBeUndefined()
    })

    it('should delete files and directories', async () => {
      // Create test file and directory
      await fs.writeFile(path.join(testDir, 'deleteme.txt'), 'content')
      await fs.mkdir(path.join(testDir, 'deleteme-dir'))

      const fileResult = await handler.handleCommand('delete deleteme.txt', testDir)
      expect(fileResult?.success).toBe(true)

      const dirResult = await handler.handleCommand('delete deleteme-dir', testDir)
      expect(dirResult?.success).toBe(true)
    })
  })

  describe('Command Patterns', () => {
    it('should handle variations in command phrasing', async () => {
      const variations = [
        ['list files', 'ls files'],
        ['current directory', 'working directory'],
        ['npm install', 'install dependencies for me']
      ]

      for (const [cmd1, cmd2] of variations) {
        const result1 = await handler.handleCommand(cmd1, testDir)
        const result2 = await handler.handleCommand(cmd2, testDir)

        expect(result1).not.toBeNull()
        expect(result2).not.toBeNull()
      }
    })

    it('should handle case insensitive commands', async () => {
      const commands = [
        'GIT STATUS',
        'npm install',
        'List Files',
        'CURRENT DIRECTORY'
      ]

      for (const cmd of commands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
      }
    })

    it('should handle commands with extra whitespace', async () => {
      const commands = [
        '  git status  ',
        '\tnpm install\n',
        ' list   files '
      ]

      for (const cmd of commands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
      }
    })
  })

  describe('Error Handling', () => {
    it('should handle non-existent commands gracefully', async () => {
      const invalidCommands = [
        'completely invalid command',
        'xyzzy magic spell',
        'do something impossible'
      ]

      for (const cmd of invalidCommands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).toBeNull()
      }
    })

    it('should handle command execution failures', async () => {
      // Test with a command that will fail
      const result = await handler.handleCommand('delete nonexistent-file.txt', testDir)
      
      if (result) {
        expect(result.success).toBe(false)
        expect(result.output).toContain('Error')
      }
    })

    it('should handle invalid directory operations', async () => {
      const result = await handler.handleCommand('list files in /nonexistent/path', testDir)
      
      if (result) {
        expect(result.success).toBe(false)
      }
    })
  })

  describe('Available Commands', () => {
    it('should list available commands', () => {
      const commands = handler.getAvailableCommands()
      
      expect(Array.isArray(commands)).toBe(true)
      expect(commands.length).toBeGreaterThan(20) // Should have many commands
      
      commands.forEach(cmd => {
        expect(cmd).toHaveProperty('pattern')
        expect(cmd).toHaveProperty('description')
        expect(cmd).toHaveProperty('examples')
        expect(Array.isArray(cmd.examples)).toBe(true)
      })
    })

    it('should categorize commands correctly', () => {
      const commands = handler.getAvailableCommands()
      
      const gitCommands = commands.filter(cmd => 
        cmd.description.toLowerCase().includes('git') ||
        cmd.examples.some(ex => ex.includes('git'))
      )
      
      const fileCommands = commands.filter(cmd =>
        cmd.description.toLowerCase().includes('file') ||
        cmd.description.toLowerCase().includes('directory')
      )
      
      expect(gitCommands.length).toBeGreaterThan(0)
      expect(fileCommands.length).toBeGreaterThan(0)
    })
  })

  describe('Performance', () => {
    it('should execute commands quickly', async () => {
      const startTime = Date.now()
      const result = await handler.handleCommand('current directory', testDir)
      const executionTime = Date.now() - startTime
      
      expect(result).not.toBeNull()
      expect(executionTime).toBeLessThan(1000) // Should complete in under 1 second
    })

    it('should handle concurrent commands', async () => {
      const commands = [
        'current directory',
        'list files',
        'current directory',
        'list files'
      ]

      const startTime = Date.now()
      const promises = commands.map(cmd => handler.handleCommand(cmd, testDir))
      const results = await Promise.all(promises)
      const totalTime = Date.now() - startTime

      expect(results.every(r => r !== null)).toBe(true)
      expect(totalTime).toBeLessThan(2000) // Should complete all in under 2 seconds
    })
  })

  describe('Cost Savings Validation', () => {
    it('should track execution time', async () => {
      const result = await handler.handleCommand('current directory', testDir)
      
      expect(result).not.toBeNull()
      expect(result).toHaveValidCostMetrics()
      expect(result?.cost).toBe(0) // Should always be zero cost
      expect(result?.executionTime).toBeGreaterThanOrEqual(0)
    })

    it('should provide consistent zero-cost execution', async () => {
      const commands = [
        'git status',
        'npm install',
        'list files',
        'current directory'
      ]

      for (const cmd of commands) {
        const result = await handler.handleCommand(cmd, testDir)
        if (result) {
          expect(result.cost).toBe(0)
        }
      }
    })
  })

  describe('Integration with Different Tools', () => {
    it('should handle GitHub CLI commands', async () => {
      const ghCommands = [
        'gh status',
        'gh pr list',
        'gh issue list'
      ]

      for (const cmd of ghCommands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toContain('gh')
      }
    })

    it('should handle AWS CLI commands', async () => {
      const awsCommands = [
        'aws s3 ls',
        'aws ec2 describe-instances',
        'aws lambda list-functions'
      ]

      for (const cmd of awsCommands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
        expect(result?.command).toContain('aws')
      }
    })

    it('should handle bash utility commands', async () => {
      const bashCommands = [
        'ps aux',
        'which node',
        'history'
      ]

      for (const cmd of bashCommands) {
        const result = await handler.handleCommand(cmd, testDir)
        expect(result).not.toBeNull()
      }
    })
  })
})