/**
 * Backend API Integration Test for Specs Endpoint
 * Tests the actual database manager and API behavior with JSON data extraction
 */

import { jest } from '@jest/globals'

// Use global fetch or mock it
const fetch = global.fetch || require('node-fetch')

// Type definitions for test data
interface SpecData {
  id: string
  title: string
  description: string
  status: string
  priority: string
  tags: string[]
  linkedClasses?: string[]
  linkedMethods?: string[]
  linkedTests?: string[]
  comments?: any[]
  assignedAgent?: string | null
  data: any
  createdAt: string
  updatedAt: string
  projectId?: string
}

describe('Specs API Backend Integration', () => {
  const BASE_URL = 'http://localhost:3001'
  const testTimeout = 15000

  // Helper to wait for server to be ready
  const waitForServer = async (maxAttempts = 30): Promise<boolean> => {
    for (let i = 0; i < maxAttempts; i++) {
      try {
        const response = await fetch(`${BASE_URL}/api/test`, { 
          method: 'GET'
        })
        if (response.ok) return true
      } catch (error) {
        // Server not ready yet
      }
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    return false
  }

  beforeAll(async () => {
    const serverReady = await waitForServer()
    if (!serverReady) {
      throw new Error(`Server at ${BASE_URL} not responding after 15 seconds`)
    }
  }, 20000)

  describe('Specs API Endpoint', () => {
    test('should return specs with extracted tags from JSON data column', async () => {
      const response = await fetch(`${BASE_URL}/api/specs`)
      
      expect(response.ok).toBe(true)
      expect(response.status).toBe(200)
      
      const specs = await response.json() as SpecData[]
      expect(Array.isArray(specs)).toBe(true)
      
      // Should have specs (from the conversation, we know there are 51+ specs)
      expect(specs.length).toBeGreaterThan(0)
      
      // Validate spec structure
      specs.forEach(spec => {
        expect(spec).toHaveProperty('id')
        expect(spec).toHaveProperty('title')
        expect(spec).toHaveProperty('status')
        expect(spec).toHaveProperty('priority')
        
        // Critical: Tags should be extracted from JSON data to top level
        expect(spec).toHaveProperty('tags')
        expect(Array.isArray(spec.tags)).toBe(true)
        
        // Other extracted properties should also be available
        expect(spec).toHaveProperty('linkedClasses')
        expect(spec).toHaveProperty('linkedMethods') 
        expect(spec).toHaveProperty('linkedTests')
        expect(spec).toHaveProperty('comments')
        expect(spec).toHaveProperty('data')
        
        // Validate types
        expect(typeof spec.id).toBe('string')
        expect(typeof spec.title).toBe('string')
        expect(['active', 'draft', 'completed', 'archived']).toContain(spec.status)
        expect(['low', 'medium', 'high', 'critical']).toContain(spec.priority)
      })
    }, testTimeout)

    test('should identify skills by tags in extracted data', async () => {
      const response = await fetch(`${BASE_URL}/api/specs`)
      const specs = await response.json() as SpecData[]
      
      // Filter specs that should be identified as skills
      const skills = specs.filter(spec => 
        spec.tags?.some(tag => 
          tag.includes('skill') || 
          tag.includes('capability') ||
          tag.includes('devdocs') ||
          tag.includes('analysis') ||
          tag.includes('cost-optimization')
        )
      )
      
      // Should find skills (we know from default-agents-skills.json there are skill specs)
      expect(skills.length).toBeGreaterThan(0)
      
      // Validate skill properties
      skills.forEach(skill => {
        expect(skill.tags).toBeDefined()
        expect(skill.tags.length).toBeGreaterThan(0)
        
        // Should have skill-related tags
        const hasSkillTag = skill.tags.some(tag => 
          tag.includes('skill') || 
          tag.includes('devdocs') || 
          tag.includes('analysis') ||
          tag.includes('cost-optimization')
        )
        expect(hasSkillTag).toBe(true)
      })
      
      console.log(`✅ Found ${skills.length} skills from ${specs.length} total specs`)
    }, testTimeout)

    test('should handle project-scoped specs endpoint', async () => {
      // First get projects to find a valid project ID
      const projectsResponse = await fetch(`${BASE_URL}/api/projects`)
      expect(projectsResponse.ok).toBe(true)
      
      const projects = await projectsResponse.json() as any[]
      expect(Array.isArray(projects)).toBe(true)
      expect(projects.length).toBeGreaterThan(0)
      
      const projectId = projects[0].id
      
      // Now test project-scoped specs
      const specsResponse = await fetch(`${BASE_URL}/api/projects/${projectId}/specs`)
      expect(specsResponse.ok).toBe(true)
      
      const projectSpecs = await specsResponse.json() as SpecData[]
      expect(Array.isArray(projectSpecs)).toBe(true)
      
      // Validate extracted tags for project specs too
      projectSpecs.forEach(spec => {
        expect(spec).toHaveProperty('tags')
        expect(Array.isArray(spec.tags)).toBe(true)
        expect(spec.projectId).toBe(projectId)
      })
      
      console.log(`✅ Project ${projectId} has ${projectSpecs.length} specs with extracted tags`)
    }, testTimeout)

    test('should preserve original JSON data structure', async () => {
      const response = await fetch(`${BASE_URL}/api/specs`)
      const specs = await response.json() as SpecData[]
      
      // Find a spec that should have rich data
      const skillSpecs = specs.filter(spec => 
        spec.tags?.some(tag => tag.includes('skill')) && spec.data
      )
      
      if (skillSpecs.length > 0) {
        const skillSpec = skillSpecs[0]
        
        // Should have original data preserved
        expect(skillSpec.data).toBeDefined()
        expect(typeof skillSpec.data).toBe('object')
        
        // Tags should be in both places (extracted and in data)
        if (skillSpec.data.tags) {
          expect(skillSpec.tags).toEqual(skillSpec.data.tags)
        }
        
        console.log(`✅ Skill spec "${skillSpec.title}" has preserved data structure`)
      }
    }, testTimeout)
  })

  describe('Database Manager JSON Extraction', () => {
    test('should handle specs with null or empty data gracefully', async () => {
      const response = await fetch(`${BASE_URL}/api/specs`)
      const specs = await response.json() as SpecData[]
      
      specs.forEach(spec => {
        // Even if data is null/empty, extracted fields should still be arrays
        expect(Array.isArray(spec.tags)).toBe(true)
        expect(Array.isArray(spec.linkedClasses)).toBe(true)
        expect(Array.isArray(spec.linkedMethods)).toBe(true)
        expect(Array.isArray(spec.linkedTests)).toBe(true)
        expect(Array.isArray(spec.comments)).toBe(true)
      })
    }, testTimeout)

    test('should validate specific skill specs from default data', async () => {
      const response = await fetch(`${BASE_URL}/api/specs`)
      const specs = await response.json() as SpecData[]
      
      // Look for the specific skills we know exist from default-agents-skills.json
      const devdocsSkill = specs.find(spec => 
        spec.title.includes('DevDocs Integration') && 
        spec.tags?.includes('skill')
      )
      
      const universalAnalysisSkill = specs.find(spec => 
        spec.title.includes('Universal Language Analysis') &&
        spec.tags?.includes('skill')
      )
      
      if (devdocsSkill) {
        expect(devdocsSkill.tags).toContain('skill')
        expect(devdocsSkill.tags).toContain('devdocs')
        expect(devdocsSkill.status).toBe('completed')
        console.log(`✅ Found DevDocs skill spec with tags: ${devdocsSkill.tags.join(', ')}`)
      }
      
      if (universalAnalysisSkill) {
        expect(universalAnalysisSkill.tags).toContain('skill')
        expect(universalAnalysisSkill.tags).toContain('analysis')
        expect(universalAnalysisSkill.status).toBe('completed')
        console.log(`✅ Found Universal Analysis skill spec with tags: ${universalAnalysisSkill.tags.join(', ')}`)
      }
      
      // Should find at least some skill specs
      const allSkillSpecs = specs.filter(spec => spec.tags?.includes('skill'))
      expect(allSkillSpecs.length).toBeGreaterThan(0)
      
      console.log(`✅ Total skill specs found: ${allSkillSpecs.length}`)
    }, testTimeout)
  })

  describe('API Error Handling', () => {
    test('should handle invalid project ID gracefully', async () => {
      const response = await fetch(`${BASE_URL}/api/projects/invalid-project-id/specs`)
      
      if (!response.ok) {
        expect([400, 404, 500]).toContain(response.status)
      } else {
        // If it returns OK, it should return an empty array
        const specs = await response.json()
        expect(Array.isArray(specs)).toBe(true)
      }
    }, testTimeout)

    test('should validate database connection and table structure', async () => {
      const response = await fetch(`${BASE_URL}/api/specs`)
      expect(response.ok).toBe(true)
      
      const specs = await response.json() as SpecData[]
      
      // Should have the required database columns
      if (specs.length > 0) {
        const spec = specs[0]
        expect(spec).toHaveProperty('id')
        expect(spec).toHaveProperty('createdAt')
        expect(spec).toHaveProperty('updatedAt')
        
        // Dates should be valid
        expect(new Date(spec.createdAt).getTime()).not.toBeNaN()
        expect(new Date(spec.updatedAt).getTime()).not.toBeNaN()
      }
    }, testTimeout)
  })
})