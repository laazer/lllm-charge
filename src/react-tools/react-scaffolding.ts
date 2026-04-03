// React Component Scaffolding Tool
// FEATURE: Automated React component generation with TypeScript, tests, and styling

import * as fs from 'fs/promises'
import * as path from 'path'
import { existsSync } from 'fs'

export interface ReactComponentOptions {
  componentName: string
  componentType: 'functional' | 'page' | 'layout' | 'ui'
  includeTests: boolean
  includeStorybook: boolean
  propsInterface?: Record<string, any>
  outputPath?: string
}

export interface ReactComponentScaffoldResult {
  success: boolean
  componentPath: string
  testPath?: string
  storybookPath?: string
  files: string[]
  errors?: string[]
}

export class ReactComponentScaffolder {
  private projectRoot: string
  private reactRoot: string

  constructor(projectPath: string) {
    this.projectRoot = projectPath
    this.reactRoot = path.join(projectPath, 'src', 'react')
  }

  async scaffoldComponent(options: ReactComponentOptions): Promise<ReactComponentScaffoldResult> {
    const errors: string[] = []
    const files: string[] = []

    try {
      // Validate component name
      if (!this.isValidComponentName(options.componentName)) {
        throw new Error(`Invalid component name: ${options.componentName}. Must be PascalCase.`)
      }

      // Determine output paths
      const paths = this.getComponentPaths(options)

      // Check if component already exists
      if (existsSync(paths.componentPath)) {
        throw new Error(`Component already exists at: ${paths.componentPath}`)
      }

      // Ensure directories exist
      await this.ensureDirectories(paths)

      // Generate component file
      const componentContent = this.generateComponentContent(options)
      await fs.writeFile(paths.componentPath, componentContent, 'utf8')
      files.push(paths.componentPath)

      // Generate test file
      if (options.includeTests) {
        const testContent = this.generateTestContent(options)
        await fs.writeFile(paths.testPath!, testContent, 'utf8')
        files.push(paths.testPath!)
      }

      // Generate Storybook file
      if (options.includeStorybook && options.componentType === 'ui') {
        const storybookContent = this.generateStorybookContent(options)
        await fs.writeFile(paths.storybookPath!, storybookContent, 'utf8')
        files.push(paths.storybookPath!)
      }

      return {
        success: true,
        componentPath: paths.componentPath,
        testPath: paths.testPath,
        storybookPath: paths.storybookPath,
        files,
        errors: errors.length > 0 ? errors : undefined
      }

    } catch (error) {
      return {
        success: false,
        componentPath: '',
        files,
        errors: [error instanceof Error ? error.message : String(error)]
      }
    }
  }

  private isValidComponentName(name: string): boolean {
    // PascalCase validation
    return /^[A-Z][a-zA-Z0-9]*$/.test(name)
  }

  private getComponentPaths(options: ReactComponentOptions) {
    const { componentName, componentType, outputPath } = options

    let basePath: string
    if (outputPath) {
      basePath = path.join(this.reactRoot, outputPath)
    } else {
      switch (componentType) {
        case 'page':
          basePath = path.join(this.reactRoot, 'pages')
          break
        case 'layout':
          basePath = path.join(this.reactRoot, 'components', 'layout')
          break
        case 'ui':
          basePath = path.join(this.reactRoot, 'components', 'ui')
          break
        default:
          basePath = path.join(this.reactRoot, 'components')
      }
    }

    const componentPath = path.join(basePath, `${componentName}.tsx`)
    const testPath = options.includeTests 
      ? path.join(this.projectRoot, 'tests', 'unit', 'react', `${componentName.toLowerCase()}.test.tsx`)
      : undefined
    const storybookPath = options.includeStorybook && options.componentType === 'ui'
      ? path.join(basePath, `${componentName}.stories.tsx`)
      : undefined

    return { componentPath, testPath, storybookPath, basePath }
  }

  private async ensureDirectories(paths: any) {
    await fs.mkdir(path.dirname(paths.componentPath), { recursive: true })
    if (paths.testPath) {
      await fs.mkdir(path.dirname(paths.testPath), { recursive: true })
    }
    if (paths.storybookPath) {
      await fs.mkdir(path.dirname(paths.storybookPath), { recursive: true })
    }
  }

