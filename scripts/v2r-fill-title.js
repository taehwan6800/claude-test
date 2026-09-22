const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const s = require('../cafe-storage/samples.json');
  const item = (Array.isArray(s) ? s : s.samples)[0];
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('/nc/seone'));
  await page.bringToFront();
  await page.getByText('자유수다', { exact: true }).first().click();
  await page.waitForTimeout(2000);
  await page.getByPlaceholder('제목을 입력해주세요').fill(item.title);
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(__dirname, 'v2r-after-title.png'), fullPage: true });
  const frames = page.frames().map((f) => f.url());
  console.log('FRAMES', JSON.stringify(frames));
  await browser.close();
})();
