# LLM-Charge Test Suite

Comprehensive testing infrastructure for the LLM-Charge project ensuring reliability, performance, and cost optimization.

## Test Structure

```
tests/
├── setup.ts                     # Global test utilities and mocks
├── global-setup.ts              # Jest global setup
├── global-teardown.ts           # Jest global teardown
├── unit/                        # Unit tests for individual components
│   ├── knowledge-base.test.ts   # KnowledgeBase functionality
│   ├── common-commands.test.ts  # Command handler tests
│   └── smart-docs-cache.test.ts # Documentation caching tests
├── integration/                 # Integration tests for system components
│   ├── mcp-server.test.ts      # MCP server integration
│   └── end-to-end.test.ts      # Complete workflow tests
└── performance/                 # Performance and load tests
    └── load-tests.test.ts      # Stress testing and benchmarks
```

## Test Categories

### Unit Tests (`npm run test:unit`)
- **KnowledgeBase**: Document storage, semantic search, cleanup
- **CommonCommandHandler**: Command recognition, execution, patterns
- **SmartDocsCache**: Auto-detection, queue management, expiration

### Integration Tests (`npm run test:integration`)  
- **MCP Server**: Tool integration, error handling, performance
- **End-to-End**: Complete workflows, cost validation, real scenarios

### Performance Tests (`npm run test:performance`)
- **Load Testing**: High-volume operations, concurrent users
- **Memory Usage**: Resource cleanup, cache efficiency
- **Stress Testing**: Extreme conditions, failure recovery

## Key Test Features

### 🧪 Comprehensive Coverage
- All major components tested
- Error conditions and edge cases
- Performance under load
- Memory usage validation

### 🔧 Realistic Testing
- Mock LLM providers for consistent results
- Actual file system operations
- Real command execution (safe subset)
- Typical developer workflows

### 📊 Performance Validation  
- Response time benchmarks
- Throughput measurements
- Memory usage monitoring
- Cost savings verification

### 🛡️ Reliability Assurance
- Error handling validation
- Resource cleanup verification
- Concurrent operation safety
- System recovery testing

## Running Tests

### All Tests
```bash
npm test                    # Run all test suites
npm run test:ci            # CI-optimized run with coverage
```

### Specific Categories
```bash
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:performance   # Performance tests (slower)
npm run test:e2e          # End-to-end scenarios
```

### Development
```bash
npm run test:watch         # Watch mode for development
npm run test:verbose       # Detailed output
npm run test:coverage      # Generate coverage report
```

## Test Expectations

### Performance Benchmarks
- **Command Execution**: < 100ms average
- **Document Search**: < 1s for large datasets
- **Pattern Matching**: < 5ms per pattern
- **Concurrent Load**: 80% success rate under stress

### Cost Validation
- **Common Commands**: $0.00 cost (100% savings)
- **Documentation Cache**: 365-day expiration
- **API Avoidance**: >70% local routing
- **Memory Efficiency**: <50MB growth under load

### Reliability Standards
- **Success Rate**: >95% under normal conditions
- **Error Recovery**: Graceful handling of failures
- **Resource Cleanup**: No memory leaks
- **Concurrent Safety**: Thread-safe operations

## Mock Components

### MockLLMProvider
- Deterministic responses for testing
- Configurable delays and errors
- Embedding generation simulation
- Cost tracking validation

### Test Fixtures
- Sample project structures  
- Realistic file contents
- Common dependency patterns
- Typical configuration files

## Coverage Goals

- **Unit Tests**: >90% code coverage
- **Integration Tests**: All major workflows
- **Performance Tests**: Realistic load patterns
- **Edge Cases**: Error conditions and recovery

## Continuous Integration

Tests are designed for CI/CD environments:
- Deterministic results
- Reasonable execution time
- Clear failure reporting
- Coverage metrics

## Contributing

When adding new features:
1. Add unit tests for new components
2. Update integration tests for workflows
3. Include performance tests for critical paths
4. Maintain >90% coverage
5. Document any new test utilities

## Test Utilities

### Available Helpers
- `setupTestDirectories()`: Creates test environment
- `cleanupTestDirectories()`: Cleanup after tests  
- `createMockConfig()`: Standard test configuration
- `generateTestQuery()`: Realistic test queries
- `MockLLMProvider`: Consistent LLM responses

### Custom Matchers
- `toBeWithinRange(min, max)`: Number range validation
- `toHaveValidCostMetrics()`: Cost structure validation

### Test Constants
- `TEST_CONFIG.TEST_PROJECT_DIR`: Isolated test directory
- `TEST_CONFIG.MOCK_LLM_RESPONSE_DELAY`: Consistent timing
- `TEST_CONFIG.TEST_TIMEOUT`: Operation timeouts

## Performance Metrics

Real performance data from test runs:

### Command Handler
- 100 commands in ~2-5 seconds
- 95%+ success rate
- Zero API costs
- <10ms average pattern matching

### Knowledge Base  
- 1000 documents stored in ~30-60 seconds
- Sub-second semantic search
- Efficient concurrent operations
- Proper cache management

### Smart Documentation
- 200 queries processed in ~10-20 seconds  
- Intelligent auto-detection
- Background download queuing
- 365-day smart expiration

These tests ensure LLM-Charge delivers on its promise of cost-effective, high-performance local LLM optimization.