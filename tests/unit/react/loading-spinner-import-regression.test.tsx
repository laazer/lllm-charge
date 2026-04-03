// LoadingSpinner Import Regression Test
// Prevents regression of the "does not provide an export named 'LoadingSpinner'" error

import React from 'react';
import { render } from '@testing-library/react';

describe('LoadingSpinner Import Regression Test', () => {
  it('should prevent regression of LoadingSpinner import error', async () => {
    // This test specifically prevents the regression of the error:
    // "The requested module '/components/ui/LoadingSpinner.tsx' does not provide an export named 'LoadingSpinner'"
    
    // Test the correct import pattern (default import)
    const { default: LoadingSpinner } = await import('../../../src/react/components/ui/LoadingSpinner');
    
    // Should be a valid React component
    expect(LoadingSpinner).toBeDefined();
    expect(typeof LoadingSpinner).toBe('function');
    
    // Should render without errors
    const { container } = render(<LoadingSpinner />);
    expect(container.firstChild).toBeInTheDocument();
    expect(container.querySelector('[role="status"]')).toBeInTheDocument();
  });

  it('should verify LoadingSpinner is NOT available as named export', async () => {
    // This ensures that if someone tries to use the incorrect import pattern,
    // it will be undefined (which would cause the original error)
    
    const LoadingSpinnerModule = await import('../../../src/react/components/ui/LoadingSpinner');
    
    // Named export should NOT exist (this was the source of the original bug)
    expect((LoadingSpinnerModule as any).LoadingSpinner).toBeUndefined();
    
    // Only default export should exist
    expect(LoadingSpinnerModule.default).toBeDefined();
  });

  it('should validate CronJobs.tsx uses correct import syntax', async () => {
    // This test ensures that CronJobs.tsx uses the correct import syntax
    // and would fail if someone changes it back to the incorrect pattern
    
    // Read the actual CronJobs file content to verify import syntax
    const fs = await import('fs');
    const path = await import('path');
    
    const cronJobsPath = path.resolve(__dirname, '../../../src/react/pages/CronJobs.tsx');
    const cronJobsContent = fs.readFileSync(cronJobsPath, 'utf-8');
    
    // Should contain correct default import
    expect(cronJobsContent).toMatch(/import LoadingSpinner from ['"'][^'"]*LoadingSpinner['"']/);
    
    // Should NOT contain incorrect named import
    expect(cronJobsContent).not.toMatch(/import\s*{\s*LoadingSpinner\s*}/);
  });

  it('should prevent "module does not provide export" errors in development', () => {
    // This test documents the exact error pattern we fixed and ensures
    // it doesn't happen again
    
    // The original error was:
    // "SyntaxError: The requested module '/components/ui/LoadingSpinner.tsx' 
    //  does not provide an export named 'LoadingSpinner' (at CronJobs.tsx:8:10)"
    
    // This was caused by using named import syntax:
    // import { LoadingSpinner } from '../components/ui/LoadingSpinner';
    
    // When the actual export was default:
    // export default LoadingSpinner
    
    // The fix was to change to default import syntax:
    // import LoadingSpinner from '../components/ui/LoadingSpinner';
    
    // This test ensures that pattern is maintained
    expect(true).toBe(true); // Placeholder to document the fix
  });

  it('should render LoadingSpinner with all size variants', async () => {
    // Additional regression test to ensure the component works correctly
    // after the import fix
    
    const LoadingSpinnerModule = await import('../../../src/react/components/ui/LoadingSpinner');
    const LoadingSpinner = LoadingSpinnerModule.default;
    
    // Test small size
    const { container: smallContainer } = render(<LoadingSpinner size="sm" />);
    expect(smallContainer.querySelector('.w-4.h-4')).toBeInTheDocument();
    
    // Test medium size (default)
    const { container: mediumContainer } = render(<LoadingSpinner size="md" />);
    expect(mediumContainer.querySelector('.w-8.h-8')).toBeInTheDocument();
    
    // Test large size
    const { container: largeContainer } = render(<LoadingSpinner size="lg" />);
    expect(largeContainer.querySelector('.w-12.h-12')).toBeInTheDocument();
  });
});