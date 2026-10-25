// A bounded compatibility copy from a reviewed archive, never node_modules.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

export const browserFiles = ['index.mjs', 'clients.mjs', 'reading.mjs', 'reading-ui.mjs', 'reading.css'];

export function copyRetainedSdk(root, output, currentVersion) {
  const policy = JSON.parse(readFileSync(path.join(root, 'site/sdk-asset-retention.json'), 'utf8'));
  if (policy.policy !== 'current-and-one-predecessor' || !Array.isArray(policy.previous) || policy.previous.length > 1) {
    throw new Error('SDK retention is bounded to one predecessor.');
  }
  for (const previous of policy.previous) {
    const { version, archive, sha256, notices } = previous;
    if (!/^[0-9][0-9A-Za-z.-]*$/.test(version) || version === currentVersion ||
        archive !== `vendor/agent-art-protocol-${version}.tgz` || !/^[a-f0-9]{64}$/.test(sha256) ||
        !Array.isArray(notices) || notices.length > 2 || new Set(notices).size !== notices.length ||
        notices.some(name => !['README.md', 'LICENSE'].includes(name))) {
      throw new Error('Invalid retained SDK archive declaration.');
    }
    const source = path.join(root, archive);
    if (createHash('sha256').update(readFileSync(source)).digest('hex') !== sha256) {
      throw new Error(`Retained SDK archive digest mismatch: ${version}`);
    }
    // Read only named members to stdout: never extract archive paths to disk.
    const member = name => execFileSync('tar', ['-xOf', source, `package/${name}`], { maxBuffer: 1024 * 1024 });
    const metadata = JSON.parse(member('package.json'));
    if (metadata.name !== '@agent-art/protocol' || metadata.version !== version) {
      throw new Error(`Retained SDK package identity mismatch: ${version}`);
    }
    const destination = path.join(output, 'assets/agent-art-sdk', version);
    mkdirSync(destination, { recursive: true });
    for (const name of [...browserFiles, ...notices]) writeFileSync(path.join(destination, name), member(name));
  }
}
