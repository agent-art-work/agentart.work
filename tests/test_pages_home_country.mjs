import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../delivery/cloudflare-pages/home-worker.mjs';

// Synthetic Request.cf and ASSETS only; no listener, browser, provider or SDK.
const ORIGIN = 'https://agentart.work';
const MODE = 'production-home-country-v1';
const NEGATIVE = '<script type="application/json" id="home-country-config">{"countryEligible":false}</script>';
const POSITIVE = NEGATIVE.replace(':false', ':true');
const HTML = '<!doctype html><html><head>'+NEGATIVE+'</head><body><main>Fixture manifesto &amp; reading.</main></body></html>';
const DENIED = 'AT BE BG HR CY CZ DK EE FI FR DE GR HU IS IE IT LV LI LT LU MT NL NO PL PT RO SK SI ES SE CH GB'.split(' ');
const request = (url=ORIGIN+'/',country='US',init={}) => {
  const r=new Request(url,init);if(country!==undefined)Object.defineProperty(r,'cf',{value:{country}});return r;
};
function fixture(options={}) {
  const calls=[];
  const env={AGENTART_HOME_COUNTRY_MODE:MODE,ASSETS:{fetch:async r=>{calls.push({url:r.url,method:r.method});return new Response(options.html??HTML,{status:options.status??200,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'public,max-age=600','ETag':'fixture-old','Content-Length':'999',...options.headers}});}},...options.env};
  return {calls,env};
}
async function run(r,options={}){const f=fixture(options),response=await worker.fetch(r,f.env),text=await response.text();return{...f,response,text};}
const eligible = text => text.includes(POSITIVE);
function closedCache(response){for(const name of ['Cache-Control','CDN-Cache-Control','Cloudflare-CDN-Cache-Control'])assert.match(response.headers.get(name),/no-store/);assert.match(response.headers.get('Cache-Control'),/private/);}

