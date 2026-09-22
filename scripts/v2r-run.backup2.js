// 자동 글 등록 프로그램
// 사용법: node scripts/v2r-run.js [--per-cafe 50] [--limit N] [--dry]
//   목표 개수는 웹페이지(카페 카드)에서 카페별로 설정하며 cafe-storage/v2r-settings.json에 저장됩니다.
//   --per-cafe  설정이 없는 카페의 기본 하루 목표 (기본 50)
//   등록 시간(07:00~23:30) 안에서 카페별 목표를 고르게 나눠 올립니다 (남은 시간 ÷ 남은 개수).
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
const LIMIT = Number(opt('limit', 0));
const ONLY = opt('only', '');
const FORCE_ID = Number(opt('id', 0)); // 시험용: 특정 글 번호 지정
const OPEN = 7 * 60, CLOSE = 23 * 60 + 30;
const API = 'http://localhost:4500/api/samples';
const STATE = path.join(__dirname, '..', 'cafe-storage', 'v2r-state.json');
const SETTINGS = path.join(__dirname, '..', 'cafe-storage', 'v2r-settings.json');
const LOG = path.join(__dirname, '..', 'cafe-storage', 'v2r-run.log');
const CAFES = ['천안아산 동네사람들', '써본언니들'].filter((c) => !ONLY || c.includes(ONLY));
const EXCLUDE_TAG = { '천안아산 동네사람들': '비실명' }; // 이 표시가 붙은 별명은 글·댓글·좋아요 금지

const log = (m) => { const l = `[${new Date().toLocaleString('ko-KR')}] ${m}`; console.log(l); fs.appendFileSync(LOG, l + '\n'); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }; // 한국 시간 기준 날짜
const minutesNow = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };

// 기록 파일이 '오늘' 수정됐다면 그 기록은 오늘 것 (이 프로그램은 등록 시간 안에서만 기록을 쓰기 때문)
function stateWrittenToday() {
  try {
    const m = fs.statSync(STATE).mtime;
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, '0')}-${String(m.getDate()).padStart(2, '0')}` === today();
  } catch { return false; }
}
function loadState() {
  let s = {};
  try { s = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch {}
  if (s.date !== today() && stateWrittenToday()) s.date = today();
  if (s.date !== today()) s = { date: today(), done: {}, lastAt: {}, nickIdx: s.nickIdx || {}, cmtIdx: s.cmtIdx || {} };
  s.lastAt = s.lastAt || {};
  return s;
}
const saveState = (s) => fs.writeFileSync(STATE, JSON.stringify(s, null, 2));

// 카페별 하루 목표 (웹페이지에서 바꾸면 다음 차례부터 바로 반영)
function loadGoals() {
  let g = {};
  try { g = JSON.parse(fs.readFileSync(SETTINGS, 'utf8')).goals || {}; } catch {}
  const out = {};
  for (const c of CAFES) { const n = Number(g[c]); out[c] = Number.isFinite(n) && n >= 0 ? Math.floor(n) : PER_CAFE; }
  return out;
}

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

let submitClicked = false; // '등록' 버튼을 누른 뒤에는 자동 재시도하지 않음 (중복 등록 방지)
async function postOne(page, item, state) {
  submitClicked = false;
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
  submitClicked = true;
  await page.getByRole('button', { name: '등록', exact: true }).first().click();
  await page.waitForTimeout(3500);
  await page.getByRole('button', { name: '이동' }).click();
  await page.waitForTimeout(4000);
  // 글목록이 새로 고쳐지는 데 시간이 걸릴 수 있어서, 맨 위 5줄을 최대 6번(약 40초) 다시 읽어 확인
  let ok = false, row = '';
  for (let k = 0; k < 6 && !ok; k++) {
    if (k > 0) { await page.waitForTimeout(6000); await page.reload(); await page.waitForTimeout(3000); }
    const rows = await page.locator('table tbody tr').evaluateAll((els) => els.slice(0, 5).map((e) => e.innerText.replace(/\s+/g, ' '))).catch(() => []);
    row = rows[0] || '';
    ok = rows.some((r) => r.includes(item.title.slice(0, 10)) && r.includes(cafe.slice(0, 4)));
  }
  log(`글목록 맨 위: ${row.slice(0, 120)} → ${ok ? '확인됨' : '확인 실패'}`);
  if (!ok) throw new Error('등록 확인에 실패했어요. 중복을 막기 위해 멈춥니다.');
  await fetch(`${API}/${item.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ used: true }) });
  return true;
}

