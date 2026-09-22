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
  await page.waitForTimeout(800);
  await page.locator('.n-base-select-option:visible').first().click();
  await page.waitForTimeout(1500);
  await page.locator('.n-base-selection').nth(2).click();
  await page.waitForTimeout(1200);
  const opts = await page.$$eval('.n-base-select-option', (els) => els.map((e) => e.innerText.trim()));
  console.log('게시판:', JSON.stringify(opts));
  await page.screenshot({ path: path.join(__dirname, 'v2r-boards.png') });
  await browser.close();
})();
