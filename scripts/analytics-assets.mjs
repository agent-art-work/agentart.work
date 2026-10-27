// Site-owned, default-off analytics. Only the explicit Pages production step can enable it.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

export function analyticsBuildConfig(config, env = process.env, base = '') {
  if (!config || config.enabled !== false || config.measurementId !== null ||
      Object.keys(config).sort().join(',') !== 'enabled,measurementId') {
    throw new Error('Keep site/analytics.json disabled and unset; activation uses explicit production build variables.');
  }
  const production = !base && env.AGENTART_DEPLOYMENT === 'production' &&
    env.AGENTART_ANALYTICS_ENABLED === 'true' && env.CI === 'true' &&
    env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === 'agent-art-work/agentart.work' &&
    env.GITHUB_REF === 'refs/heads/main' && ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) &&
    env.GITHUB_WORKFLOW_REF === 'agent-art-work/agentart.work/.github/workflows/pages.yml@refs/heads/main';
  if (!production) return { enabled: false, measurementId: null, production: false };
  const id = env.AGENTART_ANALYTICS_MEASUREMENT_ID;
  if (typeof id !== 'string' || !/^G-[A-Z0-9]{6,20}$/.test(id) || id.includes('TEST')) {
    throw new Error('Explicit production analytics requires a valid AGENTART_ANALYTICS_MEASUREMENT_ID.');
  }
  return { enabled: true, measurementId: id, production: true };
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
