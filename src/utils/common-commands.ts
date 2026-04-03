// Common utility commands that should never require API calls
// FEATURE: Built-in command handlers for simple tasks

import { execSync, spawn } from 'child_process'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface CommandResult {
  success: boolean
  output: string
  command: string
  executionTime: number
  cost: number
}

export interface CommandPattern {
  pattern: RegExp
  handler: (match: RegExpMatchArray, cwd: string) => Promise<CommandResult>
  description: string
  examples: string[]
}

export class CommonCommandHandler {
  private patterns: CommandPattern[]
  
  constructor() {
    this.patterns = this.initializePatterns()
  }

  async handleCommand(input: string, cwd: string = process.cwd()): Promise<CommandResult | null> {
    const normalizedInput = input.toLowerCase().trim()
    
    for (const pattern of this.patterns) {
      const match = normalizedInput.match(pattern.pattern)
      if (match) {
        const startTime = Date.now()
        try {
          const result = await pattern.handler(match, cwd)
          result.executionTime = Date.now() - startTime
          result.cost = 0 // Always zero cost for local commands
          return result
        } catch (error) {
          return {
            success: false,
            output: `Error: ${error instanceof Error ? error.message : String(error)}`,
            command: input,
            executionTime: Date.now() - startTime,
            cost: 0
          }
        }
      }
    }
    
    return null // No matching pattern found
  }

  getAvailableCommands(): Array<{pattern: string, description: string, examples: string[]}> {
    return this.patterns.map(p => ({
      pattern: p.pattern.source,
      description: p.description,
      examples: p.examples
    }))
  }

