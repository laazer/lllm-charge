#!/usr/bin/env node

/**
 * Test script to verify LM Studio is configured as the default local LLM provider
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function testLMStudioDefault() {
  console.log('🧪 Testing LM Studio Default Configuration...\n')
  
  try {
    // 1. Check router.json configuration
    console.log('1️⃣ Checking router.json configuration...')
    const configPath = path.join(__dirname, 'config', 'router.json')
    const configData = await fs.readFile(configPath, 'utf8')
    const config = JSON.parse(configData)
    
    const localProviders = config.providers.local
    const lmStudioConfig = localProviders['lm-studio']
    const ollamaConfig = localProviders.ollama
    
    console.log(`   📋 LM Studio config:`, lmStudioConfig)
    console.log(`   📋 Ollama config:`, ollamaConfig)
    
    // Check if LM Studio is listed first (indicating priority)
    const providerKeys = Object.keys(localProviders)
    const lmStudioFirst = providerKeys[0] === 'lm-studio'
    console.log(`   ✅ LM Studio listed first: ${lmStudioFirst}`)
    console.log(`   ✅ LM Studio has default flag: ${lmStudioConfig?.default === true}`)
    console.log(`   ✅ LM Studio models: ${JSON.stringify(lmStudioConfig?.models)}`)
    
    // 2. Check local-llm-router.ts default case
    console.log('\n2️⃣ Checking local-llm-router.ts default case...')
    const routerPath = path.join(__dirname, 'src', 'reasoning', 'local-llm-router.ts')
    const routerCode = await fs.readFile(routerPath, 'utf8')
    
    const defaultToLMStudio = routerCode.includes('// Default to LM Studio format') && 
                              routerCode.includes('return this.callLMStudio(request, model)')
    console.log(`   ✅ Router defaults to LM Studio: ${defaultToLMStudio}`)
    
    // 3. Check local-llm-manager.mjs provider order
    console.log('\n3️⃣ Checking local-llm-manager.mjs provider setup...')
    const managerPath = path.join(__dirname, 'src', 'server', 'local-llm-manager.mjs')
    const managerCode = await fs.readFile(managerPath, 'utf8')
    
    const lmStudioPrimary = managerCode.includes('// Default LM Studio configuration (primary)')
    const lmStudioHasDefaultFlag = managerCode.includes('default: true')
    console.log(`   ✅ LM Studio set as primary: ${lmStudioPrimary}`)
    console.log(`   ✅ LM Studio has default flag: ${lmStudioHasDefaultFlag}`)
    
    // 4. Check hybrid-routing-manager.mjs provider selection
    console.log('\n4️⃣ Checking hybrid-routing-manager.mjs provider selection...')
    const hybridPath = path.join(__dirname, 'src', 'server', 'hybrid-routing-manager.mjs')
    const hybridCode = await fs.readFile(hybridPath, 'utf8')
    
    const prioritizesLMStudio = hybridCode.includes("if (a[0] === 'lm-studio') return -1")
    const selectsBestModel = hybridCode.includes('const lmStudioProvider = healthyProviders.find(p => p.type === \'lm-studio\')')
    console.log(`   ✅ Prioritizes LM Studio in sorting: ${prioritizesLMStudio}`)
    console.log(`   ✅ Selects LM Studio models first: ${selectsBestModel}`)
    
    // Summary
    console.log('\n📊 SUMMARY:')
    const allGood = lmStudioFirst && defaultToLMStudio && lmStudioPrimary && lmStudioHasDefaultFlag && prioritizesLMStudio && selectsBestModel
    
    if (allGood) {
      console.log('✅ LM Studio is properly configured as the default local LLM engine!')
      console.log('✅ All configuration files updated successfully')
      console.log('\n🚀 LM Studio will now be preferred for:')
      console.log('   • Local LLM routing decisions')  
      console.log('   • Provider health checks and selection')
      console.log('   • Model selection for code and general tasks')
      console.log('   • Fallback scenarios when other providers fail')
    } else {
      console.log('❌ Some configuration issues found. Check the details above.')
    }
    
    console.log('\n🔧 To test with a live LM Studio instance:')
    console.log('   1. Start LM Studio and load a model')
    console.log('   2. Start the LLM-Charge server: npm run dev')
    console.log('   3. Check the logs for "LM Studio" connection status')
    
  } catch (error) {
    console.error('❌ Test failed:', error.message)
  }
}

// Run the test
testLMStudioDefault()