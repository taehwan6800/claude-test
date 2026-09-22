// 자동 글 등록 프로그램
// 사용법: node scripts/v2r-run.js [--per-cafe 50] [--interval 10] [--limit N] [--dry]
//   --per-cafe  카페마다 하루 등록할 개수 (기본 50)
//   --interval  글과 글 사이 간격(분, 기본 10)
//   --limit     이번 실행에서 최대 몇 개까지만 (시험용)
//   --only      한 카페만 (이름 일부, 예: --only 써본)
//   --id        (시험용) 특정 글 번호로 진행
//   --dry       입력만 해보고 '등록'은 누르지 않음 (시간 제한 없음, 저장소 변경 없음)
// 등록 가능 시간: 07:00 ~ 23:30 (그 밖에는 07:00까지 기다림, --dry 제외)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const DRY = args.includes('--dry');
const PER_CAFE = Number(opt('per-cafe', 50));
const INTERVAL = Number(opt('interval', 10));
const LIMIT = Number(opt('limit', 0));
const ONLY = opt('only', '');
const FORCE_ID = Number(opt('id', 0)); // 시험용: 특정 글 번호 지정
const OPEN = 7 * 60, CLOSE = 23 * 60 + 30;
const API = 'http://localhost:4500/api/samples';
const STATE = path.join(__dirname, '..', 'cafe-storage', 'v2r-state.json');
const LOG = path.join(__dirname, '..', 'cafe-storage', 'v2r-run.log');
const CAFES = ['천안아산 동네사람들', '써본언니들'].filter((c) => !ONLY || c.includes(ONLY));
const EXCLUDE_TAG = { '천안아산 동네사람들': '비실명' }; // 이 표시가 붙은 별명은 글·댓글·좋아요 금지

const log = (m) => { const l = `[${new Date().toLocaleString('ko-KR')}] ${m}`; console.log(l); fs.appendFileSync(LOG, l + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }; // 한국 시간 기준 날짜
const minutesNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

function loadState() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch {}
  if (s.date !== today()) s = { date: today(), done: {}, nickIdx: s.nickIdx || {}, cmtIdx: s.cmtIdx || {} };
  return s;
}
const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));

async function unusedFor(cafe) {
  const res = await fetch(API);
  const all = await res.json();
  return all.filter((x) => !x.used && x.cafe === cafe).sort((a, b) => a.id - b.id);
}

