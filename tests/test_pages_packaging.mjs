import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const root=fileURLToPath(new URL('../',import.meta.url));
const MARKER='<script type="application/json" id="home-country-config">{"countryEligible":false}</script>';
const HTML='<html><head></head><body><main>Fixture manifesto.</main><footer class="site-footer"></footer><script type="application/json" id="analytics-config">{"enabled":false,"siteToken":null,"production":false}</script></body></html>';
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'agentart-pages-fixture-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 for(const folder of ['scripts','delivery/cloudflare-pages','site/assets','_site/assets','_site/documents','_site/about'])fs.mkdirSync(path.join(dir,folder),{recursive:true});
 fs.writeFileSync(path.join(dir,'package.json'),'{"type":"module"}');
 for(const file of ['scripts/build-cloudflare-pages.mjs','delivery/cloudflare-pages/home-worker.mjs','delivery/cloudflare-pages/measurement.json','site/assets/analytics-home.mjs'])fs.copyFileSync(path.join(root,file),path.join(dir,file));
 const write=(file,body)=>fs.writeFileSync(path.join(dir,file),body);
 write('site/analytics.json','{"enabled":false,"siteToken":null}');write('_site/index.html',HTML);write('_site/about/index.html',HTML);write('_site/assets/fixture.mjs','// inert fixture\n');write('_site/documents/fixture.json','{"fixture":true}');
 const run=(env={})=>spawnSync(process.execPath,['scripts/build-cloudflare-pages.mjs'],{cwd:dir,encoding:'utf8',env:{PATH:process.env.PATH,SITE_BASE_PATH:'',...env}});
 return{dir,write,run,read:file=>fs.readFileSync(path.join(dir,file),'utf8')};
}
test('Pages packaging changes only Home context and delivery and inert Home installer files, preserving static recovery',t=>{
 const f=fixture(t),p=f.run();assert.equal(p.status,0,p.stderr);
 assert.equal(f.read('_site/index.html'),HTML);
 assert.equal(f.read('local/cloudflare-pages/_site/index.html').replace(MARKER,'').replace(/<script type="application\/json" id="home-measurement-config">.*?<\/script>/,'').replace('<meta name="referrer" content="origin">','').replace(/<script type="module" src="\/assets\/analytics-home\.[a-f0-9]{64}\.mjs" referrerpolicy="origin"><\/script>/,''),HTML);
 for(const file of ['about/index.html','assets/fixture.mjs','documents/fixture.json'])assert.equal(f.read('local/cloudflare-pages/_site/'+file),f.read('_site/'+file));
 assert.deepEqual(JSON.parse(f.read('local/cloudflare-pages/_site/_routes.json')),{version:1,include:['/','/index.html'],exclude:[]});
 const headers=f.read('local/cloudflare-pages/_site/_headers');assert.equal((headers.match(/no-store/g)||[]).length,6);assert.equal(headers.includes('/*'),false);
 assert.equal(f.read('local/cloudflare-pages/_site/_worker.js'),f.read('delivery/cloudflare-pages/home-worker.mjs'));
 const manifest=JSON.parse(f.read('local/cloudflare-pages/manifest.json'));assert.equal(manifest.collection,'OFF');assert.equal(manifest.networkRequests,0);assert.equal(Object.keys(manifest.files).length,Object.keys(manifest.source).length+4);
});
test('repackaging is deterministic and leaves original static files unchanged',t=>{
 const f=fixture(t);assert.equal(f.run().status,0);const first=f.read('local/cloudflare-pages/manifest.json');assert.equal(f.run().status,0);assert.equal(f.read('local/cloudflare-pages/manifest.json'),first);assert.equal(f.read('_site/index.html'),HTML);
});
test('forged source/build activation is rejected or remains OFF without a token',t=>{
 const f=fixture(t);assert.equal(f.run({AGENTART_CF_ENABLED:'true',AGENTART_HOME_COUNTRY_MODE:'production-home-country-v1'}).status,0);
 assert.ok(f.read('local/cloudflare-pages/_site/index.html').includes(MARKER));
 f.write('site/analytics.json','{"enabled":true,"siteToken":"fixture"}');assert.notEqual(f.run().status,0);
});
test('subpath, inherited delivery config and leaked public helper cannot enter dedicated Pages artifact',t=>{
 const f=fixture(t);assert.notEqual(f.run({SITE_BASE_PATH:'/preview'}).status,0);
 for(const name of ['_worker.js','_routes.json','_headers','CNAME','wrangler.toml']){
  f.write('_site/'+name,'fixture');assert.notEqual(f.run().status,0,name);fs.unlinkSync(path.join(f.dir,'_site',name));
 }
 f.write('_site/assets/analytics-core.mjs','// fixture');assert.notEqual(f.run().status,0);
});
test('public controls, changed OFF config and unexpected Home context fail before replacing output',t=>{
 const f=fixture(t);assert.equal(f.run().status,0);const before=f.read('local/cloudflare-pages/manifest.json');
 for(const addition of ['<button data-analytics-action="exclude">fixture</button>',MARKER]){
  f.write('_site/index.html',HTML+addition);assert.notEqual(f.run().status,0);assert.equal(f.read('local/cloudflare-pages/manifest.json'),before);
 }
 f.write('_site/index.html',HTML.replace('"production":false','"production":true'));assert.notEqual(f.run().status,0);
});
test('symlinked source or output is rejected rather than traversed or deleted',t=>{
 const f=fixture(t);fs.symlinkSync('fixture.mjs',path.join(f.dir,'_site/assets/link.mjs'));assert.notEqual(f.run().status,0);fs.unlinkSync(path.join(f.dir,'_site/assets/link.mjs'));
 fs.mkdirSync(path.join(f.dir,'local'),{recursive:true});fs.symlinkSync('../_site',path.join(f.dir,'local/cloudflare-pages'));assert.notEqual(f.run().status,0);assert.equal(f.read('_site/index.html'),HTML);
});

test('Pages-only client is content-addressed/exact and static stays collector-free; hints cannot enable',t=>{
 const f=fixture(t);assert.equal(f.run({AGENTART_HOME_MEASUREMENT_POLICY:'home-native-v1',AGENTART_HOME_MEASUREMENT_MODE:'production-home-v1',AGENTART_HOME_BEACON_TOKEN:'a'.repeat(32)}).status,0);
 const manifest=JSON.parse(f.read('local/cloudflare-pages/manifest.json'));
 const names=Object.keys(manifest.files).filter(n=>/^assets\/analytics-home\.[a-f0-9]{64}\.mjs$/.test(n));assert.equal(names.length,1);
 assert.equal(f.read('local/cloudflare-pages/_site/'+names[0]),f.read('site/assets/analytics-home.mjs'));
 assert.ok(f.read('local/cloudflare-pages/_site/index.html').includes('id="home-measurement-config">{"enabled":false,"siteToken":null,"production":false,"policy":"home-native-v1"}'));
 assert.doesNotMatch(f.read('_site/index.html'),/home-measurement|analytics-home/);assert.doesNotMatch(f.read('local/cloudflare-pages/_site/about/index.html'),/home-measurement|analytics-home/);
 const before=f.read('local/cloudflare-pages/manifest.json');f.write('delivery/cloudflare-pages/measurement.json','{"enabled":true,"siteToken":"fixture","sourceQualified":true}');assert.notEqual(f.run().status,0);assert.equal(f.read('local/cloudflare-pages/manifest.json'),before);
});
