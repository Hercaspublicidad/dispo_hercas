import assert from 'node:assert/strict';

const base = process.env.HERCAS_TEST_URL || 'http://127.0.0.1:3000';

const loginResponse = await fetch(`${base}/login`, { redirect: 'manual' });
assert.equal(loginResponse.status, 200, 'login page must be public');
const html = await loginResponse.text();
assert.match(html, /Bienvenido a Hercas/);
const page = await fetch(base, { redirect: 'manual' });
assert.equal(page.status, 307, 'catalog page must redirect without a session');
assert.match(page.headers.get('location') ?? '', /\/login\?next=/);
for (const route of ['/api/catalog', '/api/asset/MV-BAQ-001/ficha', '/api/admin/transfer']) {
  const response = await fetch(`${base}${route}`);
  assert.equal(response.status, 401, `${route} must reject anonymous access`);
}
for (const route of ['/api/proposal', '/api/import', '/api/import/apply', '/api/admin/transfer', '/api/admin/transfer/export']) {
  const response = await fetch(`${base}${route}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
  });
  assert.equal(response.status, 401, `${route} must reject anonymous access`);
}
console.log('Auth smoke: login public, catalog redirected, all API routes unauthorized.');
