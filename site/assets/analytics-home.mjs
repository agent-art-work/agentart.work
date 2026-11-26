// Pages-only Home policy capability, not a claim of native qualification.
// Checked-in/packaged defaults remain OFF; release and native tests are separate.
export const HOME_POLICY_VERSION = 'home-native-v1';
export const EXCLUSION_KEY = 'agentart.analytics.excluded.v1';
const HOME = 'https://agentart.work/';
const AUTOMATION = /(?:HeadlessChrome|PhantomJS|Playwright|Puppeteer|Googlebot|bingbot|DuckDuckBot|Baiduspider|YandexBot|Applebot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|PetalBot|Bytespider|GPTBot|ChatGPT-User|ClaudeBot|Claude-User|PerplexityBot|Perplexity-User|Amazonbot|OAI-SearchBot)/i;
// Retained finite public referrer list is not measurement scope. Only HOME can load.
const PUBLIC_REFERRERS = new Set(['/', '/agent-art/', '/protocol/', '/works/', '/about/', '/blog/', '/projects/agent-handoff/studies/2026-10-04-agent-friendly-environments.html', '/projects/agent-handoff/studies/2026-10-04-copy-prompt-reading-handoff.html', '/projects/thought/studies/2026-10-01-native-explicit-execution.html', '/projects/pulse/studies/2026-09-28-document-access.html', '/projects/thought/studies/2026-09-24-boundaries-and-canary-follow-up.html', '/projects/thought/studies/2026-09-20-model-acquisition.html', '/projects/thought/studies/2026-09-20-intentional-participation-proposal.html']);
export function safeHomeReferrer(value) {
  if (value === '') return true;
  if (typeof value !== 'string' || value.includes('?') || value.includes('#')) return false;
  try {
    const u = new URL(value);
    return u.origin === 'https://agentart.work' && !u.username && !u.password &&
      value === u.origin + u.pathname && PUBLIC_REFERRERS.has(u.pathname);
  } catch { return false; }
}
function readConfig(doc, id, keys) {
  const elements = doc.querySelectorAll('#' + id);
  if (elements.length !== 1 || elements[0].getAttribute('type') !== 'application/json') return null;
  const value = JSON.parse(elements[0].textContent);
  return value && typeof value === 'object' && !Array.isArray(value) &&
    Object.keys(value).sort().join(',') === keys ? value : null;
}
export function eligibleHomeContext(win) {
  try {
    const doc = win.document;
    const config = readConfig(doc, 'home-measurement-config', 'enabled,policy,production,siteToken');
    const country = readConfig(doc, 'home-country-config', 'countryEligible');
    const excluded = win.localStorage.getItem(EXCLUSION_KEY);
    return win.location.href === HOME && config?.policy === HOME_POLICY_VERSION && config.enabled === true && config.production === true &&
      /^[a-f0-9]{32}$/.test(config.siteToken) && typeof config.siteToken === 'string' &&
      country?.countryEligible === true && (excluded === null || excluded === '0') &&
      win.navigator.webdriver !== true && !AUTOMATION.test(String(win.navigator.userAgent ?? '')) &&
      safeHomeReferrer(doc.referrer) && doc.visibilityState === 'visible' &&
      doc.prerendering !== true && ['interactive', 'complete'].includes(doc.readyState);
  } catch { return false; }
}
function existingNativeScript(doc) {
  try {
    // Conservative DOM-visible duplicate/injection guard, not proof that an
    // earlier removed vendor script left no handlers. Never remove another owner.
    return doc.querySelector('script[data-cf-beacon], script[src*="cloudflareinsights.com"]') !== null;
  } catch { return true; }
}
const mounted = new WeakMap();
export function installHomeAnalytics(win) {
  if (mounted.has(win)) return mounted.get(win);
  let script, closed = false;
  const result = { installed: false, state: 'off' };
  mounted.set(win, result);
  // Only this exact versioned policy/config/context can consider insertion.
  // Policy compatibility is not qualification evidence or release authority.
  if (!eligibleHomeContext(win) || existingNativeScript(win.document)) return result;
  const close = () => {
    closed = true;
    script?.remove();
    result.state = 'document-boundary-closed';
    // This removes our element only. It cannot revoke native SDK handlers or
    // already queued/final sends. Native lifecycle remains a separate release gate.
  };
  for (const name of ['pagehide', 'beforeunload', 'hashchange', 'popstate']) win.addEventListener(name, close, { once: true });
  // No history patch or native identity override. These signals close only our
  // controller; native handler/final-send behavior is not yet qualified.
  if (typeof win.navigation?.addEventListener === 'function') {
    win.navigation.addEventListener('navigate', close, { once: true });
    win.navigation.addEventListener('currententrychange', close, { once: true });
  }
  win.addEventListener('pageshow', event => { if (event.persisted) close(); });
  win.addEventListener('storage', event => { if (event.key === EXCLUSION_KEY || event.key === null) close(); });
  win.document.addEventListener('visibilitychange', () => { if (win.document.visibilityState !== 'visible') close(); });
  if (closed || !eligibleHomeContext(win) || existingNativeScript(win.document)) return result;
  // Single native vendor resource; no copied vendor code, custom payload/receiver,
  // proxy, identity, history patch, cookie or storage write.
  script = win.document.createElement('script');
  script.async = true;
  script.src = 'https://static.cloudflareinsights.com/beacon.min.js';
  script.referrerPolicy = 'origin';
  const config = readConfig(win.document, 'home-measurement-config', 'enabled,policy,production,siteToken');
  script.setAttribute('data-cf-beacon', JSON.stringify({ token: config.siteToken, spa: false }));
  script.onload = () => {
    result.loaded = true;
    if (closed || !eligibleHomeContext(win)) {
      close();
      // Load fires after possible SDK evaluation. Report it; do not claim removal
      // canceled pending code or prevented a native send. No remount/reopen.
      result.state = 'late-load-after-boundary-unqualified';
    }
  };
  script.onerror = () => { close(); result.state = 'load-failed'; };
  win.document.head.append(script);
  result.installed = true;
  result.state = 'inserted-not-receiver-verified';
  return result;
}
if (typeof window !== 'undefined') installHomeAnalytics(window);
