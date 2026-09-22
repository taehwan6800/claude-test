const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  let page = context.pages()[0];
  const pagesBefore = context.pages().length;
  const popupPromise = context.waitForEvent('page', { timeout: 4000 }).catch(() => null);
  await page.getByText('SE-ONE 글쓰기').first().click();
  const popup = await popupPromise;
  if (popup) page = popup;
  await page.waitForTimeout(3500);
  console.log('새 탭 열림:', !!popup, '| URL:', page.url());
  await page.screenshot({ path: path.join(__dirname, 'v2r-write.png'), fullPage: true });
  for (const f of page.frames()) {
    const items = await f
      .$$eval('input, textarea, select, button, [contenteditable="true"]', (els) =>
        els.map((e) => ({
          tag: e.tagName,
          type: e.type || '',
          ph: e.placeholder || '',
          text: (e.innerText || '').trim().slice(0, 25),
        }))
      )
      .catch(() => []);
    console.log('FRAME', f.url(), JSON.stringify(items));
  }
  await browser.close();
})();
