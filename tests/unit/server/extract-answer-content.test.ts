/**
 * Tests for extractAnswerContent — the server-side LLM response cleaner.
 *
 * This function strips chain-of-thought reasoning from local LLM responses
 * and extracts only the actionable answer (commands, code blocks, short text).
 */

// Replicate the function under test so we can test it in isolation
function extractAnswerContent(rawContent: string): string {
  if (!rawContent) return rawContent

  // 1. Try extracting from <answer> tags
  const answerMatch = rawContent.match(/<answer>([\s\S]*?)<\/answer>/i)
  if (answerMatch) {
    return answerMatch[1].trim()
  }

  // 2. Strip <think> tags
  let content = rawContent.replace(/<think>[\s\S]*?<\/think>\s*/g, '')

  // 3. If there are code blocks, extract only the code blocks — drop all surrounding text
  const codeBlocks = [...content.matchAll(/```[\s\S]*?```/g)]
  if (codeBlocks.length > 0) {
    return codeBlocks.map(m => m[0]).join('\n\n').trim()
  }

  // 4. No triple-backtick code blocks — look for inline backtick commands
  const inlineCommands = [...content.matchAll(/`([^`]+)`/g)].map(m => m[1].trim())
  const shellCommands = inlineCommands.filter(cmd =>
    /^(npm |npx |yarn |pnpm |git |cd |python |python3 |pytest |make |docker |cargo |go test|curl |sh |bash )/i.test(cmd)
  )
  const uniqueCommands = [...new Set(shellCommands)]
  const compoundCommands = uniqueCommands.filter(cmd => cmd.includes('&&') || cmd.includes('|'))
  const bestCommands = compoundCommands.length > 0
    ? compoundCommands.slice(0, 1)
    : uniqueCommands.sort((a, b) => b.length - a.length).slice(0, 1)
  if (bestCommands.length > 0) {
    return '```bash\n' + bestCommands.join('\n') + '\n```'
  }

  // 5. Strip all numbered/bulleted analysis lines and keep whatever's left
  const lines = content.split('\n')
  const cleanLines = lines.filter(line => {
    const trimmed = line.trim()
    if (/^\d+\.\s+\*\*/.test(trimmed)) return false
    if (/^\*\s+\*\*/.test(trimmed)) return false
    if (/^(Thinking|Analysis|Reasoning|Let me|I'll|Here's|My thought|Looking at|Wait|Actually|However|Given|Since)/i.test(trimmed)) return false
    if (trimmed.startsWith('*   ') && trimmed.includes('**')) return false
    return true
  })
  const cleaned = cleanLines.join('\n').trim()
  if (cleaned.length > 5) return cleaned

  // 6. Last resort: return the raw content
  return content.trim()
}


describe('extractAnswerContent', () => {

  // =========================================================================
  // 1. <answer> tag extraction
  // =========================================================================
  describe('answer tag extraction', () => {
    test('should extract content from <answer> tags', () => {
      const input = `Thinking about this...
<answer>
\`\`\`bash
npm test
\`\`\`
</answer>`
      const result = extractAnswerContent(input)
      expect(result).toBe('```bash\nnpm test\n```')
    })

    test('should extract content from <answer> tags even with lots of thinking before', () => {
      const input = `1. **Analyze:** The user wants tests.
2. **Check:** It's a Node project.
3. **Decide:** Use npm test.

<answer>
npm test
</answer>

Some trailing text`
      const result = extractAnswerContent(input)
      expect(result).toBe('npm test')
    })
  })

  // =========================================================================
  // 2. <think> tag stripping
  // =========================================================================
  describe('think tag stripping', () => {
    test('should strip <think> tags and return remaining content', () => {
      const input = `<think>Let me reason about this...</think>

\`\`\`bash
npm test
\`\`\``
      const result = extractAnswerContent(input)
      expect(result).toBe('```bash\nnpm test\n```')
    })
  })

  // =========================================================================
  // 3. Code block extraction
  // =========================================================================
  describe('code block extraction', () => {
    test('should extract single code block and drop surrounding text', () => {
      const input = `Here's what you need to do:

\`\`\`bash
git commit -m "feat: add feature" && git push
\`\`\`

This will commit and push your changes.`
      const result = extractAnswerContent(input)
      expect(result).toBe('```bash\ngit commit -m "feat: add feature" && git push\n```')
    })

    test('should extract multiple code blocks', () => {
      const input = `First create the file:

\`\`\`bash
touch newfile.ts
\`\`\`

Then run:

\`\`\`bash
npm test
\`\`\``
      const result = extractAnswerContent(input)
      expect(result).toContain('touch newfile.ts')
      expect(result).toContain('npm test')
    })

    test('should handle indented code blocks', () => {
      const input = `Some thinking text...

    \`\`\`bash
    git add . && git commit -m "fix: resolve bug" && git push
    \`\`\``
      const result = extractAnswerContent(input)
      expect(result).toContain('git add')
      expect(result).toContain('git push')
    })

    test('should preserve code block content exactly including commit messages', () => {
      const input = `Blah blah analysis...

\`\`\`bash
git add .
git commit -m "feat: add CodeGraph project switching support"
git push origin main
\`\`\`

Wait, I should also check...`
      const result = extractAnswerContent(input)
      expect(result).toContain('git commit -m "feat: add CodeGraph project switching support"')
      expect(result).toContain('git push origin main')
      expect(result).not.toContain('Wait')
      expect(result).not.toContain('Blah')
    })

    test('should NOT include thinking text after code blocks', () => {
      const input = `\`\`\`bash
npm test
\`\`\`
*   Wait, I need to check the branch.
*   What about the "Not a git repository" context?`
      const result = extractAnswerContent(input)
      expect(result).toBe('```bash\nnpm test\n```')
      expect(result).not.toContain('Wait')
    })
  })

  // =========================================================================
  // 4. Inline command extraction (no code blocks)
  // =========================================================================
  describe('inline command extraction', () => {
    test('should extract inline commands when no code blocks exist', () => {
      const input = `The command you need is \`npm test\` to run the test suite.`
      const result = extractAnswerContent(input)
      expect(result).toContain('npm test')
      expect(result).toContain('```')
    })

    test('should prefer compound commands over simple ones', () => {
      const input = `You could use \`git commit\` or \`git commit -m "update" && git push\` to do both.`
      const result = extractAnswerContent(input)
      expect(result).toContain('git commit -m "update" && git push')
      expect(result).not.toMatch(/^```bash\ngit commit\n```$/)
    })

    test('should pick the longest command when no compound commands exist', () => {
      const input = `Use \`npm test\` or \`cd /path/to/project && npm test\` for the full path.`
      // cd starts with "cd " which is in the filter
      const result = extractAnswerContent(input)
      expect(result).toContain('cd /path/to/project && npm test')
    })

    test('should deduplicate commands', () => {
      const input = `Try \`npm test\`, or if that fails, \`npm test\` again. Also \`npm test\`.`
      const result = extractAnswerContent(input)
      // Should appear only once in the output
      const matches = result.match(/npm test/g)
      expect(matches).toHaveLength(1)
    })

    test('should not extract non-command inline code', () => {
      const input = `The variable \`Cargo.toml\` and \`package.json\` are config files. Use \`npm test\`.`
      const result = extractAnswerContent(input)
      expect(result).toContain('npm test')
      expect(result).not.toContain('Cargo.toml')
      expect(result).not.toContain('package.json')
    })
  })

  // =========================================================================
  // 5. Thinking text stripping (no code at all)
  // =========================================================================
  describe('thinking text stripping', () => {
    test('should strip numbered analysis lines', () => {
      const input = `1.  **Analyze:** The user wants to run tests.
2.  **Check:** Node.js project.
3.  **Decision:** npm test.

npm test`
      const result = extractAnswerContent(input)
      expect(result).toBe('npm test')
      expect(result).not.toContain('Analyze')
    })

    test('should strip lines starting with thinking keywords', () => {
      const input = `Thinking about what command to use...
Let me check the project type.
Actually, it's a Node project.

npm test`
      const result = extractAnswerContent(input)
      expect(result).toBe('npm test')
    })

    test('should strip bullet analysis', () => {
      const input = `*   **Option 1:** pytest
*   **Option 2:** npm test

npm test`
      const result = extractAnswerContent(input)
      expect(result).toBe('npm test')
    })
  })

  // =========================================================================
  // 6. Real-world model outputs (regression tests)
  // =========================================================================
  describe('real-world model outputs', () => {
    test('should clean "run the tests" response with heavy thinking', () => {
      const input = `Thinking Process:

1.  **Analyze the Request:** The user wants to run the tests for the project.
2.  **Identify the Project Context:**
    *   Project Name: lllm-charge
    *   Location: /Users/jacob.brandt/workspace/lllm-charge
    *   Task: Run tests.
3.  **Determine the Best Command:**
    *   For JavaScript projects, \`npm test\` is standard.
    *   Could also be \`yarn test\` or \`pnpm test\`.
4.  **Final Decision:**
    *   Command: \`cd /Users/jacob.brandt/workspace/lllm-charge && npm test\`
    *   Wait, let me reconsider...`
      const result = extractAnswerContent(input)
      expect(result).toContain('npm test')
      expect(result).not.toContain('Thinking Process')
      expect(result).not.toContain('Analyze the Request')
    })

    test('should clean "commit and push" response with numbered analysis', () => {
      const input = `1.  **Analyze the Request:** The user wants to commit and push.
2.  **Identify Constraints:** No explanation needed.
3.  **Determine the Command:** Since it's a git project:
    *   Command: \`git commit -m "update" && git push\`
    *   Wait, should I use main or master?

Actually, the standard approach is:

\`\`\`bash
git add . && git commit -m "update: apply changes" && git push
\`\`\`

This handles everything in one line.`
      const result = extractAnswerContent(input)
      expect(result).toBe('```bash\ngit add . && git commit -m "update: apply changes" && git push\n```')
    })

    test('should handle response that is just a command with no wrapper', () => {
      const input = `npm test`
      const result = extractAnswerContent(input)
      expect(result).toBe('npm test')
    })

    test('should handle empty response', () => {
      const result = extractAnswerContent('')
      expect(result).toBe('')
    })

    test('should handle response with only thinking and no answer', () => {
      const input = `1.  **Analyze:** Complex question.
2.  **Consider:** Multiple approaches.
3.  **Wait:** I need more context.
Actually, I'm not sure what to do here.
However, this seems complicated.
Let me think more about this.`
      const result = extractAnswerContent(input)
      // Should return something rather than empty
      expect(result.length).toBeGreaterThan(0)
    })
  })
})
