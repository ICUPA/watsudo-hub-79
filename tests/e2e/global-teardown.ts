// Global teardown for E2E tests
// This file runs once after all tests

import { FullConfig } from '@playwright/test';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Cleaning up E2E test environment...');

  // Perform any global cleanup
  // This could include:
  // - Cleaning up test data
  // - Resetting application state
  // - Closing connections
  // - Generating reports

  console.log('✅ E2E test environment cleanup completed');
}

export default globalTeardown;
