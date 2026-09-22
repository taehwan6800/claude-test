const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('/nc/seone'));
  await page.bringToFront();
  await page.keyboard.press('Escape');
  await page.locator('.n-base-selection').nth(0).click();
  await page.waitForTimeout(800);
  await page.getByText('천안아산 동네사람들').first().click();
  await page.waitForTimeout(1500);
  await page.locator('.n-base-selection').nth(1).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(__dirname, 'v2r-nick-list.png') });
  await browser.close();
})();
