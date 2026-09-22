const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('/nc/seone')) || context.pages()[0];
  await page.getByRole('button', { name: '이동' }).click();
  await page.waitForTimeout(4000);
  console.log('URL:', page.url());
  await page.screenshot({ path: path.join(__dirname, 'v2r-progress.png') });
  await browser.close();
})();
