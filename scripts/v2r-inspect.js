const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  for (const page of context.pages()) {
    console.log('PAGE', page.url(), '|', await page.title());
  }
  const page = context.pages()[0];
  await page.screenshot({ path: path.join(__dirname, 'v2r-inspect.png') });
  const links = await page.$$eval('a, button', (els) =>
    els.map((e) => (e.innerText || '').trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 60)
  );
  console.log('메뉴/버튼:', JSON.stringify(links));
  await browser.close();
})();