test('trusted valid country and explicit exact production Home offer geography only; no loader/permission',async()=>{
 const x=await run(request());assert.equal(eligible(x.text),true);assert.equal(x.text.replace(POSITIVE,NEGATIVE),HTML);closedCache(x.response);
 assert.equal(x.calls.length,1);assert.equal(x.calls[0].method,'GET');
 assert.doesNotMatch(x.text,/beacon|siteToken|production.*true|country.*US/);
 assert.equal(x.response.headers.has('ETag'),false);assert.equal(x.response.headers.has('Content-Length'),false);
});
test('all 32 restricted countries, including GB, are negative',async()=>{
 for(const country of DENIED){const x=await run(request(ORIGIN+'/',country));assert.equal(x.text,HTML,country);closedCache(x.response);}
});
test('missing/null/invalid/special countries fail closed; no case/whitespace fallback',async()=>{
 for(const country of [undefined,null,'','XX','T1','ZZ','UK','EU','us',' US','US ',123,{},true]){
  const r=country===undefined?new Request(ORIGIN+'/'):request(ORIGIN+'/',country);
  const x=await run(r);assert.equal(eligible(x.text),false,String(country));assert.equal(x.text,HTML);
 }
});
test('client country headers, cookies and query parameters never supply geographic authority',async()=>{
 const headers={'CF-IPCountry':'US','X-Country':'US','X-Forwarded-Country':'US','Cookie':'country=US','Accept-Language':'en-US'};
 const r=request(ORIGIN+'/',null,{headers});const x=await run(r);assert.equal(x.text,HTML);
 assert.equal((await run(request(ORIGIN+'/', 'DE', {headers}))).text,HTML);
 assert.equal(eligible((await run(request(ORIGIN+'/', 'US', {headers:{'CF-IPCountry':'DE'}}))).text),true);
 for(const country of [null,'DE']){const y=await run(request(ORIGIN+'/?country=US',country,{headers}));assert.equal(y.text,HTML);}
});
test('preview/OFF/unknown environments stay negative even with valid platform country',async()=>{
 for(const mode of [undefined,null,'','off','preview','production',true]){
  const x=await run(request(),{env:{AGENTART_HOME_COUNTRY_MODE:mode}});assert.equal(x.text,HTML);
 }
 const x=await run(request(),{env:{AGENTART_HOME_COUNTRY_MODE:undefined,AGENTART_ANALYTICS_ENABLED:'true',AGENTART_CF_SITE_TOKEN:'fixture-not-a-registration'}});assert.equal(x.text,HTML);
});
test('queries, fragments, nonproduction hosts/protocols and noncanonical aliases never get positive geography',async()=>{
 for(const url of [ORIGIN+'/?',ORIGIN+'/#',ORIGIN+'/?source=fixture',ORIGIN+'/#fixture','https://fixture.pages.dev/','http://agentart.work/','https://www.agentart.work/','https://agentart.work:444/','http://127.0.0.1/']){
  const x=await run(request(url));assert.equal(x.text,HTML,url);closedCache(x.response);
 }
});
test('explicit Home alias redirects without geographic material; unsafe alias serves negative static Home',async()=>{
 for(const host of [ORIGIN,'https://fixture.pages.dev']){
  const x=await run(request(host+'/index.html'));assert.equal(x.response.status,308);assert.equal(x.response.headers.get('Location'),'/');assert.equal(x.text,'');assert.equal(x.calls.length,0);closedCache(x.response);
 }
 for(const suffix of ['?','?country=US','#fixture']){
  const x=await run(request(ORIGIN+'/index.html'+suffix));assert.equal(x.text,HTML);assert.equal(x.calls[0].url,ORIGIN+'/');assert.equal(x.response.status,200);
 }
});
test('non-Home and observable encoded aliases pass unchanged to static binding, never rewriting',async()=>{
 for(const url of [ORIGIN+'/about/',ORIGIN+'/agent-art/',ORIGIN+'/documents/docs-manifesto.json',ORIGIN+'/%69ndex.html',ORIGIN+'/%2f',ORIGIN+'//']){
  const base=new Response('fixture static',{status:200,headers:{'Cache-Control':'public,max-age=600'}});let got;
  const r=request(url),result=await worker.fetch(r,{AGENTART_HOME_COUNTRY_MODE:MODE,ASSETS:{fetch:async incoming=>{got=incoming;return base;}}});
  assert.equal(got,r);assert.equal(result,base);assert.equal(await result.text(),'fixture static');
 }
});
test('HEAD has no body, no shared cache/validators and no positive response marker',async()=>{
 const x=await run(request(ORIGIN+'/','US',{method:'HEAD'}));assert.equal(x.text,'');assert.equal(x.response.status,200);closedCache(x.response);assert.equal(x.response.headers.has('Content-Length'),false);
});
test('unsupported methods and asset error/redirect/partial responses preserve status without eligibility',async()=>{
 const r=request(ORIGIN+'/','US',{method:'POST',body:'fixture'});const p=await run(r,{status:405,html:'method unavailable'});assert.equal(p.calls[0].method,'POST');assert.equal(p.response.status,405);assert.equal(p.text,'method unavailable');closedCache(p.response);
 for(const status of [301,404,206,503]){const x=await run(request(),{status,html:'fixture asset outcome',headers:{Location:'/fixture'}});assert.equal(x.response.status,status);assert.equal(x.text,'fixture asset outcome');closedCache(x.response);}
});
test('non-HTML/compressed material is not parsed or granted geographic context',async()=>{
 for(const headers of [{'Content-Type':'application/json'},{'Content-Encoding':'gzip'}]){const x=await run(request(),{html:'fixture raw bytes',headers});assert.equal(x.text,'fixture raw bytes');closedCache(x.response);}
});
test('static missing-marker fallback retains content without eligibility; duplicate/unexpected marker fails bounded',async()=>{
 const without=HTML.replace(NEGATIVE,'');const x=await run(request(),{html:without});assert.equal(x.text,without);closedCache(x.response);
 for(const html of [HTML.replace(NEGATIVE,POSITIVE),HTML.replace(NEGATIVE,NEGATIVE+NEGATIVE),HTML.replace(':false',':null')]){
  const y=await run(request(),{html});assert.equal(y.response.status,503);assert.equal(y.text,'Home context is unavailable.');assert.equal(eligible(y.text),false);closedCache(y.response);
 }
});
test('no cross-request eligibility cache or mutation of the asset binding response',async()=>{
 let loads=0;
 const env={AGENTART_HOME_COUNTRY_MODE:MODE,ASSETS:{fetch:async()=>{loads++;return new Response(HTML,{headers:{'Content-Type':'text/html','Cache-Control':'public,max-age=600'}});}}};
 for(const [country,expected] of [['US',true],['DE',false],['XX',false],['JP',true]]){
  const res=await worker.fetch(request(ORIGIN+'/',country),env);assert.equal(eligible(await res.text()),expected);closedCache(res);
 }
 assert.equal(loads,4);
});
test('platform/asset and body-stream failures remain real failures, not manufactured fallback success',async()=>{
 await assert.rejects(worker.fetch(request(),{ASSETS:{fetch:async()=>{throw Error('fixture asset failure');}}}),/fixture asset failure/);
 const broken=new ReadableStream({start(controller){controller.error(Error('fixture stream failure'));}});
 await assert.rejects(worker.fetch(request(),{ASSETS:{fetch:async()=>new Response(broken,{headers:{'Content-Type':'text/html'}})}}),/fixture stream failure/);
});

