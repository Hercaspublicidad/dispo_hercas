import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('desarrollo y producción usan carpetas de compilación separadas', async () => {
  const config = (await import('../next.config.mjs')).default;
  const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(config.distDir, '.next-prod');
  assert.match(pkg.scripts.dev, /HERCAS_DIST_DIR=\.next-dev/);
});
