#!/usr/bin/env npx tsx

import { readFileSync, writeFileSync } from 'fs';

const filePath = 'tests/python-backend-architecture-foundation.test.ts';
let content = readFileSync(filePath, 'utf8');

// Define all method name mappings
const methodMappings = [
  { test: 'should set up environment configuration', method: 'setupEnvironmentConfiguration' },
  { test: 'should implement cors middleware', method: 'implementCORSMiddleware' },
  { test: 'should add health check endpoints', method: 'addHealthCheckEndpoints' },
  { test: 'should set up static file serving', method: 'setupStaticFileServing' },
  { test: 'should create basic logging configuration', method: 'createBasicLoggingConfiguration' },
  { test: 'should design sqlalchemy models for all entities', method: 'designSQLAlchemyModelsForAllEntities' },
  { test: 'should create database connection management', method: 'createDatabaseConnectionManagement' },
  { test: 'should implement migration system', method: 'implementMigrationSystem' },
  { test: 'should add database initialization', method: 'addDatabaseInitialization' },
  { test: 'should create data access layer (dal)', method: 'createDataAccessLayer' },
  { test: 'should create base router classes', method: 'createBaseRouterClasses' },
  { test: 'should implement error handling middleware', method: 'implementErrorHandlingMiddleware' },
  { test: 'should add request/response validation', method: 'addRequestResponseValidation' },
  { test: 'should create api documentation structure', method: 'createAPIDocumentationStructure' },
  { test: 'should set up pytest testing framework', method: 'setupPytestTestingFramework' },
  { test: 'should create development docker setup', method: 'createDevelopmentDockerSetup' },
  { test: 'should add hot-reload configuration', method: 'addHotReloadConfiguration' },
  { test: 'should implement development scripts', method: 'implementDevelopmentScripts' },
  { test: 'should fastapi server starts successfully', method: 'fastAPIServerStartsSuccessfully' },
  { test: 'should all database models are created and tested', method: 'allDatabaseModelsAreCreatedAndTested' },
  { test: 'should basic api endpoints respond correctly', method: 'basicAPIEndpointsRespondCorrectly' },
  { test: 'should static file serving works for frontend', method: 'staticFileServingWorksForFrontend' },
  { test: 'should development environment is fully functional', method: 'developmentEnvironmentIsFullyFunctional' },
  { test: 'should foundation supports websocket connections', method: 'foundationSupportsWebSocketConnections' },
  { test: 'should fastmcp integration is initialized', method: 'fastMCPIntegrationIsInitialized' }
];

// Replace METHOD_NAME() with actual method names
for (const { test, method } of methodMappings) {
  // Find the test section and replace METHOD_NAME() with the actual method
  const testPattern = new RegExp(
    `(\\s+it\\('${test.replace(/[()]/g, '\\$&')}',.*?const result = await instance\\.)METHOD_NAME\\(\\);`,
    'gs'
  );
  content = content.replace(testPattern, `$1${method}();`);
}

writeFileSync(filePath, content);
console.log(`✅ Fixed method names for ${methodMappings.length} tests`);