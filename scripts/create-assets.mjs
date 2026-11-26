// Site-owned creation context; the published reading component stays unchanged.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { defineWork } from '@agent-art/protocol';

export function writeCreationAssets(root, output) {
  const config = JSON.parse(readFileSync(path.join(root, 'site/create-agent.json'), 'utf8'));
  if (!Array.isArray(config.invitation) || !config.invitation.length ||
      !config.invitation.every(text => typeof text === 'string' && text.trim()) ||
      !Array.isArray(config.references)) throw new Error('Invalid creation invitation.');
  const work = defineWork({
    id: config.id, version: config.version, title: config.label, purpose: config.purpose,
    capabilities: ['handoff'],
    context: [{ id: 'creation-invitation', kind: 'text', mode: 'snapshot', text: config.invitation.join('\n\n') },
      ...config.references.map(({ id, url }) => ({ id, kind: 'reference', mode: 'live', url }))],
    conditions: config.conditions,
  });
  const emit = (kind, bytes) => {
    const hash = createHash('sha256').update(bytes).digest('hex');
    const file = `agent-art-create${kind === 'work' ? '-work' : ''}.${hash}.mjs`;
    writeFileSync(path.join(output, 'assets', file), bytes);
    return file;
  };
  const workName = emit('work', `export default ${JSON.stringify(work).replace(/</g, '\\u003c')};\n`);
  const adapter = readFileSync(path.join(root, 'site/assets/agent-art-create.mjs'), 'utf8');
  if (adapter.split("'./agent-art-create-work.mjs'").length !== 2) throw new Error('Creation adapter must import one Work.');
  const adapterName = emit('adapter', adapter.replace("'./agent-art-create-work.mjs'", `'./${workName}'`));
  rmSync(path.join(output, 'assets/agent-art-create.mjs'));
  return { adapterPath: `assets/${adapterName}`, workPath: `assets/${workName}` };
}