// 별명 목록 (드롭다운이 열려 있다고 가정). 반환: [{text, nick, id, idx}]
async function readNickOptions(page, cafe) {
  const texts = (await page.locator('.n-base-select-option:visible').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  const tag = EXCLUDE_TAG[cafe];
  return texts.map((text, idx) => {
    const [nick, id] = text.split(' ');
    return { text, nick, id, idx, excluded: !!(tag && text.includes(tag)), author: text.includes('작성자') };
  });
}

async function pickOption(page, idx) {
  await page.locator('.n-base-select-option:visible').nth(idx).click();
  await page.waitForTimeout(1200);
}

async function pickLikes(page, blocked) {
  const k = rnd(0, 2);
  if (!k) return [];
  const pager = page.locator('.like-pagination-btns');
  const names = async () => page.locator('.like-btn p.cXzSBx').allInnerTexts();
  await pager.scrollIntoViewIfNeeded().catch(() => {});
  const pages = [];
  for (let i = 0; i < 12; i++) {
    const n = await names();
    if (pages.length && JSON.stringify(pages.at(-1)) === JSON.stringify(n)) break;
    pages.push(n);
    await pager.locator('.right-btn').click().catch(() => {});
    await page.waitForTimeout(400);
  }
  for (let i = 0; i < pages.length; i++) { await pager.locator('.left-btn').click().catch(() => {}); await page.waitForTimeout(150); }
  const pool = [];
  pages.forEach((list, pi) => list.forEach((n) => { if (!blocked.has(n)) pool.push({ n, pi }); }));
  const chosen = [];
  while (chosen.length < k && pool.length) chosen.push(pool.splice(rnd(0, pool.length - 1), 1)[0]);
  chosen.sort((a, b) => a.pi - b.pi);
  let cur = 0;
  for (const c of chosen) {
    while (cur < c.pi) { await pager.locator('.right-btn').click(); await page.waitForTimeout(400); cur++; }
    await page.locator('.like-btn', { hasText: c.n }).first().click();
    await page.waitForTimeout(600);
  }
  return chosen.map((c) => c.n);
}

async function postOne(page, item, state) {
  const cafe = item.cafe;
  await page.goto('https://v2r.daboja.im/nc/seone');
  await page.waitForTimeout(2500);
  if (page.url().includes('/login')) throw new Error('로그인이 풀렸어요. 크롬에서 다시 로그인해 주세요.');
  const sel = page.locator('.n-base-selection');

  await sel.nth(0).click();
  await page.waitForTimeout(800);
  await page.getByText(cafe).first().click();
  await page.waitForTimeout(1500);

  // 글쓴이 별명: 카페별로 차례대로 (제외 표시 별명은 건너뜀)
  await sel.nth(1).click();
  await page.waitForTimeout(1200);
  const opts = await readNickOptions(page, cafe);
  const eligible = opts.filter((o) => !o.excluded);
  if (!eligible.length) throw new Error('쓸 수 있는 별명이 없어요');
  const author = eligible[(state.nickIdx[cafe] || 0) % eligible.length];
  if (author.excluded) throw new Error('제외 별명이 선택되려 했어요');
  await pickOption(page, author.idx);
  log(`글쓴이 별명: ${author.text}`);

  await sel.nth(2).click();
  await page.waitForTimeout(1000);
  const boardOpt = page.locator('.n-base-select-option:visible').filter({ hasText: item.category }).first();
  if (!(await boardOpt.count())) throw new Error(`게시판 '${item.category}' 이(가) ${cafe}에 없어요`);
  await boardOpt.click();
  await page.waitForTimeout(2000);

  await page.getByPlaceholder('제목을 입력해주세요').fill(item.title);
  await page.getByText('내용을 입력하세요').first().click();
  await page.keyboard.insertText(item.body);

  // 좋아요 (0~2개, 글쓴이·제외 별명 빼고)
  const blocked = new Set([author.nick, author.id, ...opts.filter((o) => o.excluded).flatMap((o) => [o.nick, o.id])]);
  const liked = await pickLikes(page, blocked);
  log(`좋아요: ${liked.length ? liked.join(', ') : '없음'}`);

  // 댓글 / 대댓글
  const c = (item.comments || [])[0];
  if (c && c.comment) {
    const box = page.locator('.create-comment-register').first();
    await box.scrollIntoViewIfNeeded();
    await box.locator('.n-base-selection').first().click();
    await page.waitForTimeout(900);
    const copts = await readNickOptions(page, cafe);
    const others = copts.filter((o) => !o.excluded && !o.author);
    const cm = others[(state.cmtIdx[cafe] || 0) % others.length];
    await pickOption(page, cm.idx);
    await box.getByPlaceholder('댓글을 남겨보세요').fill(c.comment);
    await box.locator('button', { hasText: '예약' }).first().click();
    await page.waitForTimeout(1500);
    log(`댓글: ${cm.text}`);
    state.cmtIdx[cafe] = (state.cmtIdx[cafe] || 0) + 1;

    if (c.reply) {
      await page.getByText('답글쓰기', { exact: true }).first().click();
      await page.waitForTimeout(1200);
      const rbox = page.locator('.create-comment-register').first();
      await rbox.locator('.n-base-selection').first().click();
      await page.waitForTimeout(900);
      const ropts = await readNickOptions(page, cafe);
      const au = ropts.find((o) => o.author);
      if (!au || au.excluded) throw new Error('대댓글 작성자를 찾지 못했어요');
      await pickOption(page, au.idx);
      await rbox.getByPlaceholder('댓글을 남겨보세요').fill(c.reply);
      await rbox.locator('button', { hasText: '예약' }).first().click();
      await page.waitForTimeout(1500);
      log(`대댓글: ${au.text}`);
    }
  }

  const views = rnd(12, 25);
  const num = page.locator('input[type="number"]').first();
  await num.scrollIntoViewIfNeeded();
  await num.fill(String(views));
  log(`조회수 올리기: ${views}`);

  if (DRY) {
    await page.screenshot({ path: path.join(__dirname, 'v2r-dry.png'), fullPage: false });
    log('(시험 모드) 등록은 누르지 않았어요');
    return true;
  }

  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole('button', { name: '등록', exact: true }).first().click();
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: '이동' }).click();
  await page.waitForTimeout(4000);
  const row = (await page.locator('table tbody tr').first().innerText().catch(() => '')).replace(/\s+/g, ' ');
  const ok = row.includes(item.title.slice(0, 10)) && row.includes(cafe.slice(0, 4));
  log(`글목록 맨 위: ${row.slice(0, 120)} → ${ok ? '확인됨' : '확인 실패'}`);
  if (!ok) throw new Error('등록 확인에 실패했어요. 중복을 막기 위해 멈춥니다.');
  await fetch(`${API}/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ used: true }) });
  return true;
}

(async () => {
  log(`시작 | 카페당 ${PER_CAFE}개 | 간격 ${INTERVAL}분 | ${DRY ? '시험 모드' : '실제 등록'}${LIMIT ? ` | 최대 ${LIMIT}개` : ''}`);
  const browser = await chromium.connectOverCDP('http://localhost:9222').catch(() => null);
  if (!browser) { log('크롬(9222)에 연결하지 못했어요. 로그인된 크롬 창이 켜져 있는지 확인해 주세요.'); process.exit(1); }
  const page = browser.contexts()[0].pages().find((p) => p.url().includes('v2r')) || browser.contexts()[0].pages()[0];
  await page.bringToFront();
  const state = DRY ? { date: today(), done: {}, nickIdx: {}, cmtIdx: {} } : loadState();
  let count = 0;
  while (true) {
    if (LIMIT && count >= LIMIT) break;
    if (!DRY) {
      const m = minutesNow();
      if (m < OPEN || m >= CLOSE) {
        const wait = m < OPEN ? OPEN - m : 24 * 60 - m + OPEN;
        log(`등록 시간(07:00~23:30)이 아니에요. ${Math.floor(wait / 60)}시간 ${wait % 60}분 뒤에 다시 시작해요.`);
        await sleep(wait * 60 * 1000);
        Object.assign(state, loadState());
        continue;
      }
    }
    const todo = CAFES.filter((c) => (state.done[c] || 0) < PER_CAFE).sort((a, b) => (state.done[a] || 0) - (state.done[b] || 0));
    let item = null;
    if (FORCE_ID) { const all = await (await fetch(API)).json(); item = all.find((x) => x.id === FORCE_ID); }
    if (!item) for (const cafe of todo) { const list = await unusedFor(cafe); if (list.length) { item = list[0]; break; } log(`${cafe}: 안 쓴 원고가 없어요`); }
    if (!item) { log('오늘 할 일이 끝났어요 (또는 원고가 없어요)'); break; }
    log(`글 #${item.id} [${item.cafe} / ${item.category}] ${item.title}`);
    try {
      await postOne(page, item, state);
    } catch (e) {
      log('오류: ' + e.message);
      break;
    }
    state.done[item.cafe] = (state.done[item.cafe] || 0) + 1;
    state.nickIdx[item.cafe] = (state.nickIdx[item.cafe] || 0) + 1;
    if (!DRY) saveState(state);
    count++;
    if (DRY) { if (count >= (LIMIT || 1)) break; continue; }
    log(`오늘 진행: ${CAFES.map((c) => `${c} ${state.done[c] || 0}/${PER_CAFE}`).join(' · ')} | ${INTERVAL}분 쉬어요`);
    await sleep(INTERVAL * 60 * 1000);
  }
  log('종료');
  await browser.close();
})();
