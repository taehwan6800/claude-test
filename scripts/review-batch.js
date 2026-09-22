// 새 원고 묶음을 저장하기 전에 검수합니다 (저장소는 바꾸지 않아요).
// 사용법: node scripts/review-batch.js <묶음 파일> <카페 이름>
// 검사: 마침표 / 8어절 중복 / 제목·본문 유사도 / 첫 문장·마무리 반복 / 댓글 비율 / 게시판 분포 / 쓸 수 없는 게시판
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const file = process.argv[2];
const cafe = process.argv[3];
if (!file || !cafe) { console.log('사용법: node scripts/review-batch.js <묶음 파일> <카페 이름>'); process.exit(1); }

const posts = require(path.resolve(file));
const samples = JSON.parse(fs.readFileSync(path.join(ROOT, 'cafe-storage', 'samples.json'), 'utf8'));
const store = Array.isArray(samples) ? samples : samples.samples;

const CAFE_BOARDS = {
  '천안아산 동네사람들': ['자유수다', '질문해요', '우리동네 이야기', '지역 뉴스·행사', '병원·약국·생활업체 후기', '교통·주차·생활팁', '동네 맛집 추천', '카페·디저트 추천', '배달·포장 후기', '오늘의 건강관리', '운동·산책·식단', '건강템 후기'],
  '써본언니들': ['자유수다', '오늘 산 거 자랑', '살까말까?', '내돈내산 후기', '득템·할인정보'],
};
const boards = CAFE_BOARDS[cafe] || [];

const issues = [];
const note = (m) => issues.push(m);
const words = (s) => s.split(/\s+/).filter(Boolean);
const flat = (p) => [p[1], p[2], ...(p[3] || []).flatMap((c) => [c.comment, c.reply || ''])].join(' ');
const tlen = (s) => s.replace(/\s/g, '').length;
const grams = (s) => { const t = s.replace(/[\s\W_~ㅋㅎㅠㅜ!?]/g, ''); const g = new Set(); for (let i = 0; i + 1 < t.length; i++) g.add(t.slice(i, i + 2)); return g; };
const jac = (a, b) => { let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n || 1); };

// 1) 마침표 · 게시판 · 기본 검사
posts.forEach((p, i) => {
  const t = p[1] || `(#${i + 1})`;
  if (JSON.stringify(p).includes('.')) note(`마침표: "${t}"`);
  if (boards.length && !boards.includes(p[0])) note(`이 카페에 없는/쓸 수 없는 게시판 '${p[0]}': "${t}"`);
  if (!p[1] || !p[2]) note(`제목/본문 비어 있음: #${i + 1}`);
});

// 2) 8어절 중복 (저장소 전체 + 묶음 안)
const N = 8;
const known = new Map();
for (const x of store) {
  const w = words(flat([0, x.title, x.body, x.comments || []]));
  for (let i = 0; i + N <= w.length; i++) known.set(w.slice(i, i + N).join(' '), x.id);
}
posts.forEach((p, idx) => {
  const w = words(flat(p)); const seen = new Set();
  for (let i = 0; i + N <= w.length; i++) {
    const g = w.slice(i, i + N).join(' ');
    if (seen.has(g)) continue; seen.add(g);
    if (known.has(g)) note(`8어절 중복 (기존 #${known.get(g)}): "${p[1]}" → ${g}`);
    else known.set(g, `묶음 ${idx + 1}번`);
  }
});

// 3) 제목/본문 유사도 (같은 카페의 기존 글 + 묶음 안)
const same = store.filter((x) => x.cafe === cafe);
posts.forEach((p, i) => {
  const tg = grams(p[1]); const bg = grams(p[2]);
  for (const x of same) {
    if (jac(tg, grams(x.title)) >= 0.5) note(`제목이 비슷함 (기존 #${x.id}): "${p[1]}" ≈ "${x.title}"`);
    if (tlen(p[2]) >= 60 && tlen(x.body) >= 60 && jac(bg, grams(x.body)) >= 0.5) note(`본문이 비슷함 (기존 #${x.id}): "${p[1]}"`);
  }
  for (let j = i + 1; j < posts.length; j++) {
    if (jac(tg, grams(posts[j][1])) >= 0.5) note(`묶음 안에서 제목이 비슷함: "${p[1]}" ≈ "${posts[j][1]}"`);
    if (tlen(p[2]) >= 60 && tlen(posts[j][2]) >= 60 && jac(bg, grams(posts[j][2])) >= 0.5) note(`묶음 안에서 본문이 비슷함: "${p[1]}" ≈ "${posts[j][1]}"`);
  }
});

// 4) 첫 문장 · 마무리 반복
const firstOf = (s) => words(s).slice(0, 3).join(' ');
const tally = (arr) => arr.reduce((m, k) => (m[k] = (m[k] || 0) + 1, m), {});
const firsts = tally(posts.map((p) => firstOf(p[2])));
for (const [k, v] of Object.entries(firsts)) if (v > 1) note(`본문 시작이 같음 ${v}번: "${k}"`);
const storeFirsts = new Set(same.map((x) => firstOf(x.body)));
posts.forEach((p) => { if (storeFirsts.has(firstOf(p[2]))) note(`본문 시작이 기존 글과 같음: "${p[1]}" → "${firstOf(p[2])}"`); });
const ends = tally(posts.map((p) => p[2].trim().slice(-3)));
for (const [k, v] of Object.entries(ends)) if (v >= 4) note(`마무리가 비슷함 ${v}번: "...${k}"`);

// 5) 분포 요약
const cat = tally(posts.map((p) => p[0]));
const none = posts.filter((p) => !(p[3] || []).length).length;
const only = posts.filter((p) => (p[3] || []).length && !p[3][0].reply).length;
const pair = posts.length - none - only;
const lens = posts.map((p) => p[2].length);
const laugh = posts.filter((p) => /ㅋ/.test(p[2])).length, cry = posts.filter((p) => /ㅠ|ㅜ/.test(p[2])).length, tilde = posts.filter((p) => /~|\^\^/.test(p[2])).length;

console.log(`검수 대상: ${cafe} ${posts.length}개`);
console.log('게시판:', JSON.stringify(cat));
console.log(`댓글: 없음 ${none} · 댓글만 ${only} · 댓글+대댓글 ${pair} | 본문 길이 ${Math.min(...lens)}~${Math.max(...lens)}자 | ㅋㅋ ${laugh} · ㅠㅠ ${cry} · ~/^^ ${tilde}`);
if (!issues.length) console.log('결과: 문제 없음 ✅');
else { console.log(`결과: 확인할 것 ${issues.length}건`); issues.forEach((m) => console.log('  - ' + m)); }
