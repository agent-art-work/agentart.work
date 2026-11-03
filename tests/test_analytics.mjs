import test from 'node:test';
import assert from 'node:assert/strict';
import { createAnalytics, measurementContextAllowed, safeMeasurementURL, safeMeasurementReferrer, REVIEWED_PATHS, ANALYTICS_EXCLUSION_KEY as KEY } from '../site/assets/analytics-core.mjs';
const origin = 'https://agentart.work';
function fixture(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  const storage = { getItem: k => values.get(k) ?? null, setItem: (k,v) => { writes.push(k); values.set(k,v); } };
  const window = { localStorage: storage, document: {} };
  return { values, writes, storage, window, controller: createAnalytics({ window }) };
}
test('only exact reviewed actual paths are candidates; URL identities are never replaced', () => {
  for (const path of REVIEWED_PATHS) assert.equal(safeMeasurementURL(origin + path), true, path);
  for (const path of ['/new-post/', '/blog/?', '/blog/#', '/blog/?wallet=secret', '/blog/#private', '/api/', '/auth/', '/works/private', '/ask-your-agent/', '/agent-index.json', '/blog/index.html', '/%62log/']) assert.equal(safeMeasurementURL(origin + path), false, path);
  for (const url of ['http://agentart.work/', 'https://preview.agentart.work/', 'http://localhost/', 'https://user:pass@agentart.work/']) assert.equal(safeMeasurementURL(url), false, url);
});
test('referrers are rejected before collection unless empty or exact safe same-origin', () => {
  assert.equal(safeMeasurementReferrer(''), true);
  assert.equal(safeMeasurementReferrer(origin + '/about/'), true);
  for (const url of ['https://example.com/', origin + '/auth/', origin + '/?secret=x', origin + '/#secret', undefined]) assert.equal(safeMeasurementReferrer(url), false);
});
test('context guards cover exclusions, unreadable storage, automation and sensitive transitions', () => {
  const f = fixture(); const c = { url: origin+'/', referrer:'', navigator:{}, storage:f.storage };
  assert.equal(measurementContextAllowed(c),true);
  for (const value of ['1','true','corrupt','']) { f.values.set(KEY,value);assert.equal(measurementContextAllowed(c),false); }
  f.values.set(KEY,'0');assert.equal(measurementContextAllowed(c),true);
  for(const navigator of [{webdriver:true},{userAgent:'HeadlessChrome'},{userAgent:'ChatGPT-User'},{userAgent:'ClaudeBot'}]) assert.equal(measurementContextAllowed({...c,navigator}),false);
  assert.equal(measurementContextAllowed({...c,storage:{getItem(){throw Error();}}}),false);
  assert.equal(measurementContextAllowed({...c,url:origin+'/wallet/user'}),false);
});
test('old allowances cannot activate collection; functional state and exclusion survive initialization', () => {
  const f=fixture({[KEY]:'1','agentart.analytics.preference.v1':'{"choice":"allow"}', 'saved-work':'untouched'});
  const before=[...f.values];assert.equal(f.controller.status().excluded,true);assert.equal(f.controller.status().collecting,false);assert.deepEqual([...f.values],before);assert.deepEqual(f.writes,[]);
  f.controller.include();assert.equal(f.controller.status().collecting,false);assert.equal(f.values.get('saved-work'),'untouched');assert.deepEqual(f.writes,[KEY]);
});
test('exclude/include write only existing exclusion key, never identifiers or consent', () => {
  const f=fixture();assert.equal(f.controller.exclude().excluded,true);assert.equal(f.values.get(KEY),'1');assert.equal(f.controller.include().excluded,false);assert.equal(f.values.get(KEY),'0');assert.deepEqual(f.writes,[KEY,KEY]);assert.equal(f.controller.status().collecting,false);
});
test('failed writes and readback failures are visible, collection stays off', () => {
  const f=fixture();f.storage.setItem=()=>{throw Error();};assert.equal(f.controller.exclude().writeFailed,true);assert.equal(f.controller.status().collecting,false);
  f.storage.setItem=()=>{};assert.equal(f.controller.exclude().writeFailed,true);
  f.storage.getItem=()=>{throw Error();};assert.equal(f.controller.status().storageAvailable,false);assert.equal(f.controller.status().excluded,true);
});
test('no runtime activation even with forged config or changes to route/consent', () => {
  const f=fixture();const c=createAnalytics({window:f.window,config:{enabled:true,production:true,siteToken:'a'.repeat(32),regionalQualified:true}});
  assert.equal(c.status().qualified,false);assert.equal(c.status().collecting,false);
  f.values.set('agentart.analytics.preference.v1','{"choice":"allow"}');assert.equal(c.status().collecting,false);
});
