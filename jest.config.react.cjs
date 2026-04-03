module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  displayName: 'React Tests',
  roots: ['<rootDir>/src/react', '<rootDir>/tests'],
  testMatch: [
    '**/tests/unit/react/**/*.test.{ts,tsx}',
    '**/tests/integration/react-*.test.{ts,tsx}',
    '**/tests/performance/websocket-*.test.{ts,tsx}',
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/react/$1',
    '^../../../src/react/(.*)$': '<rootDir>/src/react/$1',
    '^../../src/(.*)$': '<rootDir>/src/$1',
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup/react-testing-setup.ts'],
  collectCoverageFrom: [
    'src/react/**/*.{ts,tsx}',
    '!src/react/**/*.d.ts',
    '!src/react/main.tsx',
    '!src/react/vite-env.d.ts',
  ],
  coverageDirectory: 'coverage/react',
  coverageReporters: ['text', 'lcov', 'html'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        moduleResolution: 'node',
        target: 'ES2020',
        lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      },
    }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testTimeout: 15000,
  maxWorkers: 4,
  errorOnDeprecated: false,
  verbose: true,
  bail: false,
}