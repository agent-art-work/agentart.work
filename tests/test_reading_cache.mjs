import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import { test } from 'node:test';
import { digest, assetName, writeReadingAssets } from '../scripts/reading-assets.mjs';

function fixture(t) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'reading-cache-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const put = (file, bytes) => {
    const target = path.join(root, file);mkdirSync(path.dirname(target), { recursive: true });writeFileSync(target, bytes);
  };
  const adapter = (sdk, workImport) => `import { identity } from './agent-art-sdk/${sdk}/reading-ui.mjs';\nimport work from '${workImport}';\nglobalThis.__readingCacheTest = { identity, work };\n`;
  const oldWork = 'export default {"prompt":"original invitation"};\n';
  const oldWorkHash = digest(oldWork);
  const oldAdapter = adapter('1.0.0', `./agent-art-reading-work.mjs?v=${oldWorkHash}`);
  const entry = {revision: 'a'.repeat(40), sdk: '1.0.0', adapter: digest(oldAdapter), work: oldWorkHash};
  put(`site/reading-snapshots/work.${entry.work}.mjs`, oldWork);
  put(`site/reading-snapshots/adapter.${entry.adapter}.mjs`, oldAdapter);
  put('site/reading-asset-retention.json', JSON.stringify({policy:'current-and-two-reading-predecessors',previous:[entry]}));
  put('site/sdk-asset-retention.json', JSON.stringify({previous:[{version:'1.0.0'}]}));
  put('site/assets/agent-art-reading.mjs', adapter('2.0.0', './agent-art-reading-work.mjs'));
  put('_site/assets/agent-art-sdk/1.0.0/reading-ui.mjs', 'export const identity="old SDK";\n');
  put('_site/assets/agent-art-sdk/2.0.0/reading-ui.mjs', 'export const identity="current SDK";\n');
  const currentWork = 'export default {"prompt":"new invitation, different from retained"};\n';
  const output = path.join(root, '_site');
  const result = writeReadingAssets(root, output, currentWork, '2.0.0');
  const url = file => pathToFileURL(path.join(output, file)).href;
  return {root,put,entry,oldWork,oldAdapter,currentWork,output,result,url};
}

test('new entries use hash filenames and exact Work bytes, independent of legacy URLs', async t => {
  const f=fixture(t);
  const currentAdapter=readFileSync(path.join(f.output,f.result.adapterPath),'utf8');
  assert.equal(path.basename(f.result.adapterPath),assetName('adapter',digest(currentAdapter)));
  assert.equal(path.basename(f.result.workPath),assetName('work',digest(f.currentWork)));
  assert.ok(currentAdapter.includes(`'./${path.basename(f.result.workPath)}'`));
  assert.ok(!currentAdapter.includes('?v='));
  await import(f.url(f.result.adapterPath));
  assert.deepEqual(globalThis.__readingCacheTest,{identity:'current SDK',work:{prompt:'new invitation, different from retained'}});
});

test('legacy adapter and Work cache misses select their original graph even when current Work differs', async t => {
  const f=fixture(t);
  await import(f.url('assets/agent-art-reading.mjs')+`?v=${f.entry.adapter}`);
  assert.deepEqual(globalThis.__readingCacheTest,{identity:'old SDK',work:{prompt:'original invitation'}});
  const work=await import(f.url('assets/agent-art-reading-work.mjs')+`?v=${f.entry.work}`);
  assert.deepEqual(work.default,{prompt:'original invitation'});
  assert.equal(readFileSync(path.join(f.output,'assets',assetName('adapter',f.entry.adapter)),'utf8'),f.oldAdapter);
  assert.equal(readFileSync(path.join(f.output,'assets',assetName('work',f.entry.work)),'utf8'),f.oldWork);
});

test('unknown or missing legacy hashes fail instead of silently selecting the latest graph', async t => {
  const f=fixture(t);
  for(const kind of ['agent-art-reading','agent-art-reading-work']) {
    for(const query of ['', '?v='+ '0'.repeat(64), '?v=__proto__']) {
      await assert.rejects(import(f.url(`assets/${kind}.mjs`)+query), /Unknown reading .* revision/);
    }
  }
});

test('retained filename imports remain byte-identical and undeclared SDK dependencies fail the build', t => {
  const f=fixture(t);
  const currentAdapter=readFileSync(path.join(f.output,f.result.adapterPath),'utf8');
  const entry={revision:'b'.repeat(40),sdk:'2.0.0',adapter:digest(currentAdapter),work:digest(f.currentWork)};
  f.put(`site/reading-snapshots/adapter.${entry.adapter}.mjs`,currentAdapter);
  f.put(`site/reading-snapshots/work.${entry.work}.mjs`,f.currentWork);
  f.put('site/reading-asset-retention.json',JSON.stringify({policy:'current-and-two-reading-predecessors',previous:[f.entry,entry]}));
  writeReadingAssets(f.root,f.output,'export default {"prompt":"another new invitation"};\n','2.0.0');
  assert.equal(readFileSync(path.join(f.output,f.result.adapterPath),'utf8'),currentAdapter);
  assert.equal(readFileSync(path.join(f.output,f.result.workPath),'utf8'),f.currentWork);
  f.put('site/sdk-asset-retention.json',JSON.stringify({previous:[]}));
  assert.throws(()=>writeReadingAssets(f.root,f.output,f.currentWork,'2.0.0'),/Invalid retained reading snapshot/);
});
