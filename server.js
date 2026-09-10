const http = require('http');
const { URL } = require('url');

const server = http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', 'null');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  if (request.method !== 'POST' || request.url !== '/api/notion/database') {
    response.writeHead(404); return response.end(JSON.stringify({ error: '요청 주소를 찾을 수 없습니다.' }));
  }
  let raw = '';
  for await (const chunk of request) raw += chunk;
  try {
    const { token, pageId } = JSON.parse(raw);
    const databaseId = (pageId.match(/[a-f0-9]{32}/i) || [])[0];
    if (!token || !databaseId) throw new Error('노션 페이지 주소 또는 토큰이 올바르지 않습니다.');
    const notionResponse = await fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ page_size: 100 })
    });
    const data = await notionResponse.json();
    if (!notionResponse.ok) throw new Error(data.message || '노션 API가 요청을 거부했습니다.');
    const items = data.results.map((page, index) => {
      const properties = page.properties || {};
      const titleProperty = Object.values(properties).find(property => property.type === 'title');
      const richTextProperty = Object.values(properties).find(property => property.type === 'rich_text');
      const selectProperty = Object.values(properties).find(property => property.type === 'select');
      const title = titleProperty?.title?.map(item => item.plain_text).join('') || `노션 원고 ${index + 1}`;
      const body = richTextProperty?.rich_text?.map(item => item.plain_text).join('') || '';
      const propertyEntries = Object.entries(properties);
      const statusEntry = propertyEntries.find(([name, property]) => property.type === 'status' || (property.type === 'select' && /상태|발행|게시/i.test(name)));
      const checkedEntry = propertyEntries.find(([name, property]) => property.type === 'checkbox' && /발행|완료|게시/i.test(name));
      const statusName = statusEntry?.[1]?.status?.name || statusEntry?.[1]?.select?.name || '';
      const alreadyPublished = checkedEntry?.[1]?.checkbox === true || /완료|발행|게시/i.test(statusName);
      return { id: index + 1, title, body, category: selectProperty?.select?.name || '미분류', status: alreadyPublished ? 'published' : 'ready' };
    });
    response.writeHead(200); response.end(JSON.stringify({ items }));
  } catch (error) {
    response.writeHead(400); response.end(JSON.stringify({ error: error.message }));
  }
});
server.listen(3210, 'localhost', () => console.log('Notion bridge running at http://localhost:3210'));
