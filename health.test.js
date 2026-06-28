const { spawn } = require('child_process');

jest.setTimeout(20000);

function waitForServerReady(proc) {
  return new Promise((resolve, reject) => {
    const onData = (data) => {
      const s = data.toString();
      if (s.includes('Explainer OS v2026 local server is running')) {
        proc.stdout.off('data', onData);
        resolve();
      }
    };
    proc.stdout.on('data', onData);
    proc.on('error', reject);
    setTimeout(() => reject(new Error('Server did not start in time')), 15000);
  });
}

async function fetchJson(url) {
  const res = await fetch(url);
  const json = await res.json();
  return { status: res.status, json };
}

let proc;

beforeAll(async () => {
  proc = spawn('node', ['server.cjs'], { env: { PORT: '4001', ...process.env }, stdio: ['ignore', 'pipe', 'pipe'] });
  await waitForServerReady(proc);
});

afterAll(() => {
  if (proc && !proc.killed) proc.kill();
});

test('GET /api/health returns ok', async () => {
  const res = await fetchJson('http://localhost:4001/api/health');
  expect(res.status).toBe(200);
  expect(res.json).toHaveProperty('status', 'ok');
});
