import test from 'node:test';
import assert from 'node:assert/strict';
import * as policy from '../site/assets/analytics-home.mjs';
import { installHomeAnalytics, eligibleHomeContext, EXCLUSION_KEY, HOME_POLICY_VERSION } from '../site/assets/analytics-home.mjs';
import { REVIEWED_PATHS, safeMeasurementReferrer, analyticsKnownAutomation } from '../site/assets/analytics-core.mjs';
// Fake DOM/Request tests only. No browser identity or source code is overridden.
const qualified = policy;
function fixture() {
 const events=new Map(),writes=[],appended=[],values=new Map([['saved-work','fixture preserved']]);
 const configs={'home-country-config':{countryEligible:true},'home-measurement-config':{enabled:true,production:true,siteToken:'a'.repeat(32),policy:HOME_POLICY_VERSION}};
 const duplicates=new Set();
 const doc={nativeScript:null,querySelector(){return this.nativeScript;},referrer:'',visibilityState:'visible',readyState:'complete',prerendering:false,
 querySelectorAll(id){const value=configs[id.slice(1)];return value===undefined?[]:Array(duplicates.has(id.slice(1))?2:1).fill({getAttribute:()=> 'application/json',textContent:typeof value==='string'?value:JSON.stringify(value)});},
 createElement(name){assert.equal(name,'script');return{attrs:{},setAttribute(k,v){this.attrs[k]=v;},remove(){this.removed=true;}};},
 head:{append(el){appended.push(el);}},addEventListener(name,fn){events.set(name,fn);}};
 const win={location:{href:'https://agentart.work/'},document:doc,navigator:{webdriver:false,userAgent:'fixture browser'},
 localStorage:{getItem:k=>values.get(k)??null,setItem(k,v){writes.push(k);values.set(k,v);}},addEventListener(name,fn){events.set(name,fn);}};
 return{win,doc,values,configs,duplicates,appended,events,writes};
}
test('genuine runtime OFF config cannot insert, even with valid policy/geography; storage preserved',()=>{
 const f=fixture();f.configs['home-measurement-config']={enabled:false,production:false,siteToken:null,policy:HOME_POLICY_VERSION};assert.equal(eligibleHomeContext(f.win),false);assert.deepEqual(installHomeAnalytics(f.win),{installed:false,state:'off'});assert.equal(f.appended.length,0);assert.equal(f.events.size,0);assert.deepEqual(f.writes,[]);assert.equal(f.values.get('saved-work'),'fixture preserved');
});
test('actual versioned policy inserts once in eligible fake DOM, spa false, origin referrer, no custom sender',()=>{
 const f=fixture();const state=qualified.installHomeAnalytics(f.win);assert.equal(state.installed,true);assert.equal(qualified.installHomeAnalytics(f.win),state);assert.equal(f.appended.length,1);
 const el=f.appended[0];assert.equal(el.src,'https://static.cloudflareinsights.com/beacon.min.js');assert.equal(el.async,true);assert.equal(el.referrerPolicy,'origin');assert.deepEqual(JSON.parse(el.attrs['data-cf-beacon']),{token:'a'.repeat(32),spa:false});assert.deepEqual(f.writes,[]);
});
test('historical paths, aliases, credentials, query/hash and noncanonical URLs cannot collect',()=>{
 for(const value of REVIEWED_PATHS.filter(p=>p!='/').map(p=>'https://agentart.work'+p).concat(['http://agentart.work/','https://www.agentart.work/','https://fixture.pages.dev/','http://127.0.0.1/','https://agentart.work/?','https://agentart.work/#','https://agentart.work/?secret=fixture','https://agentart.work/#fixture','https://agentart.work/index.html','https://agentart.work/%69ndex.html','https://agentart.work:443/','https://u:p@agentart.work/','https://agentart.work//','https://agentart.work/%2e/'])){
 const f=fixture();f.win.location.href=value;assert.equal(qualified.installHomeAnalytics(f.win).installed,false,value);assert.equal(f.appended.length,0);}
});
test('config shape/missing/duplicate/malformed/geographic values fail closed',()=>{
 for(const change of [f=>delete f.configs['home-country-config'],f=>delete f.configs['home-measurement-config'],f=>f.duplicates.add('home-country-config'),f=>f.duplicates.add('home-measurement-config'),f=>f.configs['home-measurement-config']='not json',f=>f.configs['home-country-config']={countryEligible:'true'},f=>f.configs['home-country-config']={countryEligible:false},f=>f.configs['home-country-config']={countryEligible:true,country:'US'},f=>f.configs['home-measurement-config'].enabled=false,f=>f.configs['home-measurement-config'].production=false,f=>f.configs['home-measurement-config'].siteToken=null,f=>f.configs['home-measurement-config'].siteToken='UNASSIGNED',f=>f.configs['home-measurement-config'].extra=true,f=>delete f.configs['home-measurement-config'].policy,f=>f.configs['home-measurement-config'].policy='other-policy']){
 const f=fixture();change(f);assert.equal(qualified.installHomeAnalytics(f.win).installed,false);assert.equal(f.appended.length,0);}
});
test('exact private key semantics/read failure; no initialization/reset/functional writes',()=>{
 for(const value of [null,'0','1','','true','corrupt']){const f=fixture();if(value!==null)f.values.set(EXCLUSION_KEY,value);const before=[...f.values];assert.equal(qualified.installHomeAnalytics(f.win).installed,value===null||value==='0');assert.deepEqual([...f.values],before);assert.deepEqual(f.writes,[]);}
 const f=fixture();f.win.localStorage.getItem=()=>{throw Error('fixture unavailable');};assert.equal(qualified.installHomeAnalytics(f.win).installed,false);
});
test('conservative referrers and automation retain source policy independently of Home scope',()=>{
 for(const referrer of ['',...REVIEWED_PATHS.map(p=>'https://agentart.work'+p),'https://example.com/','https://agentart.work/auth/','https://agentart.work/?','https://agentart.work/#',undefined]){const f=fixture();f.doc.referrer=referrer;assert.equal(eligibleHomeContext(f.win),safeMeasurementReferrer(referrer),String(referrer));}
 for(const navigator of [{webdriver:true},{userAgent:'HeadlessChrome'},{userAgent:'Claude-User'},{userAgent:'GPTBot'},{userAgent:'fixture browser'}]){const f=fixture();f.win.navigator=navigator;assert.equal(eligibleHomeContext(f.win),!analyticsKnownAutomation(navigator));}
});
test('hidden/prerender/not-ready cannot install or reopen a closed mount',()=>{
 for(const change of [f=>f.doc.visibilityState='hidden',f=>f.doc.prerendering=true,f=>f.doc.readyState='loading']){const f=fixture();change(f);assert.equal(qualified.installHomeAnalytics(f.win).installed,false);f.doc.visibilityState='visible';f.doc.prerendering=false;f.doc.readyState='complete';assert.equal(qualified.installHomeAnalytics(f.win).installed,false);assert.equal(f.appended.length,0);}
});
test('boundary signals remove own element without claiming revocation of native handlers/final sends',()=>{
 for(const [event,payload] of [['pagehide',{}],['beforeunload',{}],['hashchange',{}],['popstate',{}],['pageshow',{persisted:true}],['storage',{key:EXCLUSION_KEY}],['storage',{key:null}],['visibilitychange',{}]]){const f=fixture();const state=qualified.installHomeAnalytics(f.win);if(event==='visibilitychange')f.doc.visibilityState='hidden';f.events.get(event)(payload);assert.equal(state.state,'document-boundary-closed');assert.equal(f.appended[0].removed,true);qualified.installHomeAnalytics(f.win);assert.equal(f.appended.length,1);}
 const f=fixture();qualified.installHomeAnalytics(f.win);f.events.get('storage')({key:'saved-work'});assert.notEqual(f.appended[0].removed,true);f.appended[0].onerror();assert.equal(qualified.installHomeAnalytics(f.win).state,'load-failed');
});