(async () => {
  log(`시작 | ${DRY ? '시험 모드' : '실제 등록'}${LIMIT ? ` | 최대 ${LIMIT}개` : ''} | 목표: ${JSON.stringify(loadGoals())}`);
  const browser = await chromium.connectOverCDP('http://localhost:9222').catch(() => null);
  if (!browser) { log('크롬(9222)에 연결하지 못했어요. 로그인된 크롬 창이 켜져 있는지 확인해 주세요.'); process.exit(1); }
  // 탭이 닫혀도 다시 찾아서(없으면 새로 열어서) 이어가기 위해 매번 새로 가져옴
  const getPage = async () => {
    const ctx = browser.contexts()[0];
    const found = ctx.pages().find((p) => !p.isClosed() && p.url().includes('v2r'));
    if (found) return found;
    const fresh = await ctx.newPage();
    await fresh.goto('https://v2r.daboja.im/nc/dashboard');
    return fresh;
  };
  let page = await getPage();
  await page.bringToFront();
  let closedRetries = 0;
  const state = DRY ? { date: today(), done: {}, lastAt: {}, nickIdx: {}, cmtIdx: {} } : loadState();
  let count = 0;
  let noManuscriptLoggedAt = 0;
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

    let item = null;
    if (DRY) {
      if (FORCE_ID) { const all = await (await fetch(API)).json(); item = all.find((x) => x.id === FORCE_ID); }
      if (!item) for (const cafe of CAFES) { const list = await unusedFor(cafe); if (list.length) { item = list[0]; break; } }
      if (!item) { log('원고가 없어요'); break; }
    } else {
      // 카페별 다음 등록 시각 = (마지막 등록 시각) + (남은 시간 ÷ 남은 개수)
      const goals = loadGoals();
      const now = Date.now();
      const d = new Date();
      const closeMs = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(CLOSE / 60), CLOSE % 60).getTime();
      const cands = [];
      for (const c of CAFES) {
        const remain = (goals[c] || 0) - (state.done[c] || 0);
        if (remain <= 0) continue;
        const spacing = Math.max(closeMs - now, 60000) / remain;
        const due = state.lastAt[c] ? Math.max(state.lastAt[c] + spacing, now - 1) : now;
        cands.push({ c, due, spacing });
      }
      if (!cands.length) {
        log('오늘 목표를 모두 채웠어요. 목표를 늘리면 이어서 등록해요 (5분마다 확인)');
        await sleep(5 * 60 * 1000);
        Object.assign(state, loadState());
        continue;
      }
      cands.sort((a, b) => a.due - b.due);
      const next = cands[0];
      if (next.due > now + 1000) { await sleep(Math.min(next.due - now, 60 * 1000)); continue; } // 1분마다 목표 다시 읽으며 기다림
      const list = await unusedFor(next.c);
      if (!list.length) {
        if (now - noManuscriptLoggedAt > 30 * 60 * 1000) { log(`${next.c}: 안 쓴 원고가 없어요 (원고를 더 만들어 주세요)`); noManuscriptLoggedAt = now; }
        state.lastAt[next.c] = now; // 이 카페는 잠시 건너뜀
        await sleep(30 * 1000);
        continue;
      }
      item = list[0];
    }

    log(`글 #${item.id} [${item.cafe} / ${item.category}] ${item.title}`);
    try {
      page = await getPage();
      await postOne(page, item, state);
      closedRetries = 0;
    } catch (e) {
      if (!submitClicked && /closed|Target/i.test(e.message) && closedRetries < 3) {
        // 글이 올라가기 전에 탭이 닫힌 경우만 다시 시도 (등록 뒤 확인 단계 오류는 중복을 막기 위해 아래에서 멈춤)
        closedRetries++;
        log(`탭이 닫혀서 다시 찾는 중이에요 (${closedRetries}/3): ${e.message.slice(0, 80)}`);
        await sleep(20 * 1000);
        continue;
      }
      log('오류: ' + e.message);
      break;
    }
    state.done[item.cafe] = (state.done[item.cafe] || 0) + 1;
    state.nickIdx[item.cafe] = (state.nickIdx[item.cafe] || 0) + 1;
    state.lastAt[item.cafe] = Date.now();
    if (!DRY) saveState(state);
    count++;
    if (DRY) { if (count >= (LIMIT || 1)) break; continue; }
    const goals = loadGoals();
    log(`오늘 진행: ${CAFES.map((c) => `${c} ${state.done[c] || 0}/${goals[c]}`).join(' · ')}`);
  }
  log('종료');
  await browser.close();
})();
