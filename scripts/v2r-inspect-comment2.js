const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const s = require('../cafe-storage/samples.json');
  const item = (Array.isArray(s) ? s : s.samples).find((x) => x.id === 117);
  const views = 12 + Math.floor(Math.random() * 14);
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('v2r')) || context.pages()[0];
  await page.locator('input[type="number"]').first().scrollIntoViewIfNeeded();
  await page.locator('input[type="number"]').first().fill(String(views));
  console.log('조회수', views);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: '등록', exact: true }).first().click();
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: '이동' }).click();
  await page.waitForTimeout(4000);
  const row = await page.locator('table tbody tr').first().innerText().catch(() => '');
  console.log('글목록 맨 위:', row.replace(/\s+/g, ' '));
  console.log('제목 일치:', row.includes(item.title.slice(0, 10)));
  await page.screenshot({ path: path.join(__dirname, 'v2r-final.png') });
  await browser.close();
})();
