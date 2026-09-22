const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('v2r')) || context.pages()[0];
  await page.bringToFront();
  await page.goto('https://v2r.daboja.im/nc/seone');
  await page.waitForTimeout(2500);
  await page.locator('.n-base-selection').nth(0).click();
  await page.waitForTimeout(800);
  await page.getByText('써본언니들').first().click();
  await page.waitForTimeout(1500);
  await page.locator('.n-base-selection').nth(1).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(__dirname, 'v2r-nicks.png') });
  await browser.close();
})();
