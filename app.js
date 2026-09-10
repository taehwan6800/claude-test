const drafts = [
  { id: 1, title: '요즘 부쩍 날씨가 너무 이상하지 않나요~!', category: '자유수다', status: 'ready', body: '요즘 날씨가 정말 예전과 다른 것 같아요. 여러분이 느끼는 날씨 이야기도 궁금합니다.' },
  { id: 2, title: '드디어 찜해두던 무선 이어폰 샀어요!!', category: '오늘 산 거 자랑', status: 'ready', body: '계속 고민만 하다가 드디어 무선 이어폰을 샀어요. 직접 써보니 생각보다 만족스러운 점이 많아서 공유해 봅니다.' },
  { id: 3, title: '10만 원대 공기청정기 믿어도 될까요~!', category: '살까말까?', status: 'ready', body: '10만 원대 공기청정기를 살까 고민 중입니다. 사용해 보신 분들의 솔직한 의견을 듣고 싶어요.' },
  { id: 4, title: '유명 유튜버 추천 샴푸 한 달 써봤어요', category: '내돈내산 후기', status: 'published', body: '한 달 동안 꾸준히 사용해 본 샴푸 후기를 정리해 봤습니다.' },
  { id: 5, title: '앱 첫 다운로드 쿠폰으로 반값에 산 방법 알려드려요!!', category: '득템·할인정보', status: 'published', body: '앱 첫 다운로드 쿠폰을 활용해서 알뜰하게 구매한 방법을 알려드릴게요.' }
];
const records = [
  ['유명 유튜버 추천 샴푸 한 달 써봤어요','2026.09.08','1,248','52','18','4'],
  ['앱 첫 다운로드 쿠폰으로 반값에 산 방법 알려드려요!!','2026.09.07','932','41','12','2'],
  ['드디어 찜해두던 무선 이어폰 샀어요!!','2026.09.06','—','—','—','—']
];
const $ = (id) => document.getElementById(id);
const defaultNotionPageId = '075c69f756234013bef9664ba130e6b8';
const savedNotionPageId = localStorage.getItem('notion_page_id');
const notionConfig = {
  token: localStorage.getItem('notion_token') || '',
  pageId: savedNotionPageId && savedNotionPageId !== '3a3fac64665c8145894fe12366c8c5b4' ? savedNotionPageId : defaultNotionPageId
};
let wizardStep = 1;
let wizardDraft = null;
let wizardCafe = '';
function renderDrafts() {
  const query = $('searchInput').value.toLowerCase();
  const filter = $('statusFilter').value;
  $('draftList').innerHTML = drafts.filter(d => d.title.toLowerCase().includes(query) && (filter === 'all' || d.status === filter)).map(d => `
    <div class="draft-item ${d.id === 1 ? 'selected' : ''}" data-id="${d.id}">
      <div class="draft-title">${d.title}</div><div class="draft-meta"><span>${d.category}</span><span class="badge ${d.status === 'published' ? 'done' : ''}">${d.status === 'published' ? '발행 완료' : '발행 대기'}</span></div>
    </div>`).join('') || '<p class="helper">조건에 맞는 원고가 없습니다.</p>';
  document.querySelectorAll('.draft-item').forEach(item => item.addEventListener('click', () => selectDraft(Number(item.dataset.id))));
}
function selectDraft(id) {
  const draft = drafts.find(d => d.id === id);
  document.querySelectorAll('.draft-item').forEach(item => item.classList.toggle('selected', Number(item.dataset.id) === id));
  $('titleInput').value = draft.title; $('bodyInput').value = draft.body; $('saveState').textContent = '자동 저장됨';
}
function renderRecords() {
  $('analyticsTable').innerHTML = records.map(r => `<tr><td>${r[0]}</td><td>${r[1]}</td>${r.slice(2).map(v => `<td>${v}</td>`).join('')}<td class="table-status">${r[2] === '—' ? '기록 필요' : '발행 완료'}</td></tr>`).join('');
}
function renderWizard() {
  const content = $('wizardContent');
  $('stepNumber').textContent = wizardStep;
  document.querySelectorAll('.step-indicator span').forEach((step, index) => step.classList.toggle('current', index + 1 === wizardStep));
  $('wizardBack').hidden = wizardStep === 1;
  $('wizardNext').disabled = wizardStep === 1 ? !wizardDraft : wizardStep === 2 ? !wizardCafe : false;
  if (wizardStep === 1) {
    $('wizardTitle').textContent = '발행할 원고를 선택하세요';
    $('wizardHelp').textContent = '노션에서 불러온 원고 중 하나를 클릭하면 됩니다.';
    content.innerHTML = drafts.filter(d => d.status === 'ready').slice(0, 6).map(d => `<div class="wizard-card ${wizardDraft?.id === d.id ? 'selected' : ''}" data-wizard-id="${d.id}"><strong>${d.title}</strong><small>${d.category}</small></div>`).join('');
    content.querySelectorAll('[data-wizard-id]').forEach(card => card.addEventListener('click', () => { wizardDraft = drafts.find(d => d.id === Number(card.dataset.wizardId)); renderWizard(); }));
  } else if (wizardStep === 2) {
    $('wizardTitle').textContent = '어느 카페에 발행할까요?';
    $('wizardHelp').textContent = '한 곳을 선택하세요.';
    content.innerHTML = `<div class="wizard-choice-grid">${['써본언니들','천안아산 동네사람들'].map(cafe => `<div class="wizard-choice ${wizardCafe === cafe ? 'selected' : ''}" data-wizard-cafe="${cafe}">${cafe}</div>`).join('')}</div>`;
    content.querySelectorAll('[data-wizard-cafe]').forEach(card => card.addEventListener('click', () => { wizardCafe = card.dataset.wizardCafe; renderWizard(); }));
  } else {
    $('wizardTitle').textContent = '발행 내용을 확인하세요';
    $('wizardHelp').textContent = '내용을 확인한 뒤 발행하기를 누르세요.';
    content.innerHTML = `<div class="wizard-summary"><div><strong>원고</strong>${wizardDraft.title}</div><div><strong>카페</strong>${wizardCafe}</div><div><strong>방식</strong>SE-ONE 글쓰기</div></div>`;
    $('wizardNext').textContent = 'V2R로 보내기';
  }
}
$('wizardNext').addEventListener('click', () => {
  if (wizardStep < 3) { wizardStep += 1; renderWizard(); return; }
  $('titleInput').value = wizardDraft.title; $('bodyInput').value = wizardDraft.body;
  document.querySelectorAll('input[name="cafe"]').forEach(input => { input.checked = input.value === wizardCafe; });
  $('sendToV2r').click();
});
$('wizardBack').addEventListener('click', () => { wizardStep -= 1; renderWizard(); });
function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); setTimeout(() => $('toast').classList.remove('show'), 2600); }
$('searchInput').addEventListener('input', renderDrafts); $('statusFilter').addEventListener('change', renderDrafts);
$('refreshDrafts').addEventListener('click', () => { renderDrafts(); toast('노션 원고 목록을 새로고침했습니다.'); });
$('connectNotion').addEventListener('click', () => {
  $('notionToken').value = notionConfig.token;
  $('notionPageId').value = notionConfig.pageId;
  $('notionDialog').showModal();
});
$('saveNotion').addEventListener('click', (event) => {
  const token = $('notionToken').value.trim();
  const pageId = $('notionPageId').value.trim();
  if (!token || !pageId) {
    event.preventDefault();
    return toast('토큰과 노션 페이지 주소를 모두 입력해 주세요.');
  }
  notionConfig.token = token; notionConfig.pageId = pageId;
  localStorage.setItem('notion_token', token); localStorage.setItem('notion_page_id', pageId);
  setTimeout(() => loadNotionDrafts(), 0);
});
$('loadNotion').addEventListener('click', loadNotionDrafts);
async function loadNotionDrafts() {
  if (!notionConfig.token) return $('notionDialog').showModal();
  toast('노션 원고를 불러오는 중입니다.');
  try {
    const response = await fetch('http://localhost:3210/api/notion/database', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ token: notionConfig.token, pageId: notionConfig.pageId })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || '노션 연결에 실패했습니다.');
    drafts.splice(0, drafts.length, ...result.items);
    $('draftCount').textContent = result.items.filter(item => item.status === 'ready').length;
    renderDrafts();
    if (result.items[0]) selectDraft(result.items[0].id);
    toast(`${result.items.length}개의 노션 원고를 불러왔습니다.`);
  } catch (error) {
    toast(error.message);
  }
}
$('sendToV2r').addEventListener('click', async () => {
  const title = $('titleInput').value.trim();
  const body = $('bodyInput').value.trim();
  if (!title || !body) return toast('제목과 본문을 먼저 입력해 주세요.');
  const cafes = [...document.querySelectorAll('input[name="cafe"]:checked')].map(input => input.value);
  const nicknames = $('nicknameInput').value.split(',').map(value => value.trim()).filter(Boolean);
  if (!cafes.length) return toast('발행할 카페를 하나 이상 선택해 주세요.');
  if (!nicknames.length) return toast('사용할 별명을 한 개 이상 입력해 주세요.');
  try {
    await navigator.clipboard.writeText(`작성 방식: ${$('writeMode').value}\n발행 카페: ${cafes.join(', ')}\n사용 별명 순서: ${nicknames.join(' → ')}\n\n제목: ${title}\n\n${body}`);
    window.open('https://v2r.daboja.im/', '_blank', 'noopener');
    toast('원고와 발행 설정을 복사했습니다. V2R에서 확인해 주세요.');
  } catch (error) {
    window.open('https://v2r.daboja.im/', '_blank', 'noopener');
    toast('V2R을 열었습니다. 제목과 본문을 직접 복사해 주세요.');
  }
});
$('publishButton').addEventListener('click', () => { if (!$('titleInput').value.trim() || !$('bodyInput').value.trim()) return toast('제목과 본문을 먼저 입력해 주세요.'); toast('발행 요청을 저장했습니다. 네이버 로그인 연결 후 실제 발행됩니다.'); });
$('addRecord').addEventListener('click', () => toast('성과 기록 기능을 준비 중입니다.'));
['titleInput','bodyInput'].forEach(id => $(id).addEventListener('input', () => $('saveState').textContent = '저장 중...'));
renderDrafts(); renderRecords(); selectDraft(1); renderWizard();
