const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('v2r')) || context.pages()[0];
  await page.bringToFront();
  const btn = page.getByRole('button', { name: '이동' });
  if (await btn.count()) await btn.click();
  else await page.goto('https://v2r.daboja.im/nc/board?view=list');
  await page.waitForTimeout(4000);
  const rows = await page.locator('table tbody tr').evaluateAll((els) => els.slice(0, 4).map((e) => e.innerText.replace(/\s+/g, ' ')));
  console.log(rows.join('\n'));
  await page.screenshot({ path: path.join(__dirname, 'v2r-verify.png') });
  await browser.close();
})();
