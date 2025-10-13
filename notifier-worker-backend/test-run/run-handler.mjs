import fs from 'fs';
import path from 'path';

const mod = await import('../dist/index.js');
const handler = mod.default;

async function run() {
  const url = 'https://example.com/api/settings';
  const body = { cycle: '주 주 야 야 비 비', baseDate: '2025-10-13', users: ['홍길동','김철수'] };
  const req = new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  const res = await handler.fetch(req, {}, {});
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Body:', text);
}

run().catch(err => { console.error(err); process.exit(1); });