  private generateComponentContent(options: ReactComponentOptions): string {
    const { componentName, componentType, propsInterface } = options

    // Generate props interface if provided
    const propsInterfaceCode = propsInterface 
      ? this.generatePropsInterface(componentName, propsInterface)
      : `interface ${componentName}Props {
  className?: string
}`

    // Generate imports based on component type
    const imports = this.generateImports(componentType)

    // Generate component body based on type
    const componentBody = this.generateComponentBody(componentName, componentType)

    return `${imports}

${propsInterfaceCode}

export function ${componentName}({
  className = ''
}: ${componentName}Props) {
${componentBody}
}
`
  }

  private generateImports(componentType: string): string {
    let imports = `import React from 'react'`

    switch (componentType) {
      case 'page':
        imports += `\nimport { Helmet } from 'react-helmet-async'`
        break
      case 'ui':
        imports += `\nimport { cn } from '@/lib/utils'`
        break
    }

    return imports
  }

  private generatePropsInterface(componentName: string, propsInterface: Record<string, any>): string {
    const props = Object.entries(propsInterface)
      .map(([key, type]) => `  ${key}: ${typeof type === 'string' ? type : 'any'}`)
      .join('\n')

    return `interface ${componentName}Props {
${props}
  className?: string
}`
  }

  private generateComponentBody(componentName: string, componentType: string): string {
    switch (componentType) {
      case 'page':
        return `  return (
    <>
      <Helmet>
        <title>${componentName}</title>
      </Helmet>
      <div className={cn('container mx-auto py-6', className)}>
        <h1 className="text-2xl font-bold mb-6">${componentName}</h1>
        <div className="space-y-4">
          {/* TODO: Implement ${componentName} content */}
        </div>
      </div>
    </>
  )`

      case 'layout':
        return `  return (
    <div className={cn('min-h-screen bg-gray-50 dark:bg-gray-900', className)}>
      {/* TODO: Implement ${componentName} layout */}
      <div className="container mx-auto">
        {/* Layout content goes here */}
      </div>
    </div>
  )`

      case 'ui':
        return `  return (
    <div className={cn('', className)}>
      {/* TODO: Implement ${componentName} UI component */}
    </div>
  )`

      default:
        return `  return (
    <div className={className}>
      {/* TODO: Implement ${componentName} component */}
    </div>
  )`
    }
  }

  private generateTestContent(options: ReactComponentOptions): string {
    const { componentName, componentType } = options

    // Determine import path based on component type
    let importPath: string
    switch (componentType) {
      case 'page':
        importPath = `../../../src/react/pages/${componentName}`
        break
      case 'layout':
        importPath = `../../../src/react/components/layout/${componentName}`
        break
      case 'ui':
        importPath = `../../../src/react/components/ui/${componentName}`
        break
      default:
        importPath = `../../../src/react/components/${componentName}`
    }

    return `import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { ${componentName} } from '${importPath}'

describe('${componentName}', () => {
  test('renders without crashing', () => {
    render(<${componentName} />)
    expect(screen.getByRole('main') || document.body).toBeInTheDocument()
  })

  test('accepts custom className', () => {
    const { container } = render(<${componentName} className="custom-class" />)
    const element = container.firstChild as HTMLElement
    expect(element).toHaveClass('custom-class')
  })

  ${componentType === 'ui' ? this.generateUITestCases(componentName) : ''}
  ${componentType === 'page' ? this.generatePageTestCases(componentName) : ''}

  // TODO: Add more specific tests for ${componentName} functionality
})
`
  }

  private generateUITestCases(componentName: string): string {
    return `
  test('has proper accessibility attributes', () => {
    render(<${componentName} />)
    // TODO: Add accessibility-specific assertions
  })

  test('handles user interactions correctly', () => {
    const onClickMock = jest.fn()
    // TODO: Add interaction tests if component has user interactions
  })`
  }

  private generatePageTestCases(componentName: string): string {
    return `
  test('sets correct page title', () => {
    render(<${componentName} />)
    // TODO: Verify Helmet title is set correctly
  })

  test('displays main content areas', () => {
    render(<${componentName} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('${componentName}')
  })`
  }

  private generateStorybookContent(options: ReactComponentOptions): string {
    const { componentName } = options

    return `import type { Meta, StoryObj } from '@storybook/react'
import { ${componentName} } from './${componentName}'

const meta: Meta<typeof ${componentName}> = {
  title: 'UI/${componentName}',
  component: ${componentName},
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    className: {
      control: 'text',
      description: 'Additional CSS classes'
    }
  },
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {},
}

export const WithCustomClass: Story = {
  args: {
    className: 'border border-gray-200 p-4 rounded-lg',
  },
}

// TODO: Add more story variations for ${componentName}
`
  }
}