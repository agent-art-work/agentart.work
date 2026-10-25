// Keep each reading entry tied to its exact Work and SDK across static deploys.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

export const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export const assetName = (kind, revision) => `agent-art-reading${kind === 'work' ? '-work' : ''}.${revision}.mjs`;
const hashPattern = /^[a-f0-9]{64}$/;

export function legacyRouter(versions, kind) {
  const select = `// Compatibility for previously published query-hash URLs. Never select latest.\nconst versions = ${JSON.stringify(versions)};\nconst revision = new URL(import.meta.url).searchParams.get('v');\nif (!Object.hasOwn(versions, revision)) throw new Error('Unknown reading ${kind} revision; use the manual prompt or reload the page.');\n`;
  return select + (kind === 'work' ? 'export default (await import(versions[revision])).default;\n' : 'await import(versions[revision]);\n');
}

export function writeReadingAssets(root, output, workModule, sdkVersion) {
  const policy = JSON.parse(readFileSync(path.join(root, 'site/reading-asset-retention.json'), 'utf8'));
  if (policy.policy !== 'current-and-two-reading-predecessors' || !Array.isArray(policy.previous) || policy.previous.length > 2) {
    throw new Error('Reading retention is bounded to two predecessors.');
  }
  const sdkPolicy = JSON.parse(readFileSync(path.join(root, 'site/sdk-asset-retention.json'), 'utf8'));
  const availableSDKs = new Set([sdkVersion, ...sdkPolicy.previous.map(item => item.version)]);
  const versions = { adapter: {}, work: {} };
  const write = (name, bytes) => {
    const target = path.join(output, 'assets', name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  };
  for (const entry of policy.previous) {
    if (!/^[a-f0-9]{40}$/.test(entry.revision) || !availableSDKs.has(entry.sdk) ||
        !hashPattern.test(entry.adapter) || !hashPattern.test(entry.work) || Object.hasOwn(versions.adapter, entry.adapter)) {
      throw new Error('Invalid retained reading snapshot declaration.');
    }
    for (const kind of ['adapter', 'work']) {
      const bytes = readFileSync(path.join(root, 'site/reading-snapshots', `${kind}.${entry[kind]}.mjs`));
      if (digest(bytes) !== entry[kind]) throw new Error(`Retained reading ${kind} bytes do not match their hash.`);
      if (kind === 'adapter') {
        const source = bytes.toString('utf8');
        const sdkImport = `from './agent-art-sdk/${entry.sdk}/reading-ui.mjs'`;
        const workImports = [`from './agent-art-reading-work.mjs?v=${entry.work}'`, `from './${assetName('work', entry.work)}'`];
        if (!source.includes(sdkImport) || !workImports.some(value => source.includes(value))) {
          throw new Error('Retained reading adapter does not match its declared SDK and Work.');
        }
      }
      const name = assetName(kind, entry[kind]);
      write(name, bytes);
      versions[kind][entry[kind]] = `./${name}`;
    }
  }
  const workRevision = digest(workModule);
  const workName = assetName('work', workRevision);
  const source = readFileSync(path.join(root, 'site/assets/agent-art-reading.mjs'), 'utf8');
  if (!source.includes("from './agent-art-reading-work.mjs'")) throw new Error('Missing reading Work import.');
  const adapter = source.replace("'./agent-art-reading-work.mjs'", `'./${workName}'`);
  const adapterRevision = digest(adapter);
  const adapterName = assetName('adapter', adapterRevision);
  write(workName, workModule);
  write(adapterName, adapter);
  // The entry shim is only for cached old HTML; new pages use the immutable file.
  write('agent-art-reading.mjs', legacyRouter(versions.adapter, 'adapter'));
  write('agent-art-reading-work.mjs', legacyRouter(versions.work, 'work'));
  return { adapterPath: `assets/${adapterName}`, workPath: `assets/${workName}` };
}