test('preexisting native SDK or automatic injection blocks a second insertion without removing it',()=>{
 for(const nativeScript of [{src:'https://static.cloudflareinsights.com/beacon.min.js'}, {dataset:{cfBeacon:'fixture automatic injection'}}]){
  const f=fixture();f.doc.nativeScript=nativeScript;assert.equal(qualified.installHomeAnalytics(f.win).installed,false);assert.equal(f.appended.length,0);assert.equal(f.doc.nativeScript,nativeScript);assert.equal(f.events.size,0);assert.deepEqual(f.writes,[]);
 }
 const f=fixture();f.doc.querySelector=()=>{throw Error('fixture unavailable DOM');};assert.equal(qualified.installHomeAnalytics(f.win).installed,false);
});

test('modern Navigation API signals close own controller without mutating history or claiming vendor stop',()=>{
 for(const event of ['navigate','currententrychange']){
  const f=fixture(),navigationEvents=new Map();f.win.navigation={addEventListener:(name,fn)=>navigationEvents.set(name,fn)};
  const state=installHomeAnalytics(f.win);navigationEvents.get(event)({});assert.equal(state.state,'document-boundary-closed');assert.equal(f.appended[0].removed,true);installHomeAnalytics(f.win);assert.equal(f.appended.length,1);
 }
});
test('late load after boundary is recorded as unqualified and never reopens or remounts',()=>{
 const f=fixture(),state=installHomeAnalytics(f.win),script=f.appended[0];f.events.get('hashchange')({});script.onload();
 assert.equal(state.loaded,true);assert.equal(state.state,'late-load-after-boundary-unqualified');assert.equal(script.removed,true);installHomeAnalytics(f.win);assert.equal(f.appended.length,1);
});
