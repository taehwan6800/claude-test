const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const s = require('../cafe-storage/samples.json');
  const item = (Array.isArray(s) ? s : s.samples).find((x) => x.id === 117);
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('v2r')) || context.pages()[0];
  await page.bringToFront();
  await page.goto('https://v2r.daboja.im/nc/seone');
  await page.waitForTimeout(2500);
  const sel = page.locator('.n-base-selection');
  await sel.nth(0).click();
  await page.waitForTimeout(800);
  await page.getByText(item.cafe).first().click();
  await page.waitForTimeout(1500);
  await sel.nth(1).click();
  await page.waitForTimeout(1200);
  await page.locator('.n-base-select-option:visible').first().click();
  await page.waitForTimeout(1500);
  await sel.nth(2).click();
  await page.waitForTimeout(1000);
  await page.locator('.n-base-select-option:visible', { hasText: item.category }).first().click();
  await page.waitForTimeout(2000);
  await page.getByPlaceholder('제목을 입력해주세요').fill(item.title);
  await page.getByText('내용을 입력하세요').first().click();
  await page.keyboard.insertText(item.body);

  // 댓글: 별명 선택 칸 열기
  const box = page.locator('.create-comment-register');
  await box.scrollIntoViewIfNeeded();
  await box.locator('.n-base-selection').first().click();
  await page.waitForTimeout(1200);
  const opts = await page.$$eval('.n-base-select-option', (els) => els.filter((e) => e.offsetParent).map((e) => e.innerText.replace(/\s+/g, ' ').trim()));
  console.log('댓글 별명 목록:', JSON.stringify(opts));
  await page.locator('.n-base-select-option:visible').nth(1).click();
  await page.waitForTimeout(800);
  await page.getByPlaceholder('댓글을 남겨보세요').fill(item.comments[0].comment);
  await page.screenshot({ path: path.join(__dirname, 'v2r-comment-filled.png') });
  await page.getByText('예약', { exact: true }).last().click();
  await page.waitForTimeout(1500);
  await box.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(__dirname, 'v2r-comment-added.png') });
  await browser.close();
})();
