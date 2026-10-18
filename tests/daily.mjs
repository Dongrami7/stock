import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import assert from 'node:assert/strict';
const req=createRequire(realpathSync('node_modules/wrangler/package.json')),{Miniflare}=req('miniflare'),{build}=req('esbuild');
await build({entryPoints:['tests/daily-worker.ts'],bundle:true,format:'esm',platform:'browser',outfile:'.sites-runtime/daily-test.js',external:['cloudflare:workers']});
const mf=new Miniflare({modules:true,scriptPath:'.sites-runtime/daily-test.js',d1Databases:['DB'],r2Buckets:['BUCKET'],cf:false});
try{const db=await mf.getD1Database('DB');await db.prepare('CREATE TABLE provider_cache(key TEXT PRIMARY KEY,meta TEXT NOT NULL)').run();
const post=b=>mf.dispatchFetch('http://localhost/api/daily',{method:'POST',body:JSON.stringify(b)});
const item={kind:'financials',code:'005930',year:2026,report:'11012',fs:'CFS',data:{status:'000',list:[{corp_code:'00126380',bsns_year:'2026',reprt_code:'11012',account_id:'ifrs-full_Revenue',account_nm:'매출액',sj_div:'IS',thstrm_add_amount:'70',currency:'KRW'}]}};
assert.equal((await post({version:1,items:[{...item,data:{...item.data,list:[{...item.data.list[0],corp_code:'wrong'}]}}]})).status,400);
assert.equal((await mf.dispatchFetch('http://localhost/api/daily').then(r=>r.json())).count,0);
const r=await post({version:1,items:[item]});assert.equal(r.status,200);const saved=await r.json(),read=await mf.dispatchFetch('http://localhost/api/daily').then(r=>r.json());assert.equal(saved.lastSuccess,read.lastSuccess);assert.equal(read.count,1);
const row=await db.prepare('SELECT meta FROM provider_cache WHERE key=?').bind('butler:dart:financial:00126380:2026:11012:CFS').first();assert.equal(JSON.parse(row.meta).refreshMode,'daily');
console.log('PASS: reject wrong issuer before writing, persistent daily import, readback and cache basis');
}finally{await mf.dispose()}
