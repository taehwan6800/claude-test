const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 4500;
const STORAGE_FILE = path.join(__dirname, 'cafe-storage', 'samples.json');
const WEB_FILE = path.join(__dirname, 'cafe-web', 'index.html');
const SETTINGS_FILE = path.join(__dirname, 'cafe-storage', 'v2r-settings.json');

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')); } catch { return { goals: {} }; }
}

function readSamples() {
  if (!fs.existsSync(STORAGE_FILE)) return [];
  return JSON.parse(fs.readFileSync(STORAGE_FILE, 'utf-8'));
}

function writeSamples(samples) {
  fs.writeFileSync(STORAGE_FILE, JSON.stringify(samples, null, 2), 'utf-8');
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return response.end(fs.readFileSync(WEB_FILE, 'utf-8'));
  }

  if (request.method === 'GET' && url.pathname === '/api/samples') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return response.end(JSON.stringify(readSamples()));
  }

  if (request.method === 'GET' && url.pathname === '/api/settings') {
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return response.end(JSON.stringify(readSettings()));
  }

  if (request.method === 'PUT' && url.pathname === '/api/settings') {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    try {
      const { goals } = JSON.parse(raw);
      const clean = {};
      for (const [cafe, n] of Object.entries(goals || {})) {
        const v = Number(n);
        if (!Number.isFinite(v) || v < 0 || v > 500) throw new Error(`${cafe}: 목표는 0~500 사이 숫자여야 해요`);
        clean[cafe] = Math.floor(v);
      }
      const merged = { ...readSettings(), goals: { ...(readSettings().goals || {}), ...clean } };
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf-8');
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return response.end(JSON.stringify(merged));
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return response.end(JSON.stringify({ error: error.message }));
    }
  }

  if (request.method === 'POST' && url.pathname === '/api/samples') {
    let raw = '';
    for await (const chunk of request) raw += chunk;
    try {
      const incoming = JSON.parse(raw);
      const items = Array.isArray(incoming) ? incoming : [incoming];
      const samples = readSamples();
      let nextId = samples.reduce((max, s) => Math.max(max, s.id), 0) + 1;
      const today = new Date().toISOString().slice(0, 10);
      const added = items.map((item) => ({
        id: nextId++,
        category: item.category || '미분류',
        title: item.title || '',
        body: item.body || '',
        createdAt: item.createdAt || today
      }));
      samples.push(...added);
      writeSamples(samples);
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return response.end(JSON.stringify({ added }));
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return response.end(JSON.stringify({ error: error.message }));
    }
  }

  if (request.method === 'PATCH' && url.pathname.startsWith('/api/samples/')) {
    const id = Number(url.pathname.split('/').pop());
    let raw = '';
    for await (const chunk of request) raw += chunk;
    try {
      const { used } = JSON.parse(raw);
      const samples = readSamples();
      const target = samples.find((s) => s.id === id);
      if (!target) {
        response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
        return response.end(JSON.stringify({ error: '해당 글을 찾을 수 없습니다.' }));
      }
      target.used = !!used;
      target.usedAt = used ? new Date().toISOString() : null;
      writeSamples(samples);
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      return response.end(JSON.stringify({ ok: true, sample: target }));
    } catch (error) {
      response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
      return response.end(JSON.stringify({ error: error.message }));
    }
  }

  if (request.method === 'DELETE' && url.pathname.startsWith('/api/samples/')) {
    const id = Number(url.pathname.split('/').pop());
    const samples = readSamples().filter((s) => s.id !== id);
    writeSamples(samples);
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return response.end(JSON.stringify({ ok: true }));
  }

  response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify({ error: '요청 주소를 찾을 수 없습니다.' }));
});

server.listen(PORT, () => console.log(`카페 샘플 저장소 서버 실행 중: http://localhost:${PORT}`));
