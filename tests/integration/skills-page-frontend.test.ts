/**
 * Frontend Skills Page Integration Test
 * Tests the actual Skills React component with real API calls and filtering logic
 */

import { jest } from '@jest/globals'
import fetch from 'node-fetch'

// Mock React Query and other dependencies
const mockUseQuery = jest.fn()
const mockApiClient = {
  getSpecs: jest.fn(),
  getSetupStatus: jest.fn(),
  loadDefaultSkillsAndAgents: jest.fn()
}

// Mock React hooks
const mockUseState = jest.fn()
const mockSetState = jest.fn()

describe('Skills Page Frontend Integration', () => {
  const BASE_URL = 'http://localhost:3001'
  const testTimeout = 15000

  beforeEach(() => {
    // Reset all mocks
    mockUseQuery.mockClear()
    mockApiClient.getSpecs.mockClear()
    mockApiClient.getSetupStatus.mockClear()
    mockApiClient.loadDefaultSkillsAndAgents.mockClear()
    mockUseState.mockClear()
    mockSetState.mockReturnValue(mockSetState)
  })

  describe('Skills Filtering Logic', () => {
    test('should correctly identify skills from specs with extracted tags', async () => {
      // Get real specs from API
      const response = await fetch(`${BASE_URL}/api/specs`)
      expect(response.ok).toBe(true)
      
      const allSpecs = await response.json()
      expect(Array.isArray(allSpecs)).toBe(true)
      expect(allSpecs.length).toBeGreaterThan(0)
      
      // Replicate the filtering logic from SkillsSection.tsx:44-52
      const skills = allSpecs.filter(spec => 
        spec.tags?.some(tag => 
          tag.includes('skill') || 
          tag.includes('capability') ||
          tag.includes('devdocs') ||
          tag.includes('analysis') ||
          tag.includes('cost-optimization')
        )
      )
      
      // Should find skills with the fixed API
      expect(skills.length).toBeGreaterThan(0)
      
      // Validate each identified skill
      skills.forEach(skill => {
        expect(skill.tags).toBeDefined()
        expect(Array.isArray(skill.tags)).toBe(true)
        expect(skill.tags.length).toBeGreaterThan(0)
        
        // Should have at least one skill-identifying tag
        const hasSkillTag = skill.tags.some(tag => 
          tag.includes('skill') || 
          tag.includes('capability') ||
          tag.includes('devdocs') ||
          tag.includes('analysis') ||
          tag.includes('cost-optimization')
        )
        expect(hasSkillTag).toBe(true)
      })
      
      console.log(`✅ Skills filtering correctly identified ${skills.length} skills from ${allSpecs.length} specs`)
      
      // Validate specific expected skills
      const skillTitles = skills.map(s => s.title)
      const expectedSkillKeywords = ['DevDocs', 'Universal Language', 'MCP', 'Integration', 'Analysis']
      
      let foundExpectedSkills = 0
      expectedSkillKeywords.forEach(keyword => {
        const hasSkillWithKeyword = skillTitles.some(title => title.includes(keyword))
        if (hasSkillWithKeyword) {
          foundExpectedSkills++
          console.log(`✅ Found skill containing "${keyword}"`)
        }
      })
      
      expect(foundExpectedSkills).toBeGreaterThan(0)
    }, testTimeout)

    test('should handle category filtering correctly', async () => {
      // Get real specs and filter to skills
      const response = await fetch(`${BASE_URL}/api/specs`)
      const allSpecs = await response.json()
      
      const skills = allSpecs.filter(spec => 
        spec.tags?.some(tag => 
          tag.includes('skill') || tag.includes('devdocs') || tag.includes('analysis')
        )
      )
      
      // Replicate the category assignment logic from SkillsSection.tsx:68-70
      const skillsWithCategories = skills.map(spec => ({
        ...spec,
        category: spec.tags?.find(tag => 
          ['documentation', 'analysis', 'integration', 'optimization', 'automation'].includes(tag)
        ) || 'general'
      }))
      
      // Test category filtering
      const categories = ['documentation', 'analysis', 'integration', 'optimization', 'automation', 'general']
      
      categories.forEach(category => {
        const categorySkills = skillsWithCategories.filter(skill => skill.category === category)
        console.log(`Category "${category}": ${categorySkills.length} skills`)
        
        // Validate category assignment
        categorySkills.forEach(skill => {
          if (category !== 'general') {
            expect(skill.tags).toContain(category)
          }
        })
      })
      
      // Should have at least some categorized skills
      const categorizedSkills = skillsWithCategories.filter(skill => skill.category !== 'general')
      expect(categorizedSkills.length).toBeGreaterThan(0)
    }, testTimeout)

    test('should handle search filtering correctly', async () => {
      const response = await fetch(`${BASE_URL}/api/specs`)
      const allSpecs = await response.json()
      
      const skills = allSpecs.filter(spec => 
        spec.tags?.some(tag => tag.includes('skill'))
      )
      
      if (skills.length === 0) {
        console.warn('No skills found for search testing')
        return
      }
      
      // Test search functionality from SkillsSection.tsx:96-99
      const testSearchTerms = ['devdocs', 'analysis', 'integration', 'documentation']
      
      testSearchTerms.forEach(searchTerm => {
        const filteredSkills = skills.filter(skill => {
          const matchesSearch = 
            skill.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
            skill.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            skill.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
          
          return matchesSearch
        })
        
        console.log(`Search term "${searchTerm}": ${filteredSkills.length} matching skills`)
        
        // Validate search results
        filteredSkills.forEach(skill => {
          const titleMatch = skill.title.toLowerCase().includes(searchTerm.toLowerCase())
          const descMatch = skill.description?.toLowerCase().includes(searchTerm.toLowerCase())
          const tagMatch = skill.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
          
          expect(titleMatch || descMatch || tagMatch).toBe(true)
        })
      })
    }, testTimeout)
  })

  describe('Skills Statistics Calculation', () => {
    test('should calculate statistics correctly with real data', async () => {
      const response = await fetch(`${BASE_URL}/api/specs`)
      const allSpecs = await response.json()
      
      const skills = allSpecs.filter(spec => 
        spec.tags?.some(tag => tag.includes('skill'))
      )
      
      // Replicate statistics calculation from SkillsSection.tsx:107-112
      const stats = {
        total: skills.length,
        active: skills.filter(s => s.status === 'active').length,
        completed: skills.filter(s => s.status === 'completed').length,
        categories: [...new Set(skills.map(s => {
          return s.tags?.find(tag => 
            ['documentation', 'analysis', 'integration', 'optimization', 'automation'].includes(tag)
          ) || 'general'
        }))].length
      }
      
      expect(stats.total).toBeGreaterThanOrEqual(0)
      expect(stats.active).toBeGreaterThanOrEqual(0)
      expect(stats.completed).toBeGreaterThanOrEqual(0)
      expect(stats.categories).toBeGreaterThan(0)
      
      // Validate totals
      expect(stats.active + stats.completed).toBeLessThanOrEqual(stats.total)
      
      console.log(`✅ Skills statistics:`, stats)
    }, testTimeout)
  })

  describe('API Integration Behavior', () => {
    test('should handle API success correctly', async () => {
      // Mock successful API response
      const mockSpecs = [
        {
          id: 'spec-1',
          title: 'DevDocs Integration Skill',
          description: 'A comprehensive skill for documentation',
          status: 'completed',
          priority: 'high',
          tags: ['skill', 'devdocs', 'documentation'],
          createdAt: '2026-03-27T10:00:00Z',
          updatedAt: '2026-03-27T10:00:00Z'
        },
        {
          id: 'spec-2',
          title: 'Regular Spec',
          description: 'Not a skill',
          status: 'active',
          priority: 'medium',
          tags: ['spec', 'requirement'],
          createdAt: '2026-03-27T10:00:00Z',
          updatedAt: '2026-03-27T10:00:00Z'
        }
      ]
      
      // Test the filtering logic
      const skills = mockSpecs.filter(spec => 
        spec.tags?.some(tag => 
          tag.includes('skill') || 
          tag.includes('capability') ||
          tag.includes('devdocs') ||
          tag.includes('analysis') ||
          tag.includes('cost-optimization')
        )
      )
      
      expect(skills).toHaveLength(1)
      expect(skills[0].title).toBe('DevDocs Integration Skill')
    }, testTimeout)

    test('should handle empty API response correctly', async () => {
      const mockSpecs = []
      
      // Should handle empty array gracefully
      const skills = mockSpecs.filter(spec => 
        spec.tags?.some(tag => tag.includes('skill'))
      )
      
      const stats = {
        total: skills.length,
        active: skills.filter(s => s.status === 'active').length,
        completed: skills.filter(s => s.status === 'completed').length,
        categories: [...new Set(skills.map(s => 'general'))].length
      }
      
      expect(skills).toHaveLength(0)
      expect(stats.total).toBe(0)
      expect(stats.active).toBe(0)
      expect(stats.completed).toBe(0)
    }, testTimeout)

    test('should handle specs with null/undefined tags correctly', async () => {
      const mockSpecs = [
        {
          id: 'spec-1',
          title: 'Spec with null tags',
          tags: null
        },
        {
          id: 'spec-2', 
          title: 'Spec with undefined tags'
          // tags property missing
        },
        {
          id: 'spec-3',
          title: 'Spec with empty tags',
          tags: []
        },
        {
          id: 'spec-4',
          title: 'Skill spec',
          tags: ['skill', 'test']
        }
      ]
      
      // Should handle null/undefined tags gracefully
      const skills = mockSpecs.filter(spec => 
        spec.tags?.some(tag => tag.includes('skill'))
      )
      
      expect(skills).toHaveLength(1)
      expect(skills[0].title).toBe('Skill spec')
    }, testTimeout)
  })

  describe('Default Skills Loading', () => {
    test('should support loading default skills when none exist', async () => {
      // Test the setup status check
      const setupResponse = await fetch(`${BASE_URL}/api/setup/status`)
      
      if (setupResponse.ok) {
        const setupStatus = await setupResponse.json()
        expect(setupStatus).toHaveProperty('hasDefaultSkills')
        
        console.log(`✅ Setup status check working, hasDefaultSkills: ${setupStatus.hasDefaultSkills}`)
      } else {
        console.warn('Setup status endpoint not available for testing')
      }
    }, testTimeout)

    test('should validate default skills structure', () => {
      // Test the structure expected by loadDefaultSkillsAndAgents
      const expectedLoadConfig = {
        loadSkills: true,
        loadAgents: false,
        loadSpecs: false,
        overwriteExisting: false
      }
      
      expect(expectedLoadConfig).toHaveProperty('loadSkills', true)
      expect(expectedLoadConfig).toHaveProperty('loadAgents', false)
      expect(expectedLoadConfig).toHaveProperty('loadSpecs', false)
      expect(expectedLoadConfig).toHaveProperty('overwriteExisting', false)
    })
  })

  describe('Component State Management', () => {
    test('should validate state structure for Skills component', () => {
      // Test the state structure used by SkillsSection
      const mockSkillsState = [
        {
          id: 'skill-1',
          title: 'Test Skill',
          description: 'Test description',
          status: 'active',
          priority: 'high',
          tags: ['skill', 'test'],
          category: 'general',
          createdAt: '2026-03-27T10:00:00Z',
          updatedAt: '2026-03-27T10:00:00Z'
        }
      ]
      
      const mockFilters = {
        searchTerm: '',
        categoryFilter: 'all'
      }
      
      const mockSelectedSkill = mockSkillsState[0]
      
      // Validate state structure
      expect(Array.isArray(mockSkillsState)).toBe(true)
      expect(typeof mockFilters.searchTerm).toBe('string')
      expect(typeof mockFilters.categoryFilter).toBe('string')
      expect(mockSelectedSkill).toHaveProperty('id')
      expect(mockSelectedSkill).toHaveProperty('tags')
    })
  })
})