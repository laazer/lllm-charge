/**
 * Comprehensive endpoint testing script
 * Tests all API endpoints with proper payloads and expected status codes
 */

const BASE_URL = 'http://localhost:7891'

interface TestResult {
  endpoint: string
  method: string
  status: number
  success: boolean
  error?: string
  note?: string
}

const results: TestResult[] = []

async function test(
  endpoint: string,
  method: string,
  body?: any,
  expectedStatus: number = 200
): Promise<TestResult> {
  const url = `${BASE_URL}${endpoint}`
  const options: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json' },
  }

  if (body) {
    options.body = JSON.stringify(body)
  }

  try {
    const response = await fetch(url, options)
    const success = response.status === expectedStatus || response.status === 307
    const note = response.status === 307 ? 'Redirect (trailing slash?)' : undefined

    const result: TestResult = {
      endpoint,
      method,
      status: response.status,
      success: response.status === expectedStatus,
      note,
    }

    results.push(result)
    return result
  } catch (error) {
    const result: TestResult = {
      endpoint,
      method,
      status: 0,
      success: false,
      error: (error as Error).message,
    }
    results.push(result)
    return result
  }
}

async function runTests() {
  console.log('🧪 Testing API Endpoints\n')

  // Memory notes - FIXED: use /memory/notes not /memory/notes/
  console.log('Testing Memory API...')
  await test('/api/memory/notes', 'GET', null, 200)
  await test('/api/memory/notes', 'POST', { title: 'Test', content: 'Note', tags: [] }, 201)

  // Buddies - FIXED: use /buddies not /buddies/
  console.log('Testing Buddies API...')
  await test('/api/buddies', 'GET', null, 200)
  await test('/api/buddies', 'POST', { name: 'Test Buddy', role: 'assistant' }, 201)

  // Agents - FIXED: add required primary_role field
  console.log('Testing Agents API...')
  await test('/api/agents', 'GET', null, 200)
  await test('/api/agents', 'POST',
    {
      name: 'Test Agent',
      description: 'A test agent',
      primary_role: 'architect'
    },
    201
  )

  // DevDocs - FIXED: add required language field
  console.log('Testing DevDocs API...')
  await test('/api/devdocs/languages', 'GET', null, 200)
  await test('/api/devdocs/search', 'POST',
    {
      query: 'javascript',
      language: 'javascript'
    },
    200
  )

  // Projects
  console.log('Testing Projects API...')
  await test('/api/projects', 'GET', null, 200)

  // Health
  console.log('Testing Health API...')
  await test('/health', 'GET', null, 200)

  console.log('\n📊 Test Results Summary\n')
  const passed = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const redirects = results.filter(r => r.note === 'Redirect (trailing slash?)').length

  console.log(`✅ Passed: ${passed}`)
  console.log(`❌ Failed: ${failed}`)
  console.log(`↪️  Redirects: ${redirects}`)

  console.log('\nDetailed Results:\n')
  results.forEach(r => {
    const statusIcon = r.success ? '✅' : '❌'
    console.log(`${statusIcon} ${r.method.padEnd(6)} ${r.endpoint.padEnd(40)} [${r.status}]`)
    if (r.error) console.log(`   └─ Error: ${r.error}`)
    if (r.note) console.log(`   └─ Note: ${r.note}`)
  })

  console.log('\nAction Items:')
  if (redirects > 0) {
    console.log('⚠️  Some endpoints are returning 307 redirects - check for trailing slashes')
  }
  if (failed > 0) {
    console.log('⚠️  Some endpoints failed - review error messages above')
  } else {
    console.log('✅ All endpoints working correctly!')
  }
}

runTests().catch(console.error)
