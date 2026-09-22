const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('/nc/seone'));
  await page.bringToFront();
  await page.getByText('두니건').first().click();
  await page.waitForTimeout(1500);
  await page.locator('.n-base-selection').nth(2).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(__dirname, 'v2r-board-list.png') });
  await browser.close();
})();
