const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const s = require('../cafe-storage/samples.json');
  const item = (Array.isArray(s) ? s : s.samples)[0];
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('/nc/seone'));
  await page.bringToFront();
  await page.getByText('내용을 입력하세요').first().click();
  await page.keyboard.insertText(item.body);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, 'v2r-before-submit.png'), fullPage: true });
  await page.getByRole('button', { name: '등록', exact: true }).click();
  await page.waitForTimeout(3000);
  console.log('등록 후 URL:', page.url());
  await page.screenshot({ path: path.join(__dirname, 'v2r-after-submit.png'), fullPage: true });
  await browser.close();
})();
