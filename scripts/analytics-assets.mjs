// Collection stays OFF; exclusion helpers remain source-only for private OPS use.
import { readdirSync, rmSync } from 'node:fs';
import path from 'node:path';

export function analyticsBuildConfig(config, env = process.env, base = '') {
  if (!config || config.enabled !== false || config.siteToken !== null ||
      Object.keys(config).sort().join(',') !== 'enabled,siteToken') {
    throw new Error('Keep site/analytics.json disabled and unset; manual collection is unqualified.');
  }
  // Old GA4 variables and speculative CF flags cannot activate an unqualified collector.
  return { enabled: false, siteToken: null, production: false };
}

export function omitPublicAnalyticsAssets(output) {
  // Build copies site/assets first. No collector or public preference binding is
  // needed while collection is unqualified; keep the private helper out too.
  const assets = path.join(output, 'assets');
  for (const name of readdirSync(assets)) {
    if (/^analytics[.-].*\.(?:mjs|js|css)$/.test(name)) rmSync(path.join(assets, name));
  }
}