const OFF='<script type="application/json" id="home-measurement-config">{"enabled":false,"siteToken":null,"production":false,"policy":"home-native-v1"}</script>';
test('missing explicit policy binding remains OFF despite geography/mode/token',async()=>{
 const x=await run(request(),{html:HTML.replace('</head>',OFF+'</head>'),env:{AGENTART_HOME_MEASUREMENT_MODE:'production-home-v1',AGENTART_HOME_BEACON_TOKEN:'a'.repeat(32)}});assert.equal(eligible(x.text),true);assert.ok(x.text.includes(OFF));assert.doesNotMatch(x.text,/"enabled":true|"siteToken":"a/);
});
test('duplicate/unexpected measurement marker fails without leaking config',async()=>{
 for(const mark of [OFF+OFF,OFF.replace('"enabled":false','"enabled":true'),OFF.replace('home-native-v1','wrong-policy')]){const x=await run(request(),{html:HTML.replace('</head>',mark+'</head>')});assert.equal(x.response.status,503);assert.doesNotMatch(x.text,/siteToken/);}
});
// Actual Worker policy with synthetic Request.cf/ASSETS only; no SDK/runtime.
const qualifiedWorker = worker;
test('actual versioned Worker requires independent policy/mode/URL/country/token guards per request',async()=>{
 const html=HTML.replace('</head>',OFF+'</head>');
 for(const change of [undefined,{AGENTART_HOME_MEASUREMENT_MODE:undefined},{AGENTART_HOME_BEACON_TOKEN:null},{AGENTART_HOME_BEACON_TOKEN:'bad'},{AGENTART_HOME_COUNTRY_MODE:'off'},{AGENTART_HOME_MEASUREMENT_POLICY:undefined},{AGENTART_HOME_MEASUREMENT_POLICY:'wrong'}]){
 const f=fixture({html,env:{AGENTART_HOME_MEASUREMENT_POLICY:'home-native-v1',AGENTART_HOME_MEASUREMENT_MODE:'production-home-v1',AGENTART_HOME_BEACON_TOKEN:'a'.repeat(32),...change}});const res=await qualifiedWorker.fetch(request(),f.env);assert.equal((await res.text()).includes('"enabled":true'),change===undefined);closedCache(res);}
 const f=fixture({html,env:{AGENTART_HOME_MEASUREMENT_POLICY:'home-native-v1',AGENTART_HOME_MEASUREMENT_MODE:'production-home-v1',AGENTART_HOME_BEACON_TOKEN:'a'.repeat(32)}});
 for(const r of [request(ORIGIN+'/','US'),request(ORIGIN+'/','DE'),request('https://fixture.pages.dev/'),request(ORIGIN+'/?fixture'),request(ORIGIN+'/','US',{method:'HEAD'}),request(ORIGIN+'/','XX'),request(ORIGIN+'/#fixture')]){
 const res=await qualifiedWorker.fetch(r,f.env);const body=await res.text();assert.equal(body.includes('"enabled":true'),r.url===ORIGIN+'/'&&r.cf.country==='US'&&r.method==='GET');closedCache(res);}
});
