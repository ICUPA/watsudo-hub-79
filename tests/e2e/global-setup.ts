// Global setup for E2E tests
// This file runs once before all tests

import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  if (!baseURL) {
    console.warn('No baseURL configured for E2E tests');
    return;
  }

  console.log(`🚀 Setting up E2E tests for: ${baseURL}`);

  // Launch browser and perform any global setup
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // Navigate to the app and wait for it to load
    await page.goto(baseURL);
    
    // Wait for the app to be ready
    await page.waitForSelector('#root', { timeout: 30000 });
    
    // Check if the app is responsive
    await page.waitForFunction(() => {
      return document.readyState === 'complete' && 
             !document.querySelector('[data-loading="true"]');
    }, { timeout: 30000 });

    console.log('✅ E2E test environment ready');
  } catch (error) {
    console.error('❌ Failed to setup E2E test environment:', error);
    throw error;
  } finally {
    await browser.close();
  }
}

export default globalSetup;
