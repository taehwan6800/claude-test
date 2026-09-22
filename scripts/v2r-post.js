// 사용법: node scripts/v2r-post.js <글 순번(1부터)> <별명 순번(1부터)>  (카페는 글의 cafe 값을 사용)
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const [idx, nickNo] = [Number(process.argv[2]), Number(process.argv[3])];
  const s = require('../cafe-storage/samples.json');
  const item = (Array.isArray(s) ? s : s.samples)[idx - 1];
  const cafe = item.cafe;
  const views = 12 + Math.floor(Math.random() * 14); // 12~25
  console.log(`글 #${item.id} [${item.category}] ${item.title} | 조회수 ${views}`);

  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('v2r')) || context.pages()[0];
  await page.bringToFront();
  await page.goto('https://v2r.daboja.im/nc/seone');
  await page.waitForTimeout(2500);

  const sel = page.locator('.n-base-selection');
  await sel.nth(0).click();
  await page.waitForTimeout(800);
  await page.getByText(cafe, { exact: false }).first().click();
  await page.waitForTimeout(1500);

  await sel.nth(1).click();
  await page.waitForTimeout(1200);
  await page.locator('.n-base-select-option:visible').nth(nickNo - 1).click();
  await page.waitForTimeout(1500);

  await sel.nth(2).click();
  await page.waitForTimeout(1000);
  await page.locator('.n-base-select-option:visible', { hasText: item.category }).first().click();
  await page.waitForTimeout(2000);

  await page.getByPlaceholder('제목을 입력해주세요').fill(item.title);
  await page.getByText('내용을 입력하세요').first().click();
  await page.keyboard.insertText(item.body);

  await page.locator('input[type="number"]').first().fill(String(views));
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(__dirname, 'v2r-before-submit.png'), fullPage: true });

  await page.getByRole('button', { name: '등록', exact: true }).click();
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: '이동' }).click();
  await page.waitForTimeout(4000);
  const row = await page.locator('table tbody tr').first().innerText().catch(() => '');
  console.log('글목록 맨 위:', row.replace(/\s+/g, ' '));
  console.log('제목 일치:', row.includes(item.title.slice(0, 10)));
  await page.screenshot({ path: path.join(__dirname, 'v2r-after-submit.png') });
  await browser.close();
})();
