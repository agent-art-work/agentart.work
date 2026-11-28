// Local packaging only. Never invokes Wrangler, a provider, or the active CI workflow.
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, '_site');
const parent = path.join(root, 'local/cloudflare-pages');
const output = path.join(parent, '_site');
const marker = '<script type="application/json" id="home-country-config">{"countryEligible":false}</script>';
const measurementMarker = '<script type="application/json" id="home-measurement-config">{"enabled":false,"siteToken":null,"production":false,"policy":"home-native-v1"}</script>';
const digest = data => createHash('sha256').update(data).digest('hex');
const config = JSON.parse(readFileSync(path.join(root, 'site/analytics.json'), 'utf8'));
if (Object.keys(config).sort().join(',') !== 'enabled,siteToken' || config.enabled !== false || config.siteToken !== null) throw Error('Pages preparation requires the unchanged OFF configuration.');
const measurement = JSON.parse(readFileSync(path.join(root, 'delivery/cloudflare-pages/measurement.json'), 'utf8'));
if (JSON.stringify(measurement) !== '{"enabled":false,"siteToken":null,"policy":"home-native-v1"}') throw Error('Pages checked-in configuration must remain OFF with the reviewed policy.');
const client = readFileSync(path.join(root, 'site/assets/analytics-home.mjs'));
const worker = readFileSync(path.join(root, 'delivery/cloudflare-pages/home-worker.mjs'));
if (!client.toString().includes("export const HOME_POLICY_VERSION = 'home-native-v1';") ||
    !worker.toString().includes("const HOME_POLICY_VERSION = 'home-native-v1';")) throw Error('Home source policy versions must match.');
const clientName = 'analytics-home.' + digest(client) + '.mjs';
const homeOnly = marker + measurementMarker + '<meta name="referrer" content="origin">' +
  '<script type="module" src="/assets/' + clientName + '" referrerpolicy="origin"></script>';
if (process.env.SITE_BASE_PATH) throw Error('Dedicated Pages candidate requires a root-path static build.');
if (!existsSync(source) || lstatSync(source).isSymbolicLink()) throw Error('Build the regular static _site first.');
for (const name of ['_worker.js', '_routes.json', '_headers', 'functions', 'CNAME', 'wrangler.toml', 'wrangler.json', 'wrangler.jsonc']) {
  if (existsSync(path.join(source, name))) throw Error('Unexpected delivery configuration in static recovery output.');
}
const files = folder => readdirSync(folder, { recursive: true }).filter(file => {
  const stat = lstatSync(path.join(folder, file));
  if (stat.isSymbolicLink()) throw Error('Symlink in public artifact.');
  return stat.isFile();
}).sort();
const originals = Object.fromEntries(files(source).map(file => [file, digest(readFileSync(path.join(source, file)))]));
if (Object.keys(originals).some(file => /^assets\/analytics[.-].*\.(?:js|mjs|css)$/.test(file))) throw Error('Apply the public-control cleanup before Pages packaging.');
for (const file of Object.keys(originals).filter(file => file.endsWith('.html'))) {
  const html = readFileSync(path.join(source, file), 'utf8');
  if (/site-privacy|data-analytics-action|home-country-config|home-measurement-config/.test(html)) throw Error('Public controls or preexisting country context in recovery artifact.');
  if (html.includes('class="site-footer"')) {
    const match = html.match(/<script type="application\/json" id="analytics-config">(.*?)<\/script>/g);
    if (match?.length !== 1 || !match[0].includes('{"enabled":false,"siteToken":null,"production":false}')) throw Error('Static output must remain OFF.');
  }
}
const home = readFileSync(path.join(source, 'index.html'), 'utf8');
if (/name=["']referrer["']/i.test(home)) throw Error('Review existing Home referrer policy before packaging.');
if (home.split('</head>').length !== 2) throw Error('Home marker needs exactly one head boundary.');
for (const folder of [path.join(root, 'local'), parent, output]) {
  if (existsSync(folder) && lstatSync(folder).isSymbolicLink()) throw Error('Refusing a symlinked output destination.');
}
mkdirSync(parent, { recursive: true });
rmSync(output, { recursive: true, force: true });
cpSync(source, output, { recursive: true });
writeFileSync(path.join(output, 'index.html'), home.replace('</head>', homeOnly + '</head>'));
writeFileSync(path.join(output, '_worker.js'), worker);
writeFileSync(path.join(output, 'assets', clientName), client);
writeFileSync(path.join(output, '_routes.json'), JSON.stringify({ version: 1, include: ['/', '/index.html'], exclude: [] }, null, 2) + '\n');
const noStore = ['Cache-Control: private, no-store, no-transform', 'CDN-Cache-Control: no-store', 'Cloudflare-CDN-Cache-Control: no-store'];
const homeHeaders = ['/', '/index.html'].map(route => route + '\n' + noStore.map(header => '  ' + header).join('\n'));
const createHeaders = '/create/\n  Cache-Control: public, max-age=0, must-revalidate, no-transform';
writeFileSync(path.join(output, '_headers'), [...homeHeaders, createHeaders].join('\n\n') + '\n');
const manifest = { schema: 'agentart.pages-off.local.v1', collection: 'OFF', networkRequests: 0,
  source: originals, files: Object.fromEntries(files(output).map(file => [file, digest(readFileSync(path.join(output, file)))])) };
writeFileSync(path.join(parent, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Prepared ${Object.keys(manifest.files).length} local Pages files; static _site and active workflow unchanged. Collection OFF.`);
