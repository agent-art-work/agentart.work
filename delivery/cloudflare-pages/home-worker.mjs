// Central analytics M7.2: versioned policy capability, runtime OFF by default.
// A matching policy is not native qualification or collection/release authority.
const HOME_POLICY_VERSION = 'home-native-v1';
const MEASUREMENT_OFF = '<script type="application/json" id="home-measurement-config">{"enabled":false,"siteToken":null,"production":false,"policy":"home-native-v1"}</script>';
// This module deliberately exposes only the advanced-mode Worker fetch entry.
const ORIGIN = 'https://agentart.work';
const MODE = 'production-home-country-v1';
const NEGATIVE = '<script type="application/json" id="home-country-config">{"countryEligible":false}</script>';
const POSITIVE = '<script type="application/json" id="home-country-config">{"countryEligible":true}</script>';
const DENIED = new Set('AT BE BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE CH GB'.split(' '));
// Fixed valid ISO alpha-2 set, retained from the reviewed Gallery country policy.
// XX/T1, unknown/missing values and client headers are never geo authorities.
const COUNTRIES = new Set('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '));

function noStore(headers) {
  const result = new Headers(headers);
  result.set('Cache-Control', 'private, no-store, no-transform');
  result.set('CDN-Cache-Control', 'no-store');
  result.set('Cloudflare-CDN-Cache-Control', 'no-store');
  return result;
}
function responseLike(response, body, rewritten = false) {
  const headers = noStore(response.headers);
  if (rewritten) {
    // Representation changed; old validators/length cannot describe these bytes.
    for (const name of ['Content-Length', 'Content-Encoding', 'ETag', 'Last-Modified']) headers.delete(name);
  }
  return new Response(body, { status: response.status, statusText: response.statusText, headers });
}
function brokenMarker() {
  // An unexpected positive/duplicate marker is an invalid artifact, not eligibility
  // or a promise of arbitrary platform fail-open behavior. Never repair it silently.
  return new Response('Home context is unavailable.', { status: 503, headers: noStore({ 'Content-Type': 'text/plain; charset=utf-8' }) });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!['/', '/index.html'].includes(url.pathname)) return env.ASSETS.fetch(request);
    const readable = request.method === 'GET' || request.method === 'HEAD';
    if (readable && url.pathname === '/index.html' && !request.url.includes('?') && !request.url.includes('#') && !url.username && !url.password) {
      return new Response(null, { status: 308, headers: noStore({ Location: '/' }) });
    }
    // Unsafe alias variants receive ordinary Home content, without an asset-layer
    // canonical redirect which could conceal the original query/alias decision.
    let assetRequest = request;
    if (readable) {
      const assetUrl = new URL('/', url.origin);
      assetRequest = new Request(assetUrl, { method: 'GET', headers: request.headers });
    }
    // No catch-all fallback: a failed ASSETS/platform call remains a real error.
    const asset = await env.ASSETS.fetch(assetRequest);
    if (!readable || asset.status !== 200 || !/^text\/html(?:\s*;|$)/i.test(asset.headers.get('Content-Type') ?? '') ||
        (asset.headers.has('Content-Encoding') && asset.headers.get('Content-Encoding') !== 'identity')) {
      return responseLike(asset, request.method === 'HEAD' ? null : asset.body);
    }
    const html = await asset.text();
    const count = html.split(NEGATIVE).length - 1;
    const markerIds = (html.match(/id=["']home-country-config["']/g) ?? []).length;
    if (count !== 1 || markerIds !== 1) {
      if (markerIds !== 0) return brokenMarker();
      // Older/missing-marker static content has no positive eligibility.
      return responseLike(asset, request.method === 'HEAD' ? null : html, true);
    }
    const measurementIds = (html.match(/id=["']home-measurement-config["']/g) ?? []).length;
    if (measurementIds > 0 && (measurementIds !== 1 || !html.includes(MEASUREMENT_OFF))) return brokenMarker();
    const country = request.cf?.country;
    const geographic = env.AGENTART_HOME_COUNTRY_MODE === MODE && request.url === ORIGIN + '/' &&
      typeof country === 'string' && COUNTRIES.has(country) && !DENIED.has(country);
    let body = geographic ? html.replace(NEGATIVE, POSITIVE) : html;
    const token = env.AGENTART_HOME_BEACON_TOKEN;
    // Geography/token alone cannot activate. Policy and production mode must both
    // be explicitly selected; static/default/preview contexts remain OFF.
    const measure = env.AGENTART_HOME_MEASUREMENT_POLICY === HOME_POLICY_VERSION && request.method === 'GET' && geographic &&
      env.AGENTART_HOME_MEASUREMENT_MODE === 'production-home-v1' &&
      typeof token === 'string' && /^[a-f0-9]{32}$/.test(token) && measurementIds === 1;
    if (measure) body = body.replace(MEASUREMENT_OFF, '<script type="application/json" id="home-measurement-config">' +
      JSON.stringify({ enabled: true, siteToken: token, production: true, policy: HOME_POLICY_VERSION }) + '</script>');
    return responseLike(asset, request.method === 'HEAD' ? null : body, true);
  },
};
