// Site-owned Privacy assets. Unqualified manual collection cannot be enabled.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

export function analyticsBuildConfig(config, env = process.env, base = '') {
  if (!config || config.enabled !== false || config.siteToken !== null ||
      Object.keys(config).sort().join(',') !== 'enabled,siteToken') {
    throw new Error('Keep site/analytics.json disabled and unset; manual collection is unqualified.');
  }
  // Old GA4 variables and speculative CF flags cannot activate an unqualified collector.
  return { enabled: false, siteToken: null, production: false };
}

export function writeAnalyticsAssets(root, output) {
  const read = name => readFileSync(path.join(root, 'site/assets', name), 'utf8');
  const ui = read('analytics-ui.mjs');
  const importLine = "import { createAnalytics } from './analytics-core.mjs';\n";
  if (!ui.startsWith(importLine)) throw new Error('Unexpected analytics UI entry import.');
  const script = `${read('analytics-core.mjs')}\n${ui.slice(importLine.length)}`;
  const css = read('analytics.css');
  const emit = (content, suffix) => {
    const digest = createHash('sha256').update(content).digest('hex');
    const file = `analytics.${digest}.${suffix}`;
    writeFileSync(path.join(output, 'assets', file), content);
    return `assets/${file}`;
  };
  for (const name of ['analytics-core.mjs', 'analytics-ui.mjs', 'analytics.css']) {
    rmSync(path.join(output, 'assets', name));
  }
  return { script: emit(script, 'mjs'), css: emit(css, 'css') };
}
