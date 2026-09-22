const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const context = await chromium.launchPersistentContext(
    path.join(__dirname, '..', 'cafe-storage', 'v2r-profile'),
    { headless: false, args: ['--remote-debugging-port=9222'] }
  );
  const page = context.pages()[0] || (await context.newPage());
  await page.goto('https://v2r.daboja.im/login');
  console.log('브라우저 열림 - 로그인을 기다리는 중');
  await new Promise(() => {});
})();
