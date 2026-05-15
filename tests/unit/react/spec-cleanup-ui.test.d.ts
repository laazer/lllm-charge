/**
 * Tests for the Spec Cleanup feature's API integration and data flow.
 * Tests the API client methods and the expected request/response shapes.
 *
 * Note: The SpecsSection component has pre-existing type mismatches with
 * the shared types/index.ts Spec type (status values differ), so full
 * component rendering tests are deferred until those types are unified.
 */
import '@testing-library/jest-dom';
