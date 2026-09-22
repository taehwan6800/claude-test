// 새로 만든 원고 묶음을 원고 저장소(cafe-storage/samples.json)와 카페글_기록.md에 저장합니다.
// 사용법: node scripts/save-batch.js <묶음 파일 경로> <카페 이름>
//   묶음 파일은 module.exports = [[게시판, 제목, 본문, 댓글배열], ...] 형태입니다.
// 문제가 있는 글은 버리지 않고 고쳐서 저장합니다.
//   - 마침표(.)가 들어 있으면 마침표만 지웁니다.
//   - 이미 있는 제목이면 끝에 자연스러운 표시(~, ㅎㅎ 등)를 붙여 겹치지 않게 합니다.
//   - 댓글 칸이 없거나 잘못되어 있으면 "댓글 없음"으로 처리합니다.
//   - 제목·본문·게시판이 비어 있어 고칠 수 없는 글만 건너뜁니다.
// 무엇을 고쳤는지는 모두 화면에 알려줍니다.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const STORE = path.join(ROOT, 'cafe-storage', 'samples.json');
const LOG = path.join(ROOT, '카페글_기록.md');
const file = process.argv[2];
const cafe = process.argv[3] || '써본언니들';
if (!file) { console.log('사용법: node scripts/save-batch.js <묶음 파일> <카페 이름>'); process.exit(1); }

const posts = require(path.resolve(file));
const samples = JSON.parse(fs.readFileSync(STORE, 'utf8'));
const list = Array.isArray(samples) ? samples : samples.samples;

const stripDots = (s) => (typeof s === 'string' ? s.replace(/\./g, '') : s);
const SUFFIXES = ['~', 'ㅎㅎ', 'ㅋㅋ', '!', 'ㅠㅠ', '~~'];

const ok = [];
const fixes = [];
const skipped = [];
const seenTitles = new Set(list.map((x) => x.title));

for (const p of posts) {
  let [category, title, body, comments] = p;
  const label = title || '(제목 없음)';
  if (!category || !title || !body) { skipped.push({ title: label, reason: '제목·본문·게시판이 비어 있어 고칠 수 없어요' }); continue; }

  // 댓글 모양 정리
  if (!Array.isArray(comments)) { comments = []; fixes.push(`"${label}": 댓글 칸이 없어서 댓글 없음으로 처리`); }
  comments = comments.filter((c) => c && c.comment);

  // 마침표 제거
  const before = JSON.stringify([category, title, body, comments]);
  if (before.includes('.')) {
    category = stripDots(category); title = stripDots(title); body = stripDots(body);
    comments = comments.map((c) => (c.reply ? { comment: stripDots(c.comment), reply: stripDots(c.reply) } : { comment: stripDots(c.comment) }));
    fixes.push(`"${label}": 마침표를 지웠어요`);
  }

  // 제목 겹침 해결
  if (seenTitles.has(title)) {
    const s = SUFFIXES.find((x) => !seenTitles.has(title + x));
    if (!s) { skipped.push({ title, reason: '겹치는 제목을 고칠 수 없었어요' }); continue; }
    fixes.push(`"${title}": 이미 있는 제목이라 끝에 "${s}"을(를) 붙였어요`);
    title += s;
  }
  seenTitles.add(title);
  ok.push([category, title, body, comments]);
}

if (ok.length) {
  const today = new Date();
  const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  let id = Math.max(...list.map((x) => x.id));
  for (const [category, title, body, comments] of ok) {
    list.push({ id: ++id, category, title, body, comments, createdAt: date, used: false, usedAt: null, cafe });
  }
  fs.writeFileSync(STORE, JSON.stringify(samples, null, 2), 'utf8');
  let md = `\n## ${date} (${cafe} 추가 ${ok.length}개)\n`;
  for (const p of ok) md += `- [${p[0]}] ${p[1]}\n`;
  fs.appendFileSync(LOG, md, 'utf8');
}

const count = (f) => ok.filter(f).length;
console.log(`저장 ${ok.length}개 / 고쳐서 저장 ${fixes.length}건 / 건너뜀 ${skipped.length}개 | 댓글 없음 ${count((p) => !p[3].length)} · 댓글만 ${count((p) => p[3].length && !p[3][0].reply)} · 댓글+대댓글 ${count((p) => p[3].length && p[3][0].reply)} | 전체 ${list.length} | 안 쓴 ${cafe} ${list.filter((x) => !x.used && x.cafe === cafe).length}`);
for (const f of fixes) console.log('  고침: ' + f);
for (const s of skipped) console.log(`  건너뜀: "${s.title}" - ${s.reason}`);