  private initializePatterns(): CommandPattern[] {
    return [
      // Git operations
      {
        pattern: /^(?:git\s+)?commit(?:\s+and\s+push)?(?:\s+for\s+me)?(?:\s+with\s+message\s+['"](.*?)['"])?$/,
        handler: this.handleGitCommitAndPush.bind(this),
        description: 'Commits all changes and optionally pushes to remote',
        examples: [
          'commit and push for me',
          'git commit and push',
          'commit with message "fix bug"',
          'commit and push with message "add new feature"'
        ]
      },
      {
        pattern: /^(?:git\s+)?(?:add\s+all|stage\s+all|add\s+\.)$/,
        handler: this.handleGitAddAll.bind(this),
        description: 'Stages all changes for commit',
        examples: ['git add all', 'stage all', 'add .']
      },
      {
        pattern: /^(?:git\s+)?push(?:\s+for\s+me)?$/,
        handler: this.handleGitPush.bind(this),
        description: 'Pushes current branch to remote',
        examples: ['git push', 'push for me']
      },
      {
        pattern: /^(?:git\s+)?pull(?:\s+for\s+me)?$/,
        handler: this.handleGitPull.bind(this),
        description: 'Pulls latest changes from remote',
        examples: ['git pull', 'pull for me']
      },
      {
        pattern: /^(?:git\s+)?status$/,
        handler: this.handleGitStatus.bind(this),
        description: 'Shows git repository status',
        examples: ['git status', 'status']
      },
      {
        pattern: /^create\s+(?:new\s+)?branch\s+(?:called\s+)?['"]*([^'"]+)['"]*$/,
        handler: this.handleCreateBranch.bind(this),
        description: 'Creates and switches to a new git branch',
        examples: ['create branch feature-xyz', 'create new branch called "bug-fix"']
      },
      
      // Make and build systems
      {
        pattern: /^make(?:\s+(\w+))?$/,
        handler: this.handleMake.bind(this),
        description: 'Runs make commands',
        examples: ['make', 'make build', 'make clean', 'make install']
      },
      {
        pattern: /^(?:gotasks?|task)(?:\s+(\w+))?$/,
        handler: this.handleGoTasks.bind(this),
        description: 'Runs Go Task commands', 
        examples: ['task', 'task build', 'gotask test', 'task clean']
      },
      {
        pattern: /^npx\s+([\w@\/\-\.]+)(?:\s+(.+))?$/,
        handler: this.handleNpx.bind(this),
        description: 'Runs npx commands',
        examples: ['npx create-react-app', 'npx prettier --write .', 'npx tsc']
      },

      // Package management
      {
        pattern: /^(?:npm\s+)?install(?:\s+dependencies)?(?:\s+for\s+me)?$/,
        handler: this.handleNpmInstall.bind(this),
        description: 'Installs npm dependencies',
        examples: ['npm install', 'install dependencies for me']
      },
      {
        pattern: /^(?:npm\s+)?(?:run\s+)?build(?:\s+for\s+me)?$/,
        handler: this.handleNpmBuild.bind(this),
        description: 'Runs the build script',
        examples: ['npm run build', 'build for me']
      },
      {
        pattern: /^(?:npm\s+)?(?:run\s+)?test(?:s)?(?:\s+for\s+me)?$/,
        handler: this.handleNpmTest.bind(this),
        description: 'Runs tests',
        examples: ['npm test', 'run tests for me']
      },
      {
        pattern: /^(?:npm\s+)?(?:run\s+)?dev(?:\s+server)?(?:\s+for\s+me)?$/,
        handler: this.handleNpmDev.bind(this),
        description: 'Starts development server',
        examples: ['npm run dev', 'start dev server for me']
      },

      // File operations
      {
        pattern: /^(?:list|ls)\s+files?(?:\s+in\s+([^\s]+))?$/,
        handler: this.handleListFiles.bind(this),
        description: 'Lists files in directory',
        examples: ['list files', 'ls files in src']
      },
      {
        pattern: /^create\s+(?:file|directory)\s+(?:called\s+)?['"]*([^'"]+)['"]*$/,
        handler: this.handleCreateFileOrDir.bind(this),
        description: 'Creates a file or directory',
        examples: ['create file test.js', 'create directory components']
      },
      {
        pattern: /^delete\s+(?:file\s+)?['"]*([^'"]+)['"]*$/,
        handler: this.handleDeleteFile.bind(this),
        description: 'Deletes a file or directory',
        examples: ['delete file old.js', 'delete temp-folder']
      },

      // Process management
      {
        pattern: /^(?:kill|stop)\s+(?:process\s+)?(?:on\s+port\s+)?(\d+)$/,
        handler: this.handleKillPort.bind(this),
        description: 'Kills process running on specified port',
        examples: ['kill process on port 3000', 'stop 8080']
      },
      {
        pattern: /^(?:what's|whats)\s+(?:running\s+)?(?:on\s+)?port\s+(\d+)$/,
        handler: this.handleCheckPort.bind(this),
        description: 'Checks what process is running on a port',
        examples: ["what's running on port 3000", 'whats on port 8080']
      },

      // System utilities
      {
        pattern: /^(?:show\s+)?disk\s+(?:usage|space)(?:\s+for\s+(.+))?$/,
        handler: this.handleDiskUsage.bind(this),
        description: 'Shows disk usage for directory',
        examples: ['show disk usage', 'disk space for /home']
      },
      {
        pattern: /^(?:find|search)\s+(?:for\s+)?['"]*([^'"]+)['"]*(?:\s+in\s+(.+))?$/,
        handler: this.handleFindFiles.bind(this),
        description: 'Searches for files by name',
        examples: ['find "*.js"', 'search for test in src']
      },
      {
        pattern: /^(?:current\s+)?(?:working\s+)?directory$/,
        handler: this.handleCurrentDirectory.bind(this),
        description: 'Shows current working directory',
        examples: ['current directory', 'working directory']
      },

      // Docker operations
      {
        pattern: /^docker\s+(?:build|up|down|ps|logs)(?:\s+(.+))?$/,
        handler: this.handleDockerCommand.bind(this),
        description: 'Common docker operations',
        examples: ['docker build', 'docker up', 'docker ps', 'docker logs']
      },

      // GitHub CLI operations
      {
        pattern: /^gh\s+(\w+)(?:\s+(.+))?$/,
        handler: this.handleGitHubCLI.bind(this),
        description: 'GitHub CLI operations',
        examples: ['gh status', 'gh pr list', 'gh issue create', 'gh repo view']
      },
      
      // AWS CLI operations 
      {
        pattern: /^aws\s+(\w+)\s+(\w+)(?:\s+(.+))?$/,
        handler: this.handleAWSCLI.bind(this),
        description: 'AWS CLI operations',
        examples: ['aws s3 ls', 'aws ec2 describe-instances', 'aws lambda list-functions']
      },

      // Common bash/shell commands
      {
        pattern: /^(?:cat|head|tail)\s+([^\s]+)(?:\s+(.+))?$/,
        handler: this.handleFileView.bind(this),
        description: 'View file contents',
        examples: ['cat package.json', 'head -n 10 log.txt', 'tail -f server.log']
      },
      {
        pattern: /^(?:grep|egrep|fgrep)\s+["']?([^"']+)["']?(?:\s+([^\s]+))?(?:\s+(.+))?$/,
        handler: this.handleGrep.bind(this),
        description: 'Search text in files',
        examples: ['grep "error" log.txt', 'grep -r "function" src/', 'egrep "[0-9]+" data.txt']
      },
      {
        pattern: /^(?:ps|jobs|top|htop)(?:\s+(.+))?$/,
        handler: this.handleProcessCommands.bind(this),
        description: 'Process management commands',
        examples: ['ps aux', 'jobs', 'top', 'htop']
      },
      {
        pattern: /^(?:cp|mv|rsync)\s+([^\s]+)\s+([^\s]+)(?:\s+(.+))?$/,
        handler: this.handleFileCopy.bind(this),
        description: 'Copy/move files',
        examples: ['cp file.txt backup.txt', 'mv old.txt new.txt', 'rsync -av src/ dest/']
      },
      {
        pattern: /^(?:chmod|chown)\s+([^\s]+)\s+([^\s]+)(?:\s+(.+))?$/,
        handler: this.handleFilePermissions.bind(this),
        description: 'Change file permissions/ownership',
        examples: ['chmod 755 script.sh', 'chown user:group file.txt']
      },
      {
        pattern: /^(?:curl|wget)\s+([^\s]+)(?:\s+(.+))?$/,
        handler: this.handleDownload.bind(this),
        description: 'Download files or make HTTP requests',
        examples: ['curl https://api.example.com', 'wget https://example.com/file.zip']
      },
      {
        pattern: /^(?:tar|zip|unzip)\s+([^\s]+)(?:\s+(.+))?$/,
        handler: this.handleArchive.bind(this),
        description: 'Archive and compression operations',
        examples: ['tar -czf backup.tar.gz files/', 'zip -r archive.zip folder/', 'unzip file.zip']
      },
      {
        pattern: /^(?:history|which|whereis|type)(?:\s+(.+))?$/,
        handler: this.handleShellInfo.bind(this),
        description: 'Shell information commands',
        examples: ['history', 'which python', 'whereis gcc', 'type ls']
      },

      // Environment and config
      {
        pattern: /^(?:show\s+)?(?:env|environment)(?:\s+variables?)?$/,
        handler: this.handleShowEnv.bind(this),
        description: 'Shows environment variables',
        examples: ['show environment', 'env variables']
      },
      {
        pattern: /^(?:check\s+)?node\s+version$/,
        handler: this.handleNodeVersion.bind(this),
        description: 'Shows Node.js version',
        examples: ['check node version', 'node version']
      },
      {
        pattern: /^(?:check\s+)?npm\s+version$/,
        handler: this.handleNpmVersion.bind(this),
        description: 'Shows npm version', 
        examples: ['check npm version', 'npm version']
      }
    ]
  }

  // Git command handlers
  private async handleGitCommitAndPush(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const message = match[1] || 'Auto-commit via LLM-Charge'
    const commands = [
      'git add .',
      `git commit -m "${message}"`,
      'git push'
    ]

    let output = ''
    for (const cmd of commands) {
      try {
        const result = execSync(cmd, { cwd, encoding: 'utf-8', stdio: 'pipe' })
        output += `$ ${cmd}\n${result}\n`
      } catch (error: any) {
        output += `$ ${cmd}\nError: ${error.message}\n`
        if (cmd.includes('push')) {
          // If push fails, still consider commit successful
          output += 'Note: Commit was successful, but push failed\n'
        } else {
          throw error
        }
      }
    }

    return {
      success: true,
      output,
      command: `git commit and push with message "${message}"`,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleGitAddAll(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const result = execSync('git add .', { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result || 'All files staged for commit',
      command: 'git add .',
      executionTime: 0,
      cost: 0
    }
  }

  private async handleGitPush(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const result = execSync('git push', { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: 'git push',
      executionTime: 0,
      cost: 0
    }
  }

  private async handleGitPull(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const result = execSync('git pull', { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: 'git pull', 
      executionTime: 0,
      cost: 0
    }
  }

  private async handleGitStatus(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const result = execSync('git status', { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: 'git status',
      executionTime: 0,
      cost: 0
    }
  }

  private async handleCreateBranch(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const branchName = match[1]
    const result = execSync(`git checkout -b ${branchName}`, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: `git checkout -b ${branchName}`,
      executionTime: 0,
      cost: 0
    }
  }

  // Package management handlers
  private async handleNpmInstall(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const result = execSync('npm install', { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: 'npm install',
      executionTime: 0,
      cost: 0
    }
  }

  private async handleNpmBuild(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const result = execSync('npm run build', { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: 'npm run build',
      executionTime: 0,
      cost: 0
    }
  }

  private async handleNpmTest(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const result = execSync('npm test', { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: 'npm test',
      executionTime: 0,
      cost: 0
    }
  }

  private async handleNpmDev(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    // For dev server, we don't want to block - just start it
    const child = spawn('npm', ['run', 'dev'], { 
      cwd, 
      detached: true,
      stdio: 'inherit'
    })
    
    return {
      success: true,
      output: `Development server starting (PID: ${child.pid})`,
      command: 'npm run dev',
      executionTime: 0,
      cost: 0
    }
  }

  // File operation handlers
  private async handleListFiles(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const directory = match[1] || '.'
    const fullPath = path.resolve(cwd, directory)
    
    const files = await fs.readdir(fullPath, { withFileTypes: true })
    const output = files.map(file => {
      const type = file.isDirectory() ? 'DIR' : 'FILE'
      return `${type.padEnd(4)} ${file.name}`
    }).join('\n')

    return {
      success: true,
      output,
      command: `ls ${directory}`,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleCreateFileOrDir(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const name = match[1]
    const fullPath = path.resolve(cwd, name)
    
    try {
      // Check if it has an extension (likely a file)
      if (path.extname(name)) {
        await fs.writeFile(fullPath, '')
        return {
          success: true,
          output: `Created file: ${name}`,
          command: `touch ${name}`,
          executionTime: 0,
          cost: 0
        }
      } else {
        await fs.mkdir(fullPath, { recursive: true })
        return {
          success: true,
          output: `Created directory: ${name}`,
          command: `mkdir ${name}`,
          executionTime: 0,
          cost: 0
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to create ${name}: ${error.message}`)
    }
  }

  private async handleDeleteFile(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const name = match[1]
    const fullPath = path.resolve(cwd, name)
    
    try {
      const stats = await fs.stat(fullPath)
      if (stats.isDirectory()) {
        await fs.rm(fullPath, { recursive: true })
        return {
          success: true,
          output: `Deleted directory: ${name}`,
          command: `rm -rf ${name}`,
          executionTime: 0,
          cost: 0
        }
      } else {
        await fs.unlink(fullPath)
        return {
          success: true,
          output: `Deleted file: ${name}`,
          command: `rm ${name}`,
          executionTime: 0,
          cost: 0
        }
      }
    } catch (error: any) {
      throw new Error(`Failed to delete ${name}: ${error.message}`)
    }
  }

  // System utility handlers
  private async handleKillPort(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const port = match[1]
    try {
      const result = execSync(`lsof -ti:${port} | xargs kill -9`, { 
        cwd, 
        encoding: 'utf-8',
        stdio: 'pipe'
      })
      return {
        success: true,
        output: `Killed process on port ${port}`,
        command: `kill port ${port}`,
        executionTime: 0,
        cost: 0
      }
    } catch (error) {
      return {
        success: true,
        output: `No process found running on port ${port}`,
        command: `kill port ${port}`,
        executionTime: 0,
        cost: 0
      }
    }
  }

  private async handleCheckPort(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const port = match[1]
    try {
      const result = execSync(`lsof -i:${port}`, { cwd, encoding: 'utf-8' })
      return {
        success: true,
        output: result,
        command: `lsof -i:${port}`,
        executionTime: 0,
        cost: 0
      }
    } catch (error) {
      return {
        success: true,
        output: `No process running on port ${port}`,
        command: `lsof -i:${port}`,
        executionTime: 0,
        cost: 0
      }
    }
  }

  private async handleDiskUsage(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const directory = match[1] || '.'
    const result = execSync(`du -sh ${directory}`, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: `du -sh ${directory}`,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleFindFiles(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const pattern = match[1]
    const directory = match[2] || '.'
    const result = execSync(`find ${directory} -name "${pattern}"`, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result || 'No files found matching pattern',
      command: `find ${directory} -name "${pattern}"`,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleCurrentDirectory(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    return {
      success: true,
      output: cwd,
      command: 'pwd',
      executionTime: 0,
      cost: 0
    }
  }

  private async handleDockerCommand(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const fullMatch = match[0]
    const result = execSync(fullMatch, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: fullMatch,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleShowEnv(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const envVars = Object.entries(process.env)
      .filter(([key]) => !key.includes('PASSWORD') && !key.includes('SECRET') && !key.includes('TOKEN'))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n')

    return {
      success: true,
      output: envVars,
      command: 'env',
      executionTime: 0,
      cost: 0
    }
  }

  private async handleNodeVersion(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const result = execSync('node --version', { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result.trim(),
      command: 'node --version',
      executionTime: 0,
      cost: 0
    }
  }

  private async handleNpmVersion(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const result = execSync('npm --version', { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result.trim(),
      command: 'npm --version',
      executionTime: 0,
      cost: 0
    }
  }

  // Build system handlers
  private async handleMake(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const target = match[1] || ''
    const command = target ? `make ${target}` : 'make'
    const result = execSync(command, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleGoTasks(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const task = match[1] || ''
    const command = task ? `task ${task}` : 'task'
    const result = execSync(command, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleNpx(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const packageName = match[1]
    const args = match[2] || ''
    const command = args ? `npx ${packageName} ${args}` : `npx ${packageName}`
    const result = execSync(command, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command,
      executionTime: 0,
      cost: 0
    }
  }

  // CLI tool handlers
  private async handleGitHubCLI(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const subcommand = match[1]
    const args = match[2] || ''
    const command = args ? `gh ${subcommand} ${args}` : `gh ${subcommand}`
    const result = execSync(command, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleAWSCLI(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const service = match[1]
    const action = match[2] 
    const args = match[3] || ''
    const command = args ? `aws ${service} ${action} ${args}` : `aws ${service} ${action}`
    const result = execSync(command, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command,
      executionTime: 0,
      cost: 0
    }
  }

  // Bash command handlers
  private async handleFileView(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const fullMatch = match[0]
    const result = execSync(fullMatch, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: fullMatch,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleGrep(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const fullMatch = match[0]
    try {
      const result = execSync(fullMatch, { cwd, encoding: 'utf-8' })
      return {
        success: true,
        output: result || 'No matches found',
        command: fullMatch,
        executionTime: 0,
        cost: 0
      }
    } catch (error) {
      return {
        success: true,
        output: 'No matches found',
        command: fullMatch,
        executionTime: 0,
        cost: 0
      }
    }
  }

  private async handleProcessCommands(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const fullMatch = match[0]
    const result = execSync(fullMatch, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: fullMatch,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleFileCopy(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const fullMatch = match[0]
    const result = execSync(fullMatch, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result || 'Operation completed successfully',
      command: fullMatch,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleFilePermissions(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const fullMatch = match[0]
    const result = execSync(fullMatch, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result || 'Permissions changed successfully',
      command: fullMatch,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleDownload(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const fullMatch = match[0]
    const result = execSync(fullMatch, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: fullMatch,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleArchive(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const fullMatch = match[0]
    const result = execSync(fullMatch, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result || 'Archive operation completed',
      command: fullMatch,
      executionTime: 0,
      cost: 0
    }
  }

  private async handleShellInfo(match: RegExpMatchArray, cwd: string): Promise<CommandResult> {
    const fullMatch = match[0]
    const result = execSync(fullMatch, { cwd, encoding: 'utf-8' })
    return {
      success: true,
      output: result,
      command: fullMatch,
      executionTime: 0,
      cost: 0
    }
  }
}