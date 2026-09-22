const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('http://localhost:9222');
  const context = browser.contexts()[0];
  const page = context.pages().find((p) => p.url().includes('v2r')) || context.pages()[0];
  const names = async () => page.locator('.like-btn p.cXzSBx').allInnerTexts();
  const wrap = page.locator('.like-btn').first().locator('xpath=ancestor::div[contains(@class,"kzfzrj")][1]');
  const html = await wrap.evaluate((e) => e.outerHTML.replace(/<svg[\s\S]*?<\/svg>/g, '<svg/>').replace(/\s+/g, ' '));
  const i = 0;
  console.log('끝부분:', html.slice(-1400));
  console.log('1페이지:', JSON.stringify(await names()));
  await browser.close();
})();
