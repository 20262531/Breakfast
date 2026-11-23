import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { validateReviewBatch } from './package-review.js';
import { reviewWithOpenAI } from './openai-package-review.js';

const assets = new Set([
  'index.html', 'app.js', 'auto-backup.js', 'style.css', 'domain.js', 'local-store.js',
  'phase-reports.js', 'store.js', 'pdf-import.js', 'pdf-workflow.js', 'package-review.js',
  'icon.svg', 'manifest.webmanifest', 'sample-guests.csv', 'sw.js',
  'fonts/noto-sans-thai-thai-400-normal.woff2', 'fonts/noto-sans-thai-thai-600-normal.woff2',
  'vendor/xlsx.full.min.js', 'vendor/pdfjs/pdf.min.mjs', 'vendor/pdfjs/pdf.worker.min.mjs'
]);
const mime = {
  html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8',
  mjs: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8',
  svg: 'image/svg+xml', webmanifest: 'application/manifest+json', csv: 'text/csv; charset=utf-8',
  woff2: 'font/woff2'
};

function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
}

async function readEntries(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req.iterator({ destroyOnReturn: false })) {
    size += chunk.length;
    if (size > 150000) {
      req.resume();
      return null;
    }
    chunks.push(chunk);
  }
  try {
    const entries = JSON.parse(Buffer.concat(chunks)).entries;
    return validateReviewBatch(entries) ? entries : null;
  } catch {
    return null;
  }
}

export function createBreakfastServer({ apiKey, model = 'gpt-5-mini', review = reviewWithOpenAI } = {}) {
  let busy = false;
  const server = createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const host = '127.0.0.1:' + server.address().port;
    if (req.headers.host !== host) return json(res, 403, { error: 'เปิดผ่าน http://' + host });
    const pathname = req.url.split('?', 1)[0];
    if (pathname === '/api/package-review') {
      if (req.method !== 'POST' || req.headers.origin !== 'http://' + host
        || req.headers['content-type'] !== 'application/json') {
        return json(res, 403, { error: 'เปิดแอปจาก URL ของเครื่องนี้' });
      }
      if (!apiKey) return json(res, 503, { error: 'ยังไม่ได้ตั้งค่า OPENAI_API_KEY ในไฟล์ .env ของเครื่องนี้' });
      try {
        const entries = await readEntries(req);
        if (!entries) return json(res, 400, { error: 'ชุดข้อมูลตรวจสิทธิ์ไม่ถูกต้อง' });
        if (busy) return json(res, 429, { error: 'กำลังตรวจอีกชุด กรุณาลองใหม่เมื่อเสร็จ' });
        busy = true;
        try {
          return json(res, 200, { results: await review(entries, { apiKey, model }) });
        } finally {
          busy = false;
        }
      } catch (error) {
        const message = error.apiStatus === 401 || error.apiStatus === 403
          ? 'OpenAI ปฏิเสธสิทธิ์ กรุณาตรวจ API key และสิทธิ์ของโปรเจกต์'
          : error.apiStatus === 429
            ? 'OpenAI แจ้งว่าถึงขีดจำกัด กรุณาตรวจโควตาหรือรอแล้วลองใหม่'
            : 'เชื่อมต่อ OpenAI หรืออ่านผลไม่สำเร็จ กรุณาลองใหม่';
        return json(res, 502, { error: message });
      }
    }

    const asset = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (req.method !== 'GET' || !assets.has(asset)) return json(res, 404, { error: 'ไม่พบไฟล์' });
    try {
      const body = await readFile(new URL('./' + asset, import.meta.url));
      res.writeHead(200, { 'Content-Type': mime[asset.split('.').at(-1)], 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch {
      json(res, 404, { error: 'ไม่พบไฟล์' });
    }
  });
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.BREAKFAST_PORT || 8765);
  createBreakfastServer({ apiKey: process.env.OPENAI_API_KEY, model: process.env.OPENAI_MODEL || undefined })
    .listen(port, '127.0.0.1', () => console.log('Breakfast Check-in: http://127.0.0.1:' + port));
}
