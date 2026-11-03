// No vendor collection is installed in this candidate. Imported by the quiet Privacy entry.
export const ANALYTICS_EXCLUSION_KEY = 'agentart.analytics.excluded.v1';
export const ANALYTICS_ORIGIN = 'https://agentart.work';
export const REVIEWED_PATHS = Object.freeze(['/', '/agent-art/', '/protocol/', '/works/', '/about/', '/blog/', '/projects/agent-handoff/studies/2026-10-04-agent-friendly-environments.html', '/projects/agent-handoff/studies/2026-10-04-copy-prompt-reading-handoff.html', '/projects/thought/studies/2026-10-01-native-explicit-execution.html', '/projects/pulse/studies/2026-09-28-document-access.html', '/projects/thought/studies/2026-09-24-boundaries-and-canary-follow-up.html', '/projects/thought/studies/2026-09-20-model-acquisition.html', '/projects/thought/studies/2026-09-20-intentional-participation-proposal.html']);
// Source-owned qualification boundary, not a browser/configuration switch.
export const COLLECTION_QUALIFIED = false;

export function safeMeasurementURL(value) {
  try {
    const raw = String(value);
    const u = new URL(raw);
    return !raw.includes('?') && !raw.includes('#') && !u.username && !u.password &&
      u.origin === ANALYTICS_ORIGIN && REVIEWED_PATHS.includes(u.pathname);
  } catch { return false; }
}

export function safeMeasurementReferrer(value) {
  // Conservative candidate: no external referrer is qualified, even origin-only.
  return value === '' || safeMeasurementURL(value);
}

export function analyticsKnownAutomation(navigator = {}) {
  // A local exclusion hint, not proof that every other browser is human.
  // This value is never placed in our event payloads.
  return navigator.webdriver === true || /(?:HeadlessChrome|PhantomJS|Playwright|Puppeteer|Googlebot|bingbot|DuckDuckBot|Baiduspider|YandexBot|Applebot|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|Discordbot|PetalBot|Bytespider|GPTBot|ChatGPT-User|ClaudeBot|Claude-User|PerplexityBot|Perplexity-User|Amazonbot|OAI-SearchBot)/i.test(String(navigator.userAgent ?? ''));
}

export function measurementContextAllowed({ url, referrer, navigator, storage }) {
  try {
    const excluded = storage.getItem(ANALYTICS_EXCLUSION_KEY);
    return (excluded === null || excluded === '0') && !analyticsKnownAutomation(navigator) &&
      safeMeasurementURL(url) && safeMeasurementReferrer(referrer);
  } catch { return false; }
}

export function createAnalytics({ window: win }) {
  let writeFailed = false;
  function status() {
    let excluded = true, storageAvailable = true;
    try {
      const value = win.localStorage.getItem(ANALYTICS_EXCLUSION_KEY);
      excluded = value !== null && value !== '0';
    } catch { storageAvailable = false; }
    return { collecting: false, qualified: COLLECTION_QUALIFIED, excluded, storageAvailable, writeFailed };
  }
  function save(value) {
    try {
      win.localStorage.setItem(ANALYTICS_EXCLUSION_KEY, value);
      writeFailed = win.localStorage.getItem(ANALYTICS_EXCLUSION_KEY) !== value;
    } catch { writeFailed = true; }
    return status();
  }
  // No token, stored Allow, environment hint or URL can install a collector here.
  // A future manual vendor loader requires a separately reviewed source change.
  return { status, exclude: () => save('1'), include: () => save('0') };
}
