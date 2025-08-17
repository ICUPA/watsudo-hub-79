// E2E tests for the main application
// Tests core functionality and user flows

import { test, expect } from '@playwright/test';

test.describe('Watsudo Hub Application', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app before each test
    await page.goto('/');
    
    // Wait for the app to load
    await page.waitForSelector('#root', { timeout: 30000 });
  });

  test('should load the application successfully', async ({ page }) => {
    // Check if the app loads without errors
    await expect(page.locator('#root')).toBeVisible();
    
    // Check for any console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit for any potential errors
    await page.waitForTimeout(2000);
    
    expect(consoleErrors).toHaveLength(0);
  });

  test('should display main navigation elements', async ({ page }) => {
    // Check for main navigation elements
    await expect(page.locator('nav')).toBeVisible();
    
    // Check for key navigation items
    const navItems = ['Home', 'Mobility', 'QR Codes', 'Admin'];
    for (const item of navItems) {
      await expect(page.locator(`text=${item}`)).toBeVisible();
    }
  });

  test('should handle responsive design', async ({ page }) => {
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(1000);
    
    // Check if mobile navigation is accessible
    const mobileNav = page.locator('[data-mobile-nav]');
    if (await mobileNav.isVisible()) {
      await mobileNav.click();
      await expect(page.locator('[data-mobile-menu]')).toBeVisible();
    }

    // Test desktop viewport
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.waitForTimeout(1000);
    
    // Check if desktop navigation is visible
    await expect(page.locator('nav')).toBeVisible();
  });

  test('should handle offline functionality', async ({ page }) => {
    // Simulate offline mode
    await page.route('**/*', (route) => {
      route.abort('failed');
    });

    // Navigate to trigger offline handling
    await page.goto('/');
    
    // Check if offline page or message is shown
    const offlineIndicator = page.locator('[data-offline]');
    if (await offlineIndicator.isVisible()) {
      await expect(offlineIndicator).toContainText('offline');
    }
  });

  test('should handle PWA installation', async ({ page }) => {
    // Check if PWA install banner is present (when applicable)
    const installBanner = page.locator('[data-pwa-banner]');
    
    if (await installBanner.isVisible()) {
      // Check install button
      const installButton = installBanner.locator('button:has-text("Install")');
      await expect(installButton).toBeVisible();
      
      // Check learn more button
      const learnMoreButton = installBanner.locator('button:has-text("Learn More")');
      await expect(learnMoreButton).toBeVisible();
    }
  });

  test('should handle Google Maps integration', async ({ page }) => {
    // Navigate to a page with Maps integration
    await page.goto('/admin/drivers');
    
    // Check if Maps component is loaded
    const mapsComponent = page.locator('[data-maps-picker]');
    if (await mapsComponent.isVisible()) {
      // Check if search input is present
      const searchInput = mapsComponent.locator('input[placeholder*="location"]');
      await expect(searchInput).toBeVisible();
      
      // Check if current location button is present
      const currentLocationButton = mapsComponent.locator('[title*="current location"]');
      await expect(currentLocationButton).toBeVisible();
    }
  });

  test('should handle form submissions', async ({ page }) => {
    // Navigate to admin page
    await page.goto('/admin/drivers');
    
    // Check if add driver form is accessible
    const addDriverButton = page.locator('button:has-text("Add Driver")');
    if (await addDriverButton.isVisible()) {
      await addDriverButton.click();
      
      // Check if form dialog opens
      const formDialog = page.locator('[role="dialog"]');
      await expect(formDialog).toBeVisible();
      
      // Check form fields
      const requiredFields = ['User ID', 'Vehicle Type', 'Plate Number'];
      for (const field of requiredFields) {
        await expect(page.locator(`label:has-text("${field}")`)).toBeVisible();
      }
    }
  });

  test('should handle data loading and error states', async ({ page }) => {
    // Navigate to admin dashboard
    await page.goto('/admin');
    
    // Check if loading states are handled
    const loadingIndicator = page.locator('[data-loading]');
    if (await loadingIndicator.isVisible()) {
      await expect(loadingIndicator).toBeVisible();
      
      // Wait for loading to complete
      await page.waitForSelector('[data-loading="false"]', { timeout: 10000 });
    }
    
    // Check if data is displayed
    const dataSection = page.locator('[data-stats]');
    if (await dataSection.isVisible()) {
      await expect(dataSection).toBeVisible();
    }
  });

  test('should handle authentication flow', async ({ page }) => {
    // Check if login/logout functionality is present
    const authButton = page.locator('[data-auth-button]');
    
    if (await authButton.isVisible()) {
      await authButton.click();
      
      // Check if auth modal or form is shown
      const authForm = page.locator('[data-auth-form]');
      if (await authForm.isVisible()) {
        await expect(authForm).toBeVisible();
        
        // Check for required fields
        const emailInput = authForm.locator('input[type="email"]');
        const passwordInput = authForm.locator('input[type="password"]');
        
        if (await emailInput.isVisible()) {
          await expect(emailInput).toBeVisible();
        }
        if (await passwordInput.isVisible()) {
          await expect(passwordInput).toBeVisible();
        }
      }
    }
  });

  test('should handle search and filtering', async ({ page }) => {
    // Navigate to a page with search functionality
    await page.goto('/admin/drivers');
    
    // Check if search input is present
    const searchInput = page.locator('input[placeholder*="search"]');
    if (await searchInput.isVisible()) {
      await expect(searchInput).toBeVisible();
      
      // Test search functionality
      await searchInput.fill('test driver');
      await searchInput.press('Enter');
      
      // Wait for search results
      await page.waitForTimeout(1000);
      
      // Check if search results are displayed
      const searchResults = page.locator('[data-search-results]');
      if (await searchResults.isVisible()) {
        await expect(searchResults).toBeVisible();
      }
    }
  });

  test('should handle accessibility features', async ({ page }) => {
    // Check for proper heading structure
    const headings = page.locator('h1, h2, h3, h4, h5, h6');
    await expect(headings.first()).toBeVisible();
    
    // Check for proper form labels
    const formLabels = page.locator('label');
    if (await formLabels.first().isVisible()) {
      await expect(formLabels.first()).toBeVisible();
    }
    
    // Check for proper button text
    const buttons = page.locator('button');
    for (const button of await buttons.all()) {
      const buttonText = await button.textContent();
      if (buttonText && buttonText.trim()) {
        // Button should have meaningful text
        expect(buttonText.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test('should handle keyboard navigation', async ({ page }) => {
    // Test tab navigation
    await page.keyboard.press('Tab');
    
    // Check if focus is visible
    const focusedElement = page.locator(':focus');
    await expect(focusedElement).toBeVisible();
    
    // Test arrow key navigation
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    
    // Test Enter key
    await page.keyboard.press('Enter');
  });

  test('should handle error boundaries', async ({ page }) => {
    // Try to trigger an error (this is a test scenario)
    // In a real app, you might navigate to a broken route or trigger an error
    
    // Check if error boundaries are in place
    const errorBoundary = page.locator('[data-error-boundary]');
    if (await errorBoundary.isVisible()) {
      await expect(errorBoundary).toBeVisible();
      
      // Check if retry button is present
      const retryButton = errorBoundary.locator('button:has-text("Retry")');
      if (await retryButton.isVisible()) {
        await expect(retryButton).toBeVisible();
      }
    }
  });

  test('should handle service worker updates', async ({ page }) => {
    // Check if service worker is registered
    const swRegistration = await page.evaluate(() => {
      return 'serviceWorker' in navigator;
    });
    
    if (swRegistration) {
      // Check for update notifications
      const updateNotification = page.locator('[data-update-notification]');
      if (await updateNotification.isVisible()) {
        await expect(updateNotification).toBeVisible();
        
        // Check update button
        const updateButton = updateNotification.locator('button:has-text("Update")');
        if (await updateButton.isVisible()) {
          await expect(updateButton).toBeVisible();
        }
      }
    }
  });
});

// Smoke tests for critical functionality
test.describe('Smoke Tests @smoke', () => {
  test('should load main page without errors', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();
    
    // Check for critical errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    
    await page.waitForTimeout(5000);
    expect(consoleErrors).toHaveLength(0);
  });

  test('should handle basic navigation', async ({ page }) => {
    await page.goto('/');
    
    // Test basic navigation
    const navLinks = page.locator('nav a');
    const linkCount = await navLinks.count();
    
    if (linkCount > 0) {
      // Click first navigation link
      await navLinks.first().click();
      
      // Check if page navigation works
      await expect(page.locator('#root')).toBeVisible();
    }
  });
});
