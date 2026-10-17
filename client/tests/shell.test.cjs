const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { URL } = require('node:url');
const { Response } = globalThis;
const source = fs.readFileSync(path.join(__dirname, '../public/sw.js'), 'utf8');
function worker() {
  const handlers = {}, cached = [], removed = [];
  const cache = { put: async (key) => cached.push(key), addAll: async (keys) => cached.push(...keys), match: async () => undefined };
  vm.runInNewContext(source, {
    URL, Response,
    self: { location: { origin: 'https://blackbox.test' }, clients: { claim: async () => undefined }, addEventListener: (name, handler) => { handlers[name] = handler; } },
    caches: { open: async () => cache, keys: async () => ['blackbox-shell-v2', 'unrelated-cache'], delete: async (key) => { removed.push(key); } },
    fetch: async () => new Response('<script src="/assets/main.js"></script><link href="/assets/main.css"><script src="https://outside.test/private.js"></script>'),
  });
  return { handlers, cached, removed };
}
test('first service-worker install precaches entry JS/CSS before an offline refresh', async () => {
  const w = worker(); let installed;
  w.handlers.install({ waitUntil: (promise) => { installed = promise; } }); await installed;
  assert.ok(w.cached.includes('/'));
  assert.ok(w.cached.includes('https://blackbox.test/assets/main.js'));
  assert.ok(w.cached.includes('https://blackbox.test/assets/main.css'));
  assert.ok(!w.cached.some((key) => key.includes('outside.test')));
});
test('service-worker never intercepts API/private responses', () => {
  const w = worker();
  for (const destination of ['', 'document']) {
    let intercepted = false;
    w.handlers.fetch({ request: { method: 'GET', url: 'https://blackbox.test/api/v1/missions', destination }, respondWith: () => { intercepted = true; } });
    assert.equal(intercepted, false);
  }
});
test('activation removes old shared shell caches without deleting unrelated caches', async () => {
  const w = worker(); let activation;
  w.handlers.activate({ waitUntil: (promise) => { activation = promise; } }); await activation;
  assert.deepEqual(w.removed, ['blackbox-shell-v2']);
});
