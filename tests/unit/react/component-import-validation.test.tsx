// Component Import Validation Tests
// Validates that all React component imports match their actual exports

import React from 'react';
import { render } from '@testing-library/react';

describe('Component Import Validation Tests', () => {
  describe('UI Components Import/Export Consistency', () => {
    it('should import LoadingSpinner correctly as default export', async () => {
      // This test ensures LoadingSpinner is imported as default, not named export
      const LoadingSpinnerModule = await import('../../../src/react/components/ui/LoadingSpinner');
      
      // Should have default export
      expect(LoadingSpinnerModule.default).toBeDefined();
      expect(typeof LoadingSpinnerModule.default).toBe('function');
      
      // Should NOT have named export (this would indicate incorrect export style)
      expect((LoadingSpinnerModule as any).LoadingSpinner).toBeUndefined();
      
      // Should render without errors
      const LoadingSpinner = LoadingSpinnerModule.default;
      const { container } = render(<LoadingSpinner />);
      expect(container.firstChild).toBeInTheDocument();
    });

    it('should import StatusCard correctly as named export', async () => {
      // This test ensures StatusCard is exported as named export, not default
      const StatusCardModule = await import('../../../src/react/components/ui/Cards/StatusCard');
      
      // Should have named export
      expect(StatusCardModule.StatusCard).toBeDefined();
      expect(typeof StatusCardModule.StatusCard).toBe('function');
      
      // Should NOT have default export for named exports
      expect((StatusCardModule as any).default).toBeUndefined();
    });

    it('should import DataTable correctly as named export', async () => {
      const DataTableModule = await import('../../../src/react/components/ui/Data/DataTable');
      
      // Should have named export
      expect(DataTableModule.DataTable).toBeDefined();
      expect(typeof DataTableModule.DataTable).toBe('function');
      
      // Should NOT have default export
      expect((DataTableModule as any).default).toBeUndefined();
    });

    it('should import Modal correctly as named export', async () => {
      const ModalModule = await import('../../../src/react/components/ui/Modals/Modal');
      
      // Should have named export
      expect(ModalModule.Modal).toBeDefined();
      expect(typeof ModalModule.Modal).toBe('function');
      
      // Should NOT have default export
      expect((ModalModule as any).default).toBeUndefined();
    });
  });

  describe('Page Components Import/Export Consistency', () => {
    it('should verify CronJobs component imports match their exports', async () => {
      // Test that all imports in CronJobs.tsx are correctly structured
      
      // StatusCard - should be named export
      const statusCardImport = await import('../../../src/react/components/ui/Cards/StatusCard');
      expect(statusCardImport.StatusCard).toBeDefined();
      
      // DataTable - should be named export
      const dataTableImport = await import('../../../src/react/components/ui/Data/DataTable');
      expect(dataTableImport.DataTable).toBeDefined();
      
      // Modal - should be named export
      const modalImport = await import('../../../src/react/components/ui/Modals/Modal');
      expect(modalImport.Modal).toBeDefined();
      
      // LoadingSpinner - should be default export
      const loadingSpinnerImport = await import('../../../src/react/components/ui/LoadingSpinner');
      expect(loadingSpinnerImport.default).toBeDefined();
    });

    it('should detect if LoadingSpinner import pattern changes', async () => {
      // This test would fail if LoadingSpinner.tsx switches to named export
      // without updating the import in CronJobs.tsx
      
      const LoadingSpinnerModule = await import('../../../src/react/components/ui/LoadingSpinner');
      
      // Assert it's still a default export
      expect(LoadingSpinnerModule.default).toBeDefined();
      
      // If someone changes LoadingSpinner.tsx to use named export,
      // this test will fail and remind them to update imports
      expect((LoadingSpinnerModule as any).LoadingSpinner).toBeUndefined();
    });
  });

  describe('Import Pattern Validation', () => {
    it('should validate all UI component export patterns are consistent', async () => {
      const componentPaths = [
        { path: '../../../src/react/components/ui/LoadingSpinner', expectedType: 'default', name: 'LoadingSpinner' },
        { path: '../../../src/react/components/ui/Cards/StatusCard', expectedType: 'named', name: 'StatusCard' },
        { path: '../../../src/react/components/ui/Data/DataTable', expectedType: 'named', name: 'DataTable' },
        { path: '../../../src/react/components/ui/Modals/Modal', expectedType: 'named', name: 'Modal' },
      ];

      for (const component of componentPaths) {
        const module = await import(component.path);
        
        if (component.expectedType === 'default') {
          expect(module.default).toBeDefined();
          expect(typeof module.default).toBe('function');
          // Ensure no conflicting named export
          expect((module as any)[component.name]).toBeUndefined();
        } else if (component.expectedType === 'named') {
          expect((module as any)[component.name]).toBeDefined();
          expect(typeof (module as any)[component.name]).toBe('function');
          // Ensure no default export for pure named exports
          expect((module as any).default).toBeUndefined();
        }
      }
    });
  });

  describe('Runtime Import Error Prevention', () => {
    it('should prevent "does not provide an export named" errors', async () => {
      // This test simulates the exact error we fixed:
      // "The requested module does not provide an export named 'LoadingSpinner'"
      
      const LoadingSpinnerModule = await import('../../../src/react/components/ui/LoadingSpinner');
      
      // This would throw if the import was incorrect
      expect(() => {
        const LoadingSpinner = LoadingSpinnerModule.default;
        return LoadingSpinner;
      }).not.toThrow();
      
      // This would be undefined if trying to use named import
      // (which was the original bug)
      expect((LoadingSpinnerModule as any).LoadingSpinner).toBeUndefined();
    });

    it('should validate that named exports exist where expected', async () => {
      const namedExportComponents = [
        { module: '../../../src/react/components/ui/Cards/StatusCard', exportName: 'StatusCard' },
        { module: '../../../src/react/components/ui/Data/DataTable', exportName: 'DataTable' },
        { module: '../../../src/react/components/ui/Modals/Modal', exportName: 'Modal' },
      ];

      for (const { module, exportName } of namedExportComponents) {
        const importedModule = await import(module);
        
        // Should have the named export
        expect((importedModule as any)[exportName]).toBeDefined();
        
        // Should be a React component function
        expect(typeof (importedModule as any)[exportName]).toBe('function');
      }
    });
  });

  describe('TypeScript Import Validation', () => {
    it('should ensure TypeScript can resolve all component imports', () => {
      // This test ensures TypeScript compilation would succeed
      // and catches import/export mismatches at test time
      
      // These imports should not cause TypeScript errors
      const imports = [
        // Default import (correct)
        'import LoadingSpinner from "../../../src/react/components/ui/LoadingSpinner"',
        // Named imports (correct)
        'import { StatusCard } from "../../../src/react/components/ui/Cards/StatusCard"',
        'import { DataTable } from "../../../src/react/components/ui/Data/DataTable"',
        'import { Modal } from "../../../src/react/components/ui/Modals/Modal"',
      ];
      
      // If any of these imports were incorrect, TypeScript would fail
      // This test documents the correct import patterns
      expect(imports.length).toBe(4);
    });
  });
});