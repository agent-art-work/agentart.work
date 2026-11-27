// Source/artifact regression only: no browser, analytics SDK or receiver runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, '_site');
const origin = 'https://agentart.work';
const read = file => readFileSync(path.join(output, file), 'utf8');
const home = read('index.html');
const attrs = value => Object.fromEntries([...value.matchAll(/\b([\w-]+)="([^"]*)"/g)]
  .map(match => [match[1], match[2]]));
const anchors = [...home.matchAll(/<a\b([^>]*)>/g)].map(match => attrs(match[1]));
const scripts = [...home.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
  .map(match => ({ ...attrs(match[1]), body: match[2] }));

// Inspect source bytes, never import or evaluate these browser/SDK modules.
function loadedScripts() {
  const sources = new Map();
  const pending = scripts.filter(script => script.src).map(script => script.src);
  while (pending.length) {
    const url = new URL(pending.pop(), origin + '/');
    assert.equal(url.origin, origin, 'review new external script/import before shipping');
    const file = url.pathname.slice(1);
    if (sources.has(file)) continue;
    const source = read(file);
    sources.set(file, source);
    const imports = [
      ...source.matchAll(/\b(?:import|export)\s+(?:[^;]*?\s+from\s*)?['"]([^'"]+)['"]/g),
      ...source.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ];
    for (const match of imports) pending.push(new URL(match[1], url).href);
  }
  return sources;
}

test('Home site links keep ordinary document destinations and real fragment targets', () => {
  const local = anchors.filter(anchor => new URL(anchor.href, origin).origin === origin);
  assert.ok(local.length > 8);
  const paths = new Set();
  for (const anchor of local) {
    assert.ok(!Object.keys(anchor).some(name => name.startsWith('on')));
    const url = new URL(anchor.href, origin);
    assert.equal(url.search, '', 'review any new query-bearing navigation');
    if (url.hash) {
      assert.equal(anchor.href, '#main', 'Home emits only the public skip fragment');
      assert.match(home, /<main id="main">/);
    } else {
      paths.add(url.pathname);
      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1) + 'index.html';
      assert.ok(existsSync(path.join(output, file)), anchor.href);
      assert.doesNotMatch(anchor.href, /private|auth|session/i);
    }
  }
  assert.deepEqual([...paths].sort(), ['/', '/about/', '/agent-art/', '/ask-your-agent/',
    '/blog/', '/create/', '/protocol/', '/works/']);
  assert.match(home, /<footer[^>]* id="articles">/, 'retain the existing /#articles bookmark');
  assert.doesNotMatch(home, /<base\b|\bonclick\s*=/i);
});

test('every emitted Home-linked document remains OFF and has no Home collector insertion', () => {
  const paths = new Set(anchors.map(anchor => new URL(anchor.href, origin))
    .filter(url => url.origin === origin && !url.hash).map(url => url.pathname));
  const files = ['404.html', ...[...paths].map(route => route === '/' ? 'index.html' : route.slice(1) + 'index.html')];
  for (const file of files) {
    const html = read(file);
    const config = html.match(/<script type="application\/json" id="analytics-config">(.*?)<\/script>/);
    assert.ok(config, file);
    assert.deepEqual(JSON.parse(config[1]), { enabled: false, siteToken: null, production: false });
    assert.doesNotMatch(html, /home-measurement-config|analytics-home\.|data-cf-beacon|cloudflareinsights\.com/);
  }
  assert.doesNotMatch(read('404.html'), /http-equiv="refresh"/i, 'missing-page artifact is not an SPA/Home redirect');
});

test('the actual Home script graph has no same-document router or history writer', () => {
  const graph = loadedScripts();
  assert.ok(graph.size >= 10, 'inspect transitive reading imports as well as script tags');
  assert.equal(scripts.filter(script => !script.src && script.type !== 'application/json').length, 0);
  for (const [file, source] of graph) {
    assert.doesNotMatch(source, /\b(?:pushState|replaceState)\s*\(|\bnavigation\s*\.\s*(?:navigate|intercept|updateCurrentEntry|traverseTo)\s*\(/, file);
    assert.doesNotMatch(source, /\b(?:location\s*\.\s*(?:href|pathname|search|hash)|location)\s*=(?!=)/, file);
    assert.doesNotMatch(source, /\b(?:window|document)\s*\.\s*addEventListener\s*\(\s*['"]click['"]/, file);
    assert.doesNotMatch(source, /\bserviceWorker\s*\.\s*register\s*\(/, file);
  }
  const prevented = [...graph].filter(([, source]) => /\.preventDefault\s*\(/.test(source));
  assert.deepEqual(prevented.map(([file]) => file), ['assets/agent-art-sdk/0.1.5-alpha.2/reading-ui.mjs']);
  assert.match(prevented[0][1], /listen\(anchor, 'click', event => \{\s*if \(destroyed \|\| busy \|\| event.defaultPrevented\) \{ event.preventDefault\(\); return; \}/);
  const clients = graph.get('assets/agent-art-sdk/0.1.5-alpha.2/clients.mjs');
  assert.match(clients, /codex:\/\/new\?prompt=/);
  assert.match(clients, /claude:\/\/claude\.ai\/new\?q=/);
});

test('Home introduction leaves fragment and back-forward entry handling to the browser', () => {
  const intro = read('assets/home-intro.js');
  assert.match(intro, /if \(!bar \|\| location\.hash \|\| motion\.matches \|\| navigation\?\.type === 'back_forward'\) return;/);
  assert.match(intro, /const interactions = \[[^\]]*'hashchange'\]/);
  assert.match(intro, /document\.addEventListener\('visibilitychange', stop\)/);
  assert.match(intro, /scrollY > 1 \|\| location\.hash \|\| document\.hidden/);
  assert.doesNotMatch(intro, /\bscrollRestoration\s*=|\b(?:pushState|replaceState)\s*\(/);
  // Source guards preserve normal anchors/restoration; they do not qualify
  // actual BFCache behavior or revoke a previously loaded native collector.
});
