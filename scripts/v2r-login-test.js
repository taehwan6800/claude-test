require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://v2r.daboja.im/login');
  await page.fill('input[type="text"]', process.env.V2R_ID);
  await page.fill('input[type="password"]', process.env.V2R_PW);
  page.on('response', (res) => {
    if (res.url().includes('login') || res.url().includes('auth') || res.url().includes('api')) {
      console.log('RESPONSE', res.status(), res.url());
    }
  });
  page.on('console', (msg) => console.log('CONSOLE', msg.text()));
  await page.click('button:has-text("로그인")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(__dirname, 'v2r-after-1s.png'), fullPage: true });
  await page.waitForTimeout(4000);
  await page.screenshot({ path: path.join(__dirname, 'v2r-after-login.png'), fullPage: true });
  console.log('현재 URL:', page.url());
  console.log('로그인 후 스크린샷 저장 완료');
  await browser.close();
})();
