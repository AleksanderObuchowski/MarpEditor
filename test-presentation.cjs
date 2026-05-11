const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  await page.goto('http://localhost:5176');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: '/Users/aleksanderobuchowski/MarpEditorKimi/screenshot-1-editor.png' });
  console.log('Screenshot 1: Editor view');

  // Click Present button
  const presentBtn = await page.locator('button[title="Start presentation (F5)"]');
  if (await presentBtn.count() > 0) {
    await presentBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: '/Users/aleksanderobuchowski/MarpEditorKimi/screenshot-2-presentation.png' });
    console.log('Screenshot 2: Presentation mode');

    // Press right arrow
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/Users/aleksanderobuchowski/MarpEditorKimi/screenshot-3-next-slide.png' });
    console.log('Screenshot 3: Next slide');

    // Press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.screenshot({ path: '/Users/aleksanderobuchowski/MarpEditorKimi/screenshot-4-back.png' });
    console.log('Screenshot 4: Back to editor');
  } else {
    console.log('Present button not found');
  }

  await browser.close();
})();
