/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/*.(test|spec).ts'
  ],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, diagnostics: { warnOnly: true } }],
    '^.+\\.mjs$': ['babel-jest'],
    '^.+\\.js$': ['babel-jest'],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  extensionsToTreatAsEsm: ['.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/bin/**',
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      statements: 50,
      branches: 40,
      functions: 50,
      lines: 50
    }
  },
  testTimeout: 30000,
  setupFilesAfterEnv: ['jest-extended/all'],
  moduleNameMapper: {
    '^canvas$': '<rootDir>/__mocks__/canvas.cjs',
    '^sqlite3$': '<rootDir>/__mocks__/sqlite3.cjs',
    '^node-fetch$': '<rootDir>/__mocks__/node-fetch.cjs',
    '^(\\.{1,2}/.*)\\.js$': '$1',
    '^@/(.*)$': '<rootDir>/src/$1'
  },
}