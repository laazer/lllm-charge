// Test script to verify the CronJobs page loads without errors
import { chromium } from 'playwright';

const testCronPageLoad = async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Capture console errors
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  // Capture JavaScript exceptions
  const exceptions = [];
  page.on('pageerror', exception => {
    exceptions.push(exception.toString());
  });
  
  try {
    console.log('🧪 Testing CronJobs page load...');
    
    // Navigate to the cron page
    await page.goto('http://localhost:3003/cronjobs', { 
      waitUntil: 'networkidle',
      timeout: 10000 
    });
    
    // Wait a bit for React to fully load
    await page.waitForTimeout(2000);
    
    // Check if the page loaded successfully
    const title = await page.title();
    console.log(`📄 Page title: ${title}`);
    
    // Check for the presence of React content
    const hasReactContent = await page.evaluate(() => {
      return document.querySelector('[data-reactroot]') !== null ||
             document.querySelector('#root') !== null ||
             document.getElementById('root')?.children.length > 0;
    });
    
    console.log(`⚛️ React content detected: ${hasReactContent}`);
    
    if (errors.length > 0) {
      console.log('❌ Console errors detected:');
      errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (exceptions.length > 0) {
      console.log('💥 JavaScript exceptions detected:');
      exceptions.forEach(exception => console.log(`  - ${exception}`));
    }
    
    if (errors.length === 0 && exceptions.length === 0) {
      console.log('✅ CronJobs page loaded successfully without errors!');
    } else {
      console.log(`⚠️ Found ${errors.length} console errors and ${exceptions.length} exceptions`);
    }
    
  } catch (error) {
    console.log('❌ Failed to load page:', error.message);
  } finally {
    await browser.close();
  }
};

// Run the test if this script is executed directly
if (process.argv[1].endsWith('test-cron-page-fix.mjs')) {
  testCronPageLoad().catch(console.error);
}