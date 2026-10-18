import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
const req=createRequire(realpathSync('node_modules/wrangler/package.json'));
const {Miniflare,createFetchMock}=req('miniflare'),{build}=req('esbuild');
await build({entryPoints:['tests/butler-worker.ts'],bundle:true,format:'esm',platform:'browser',outfile:'.sites-runtime/butler-test.js',external:['cloudflare:workers']});
const mock=createFetchMock();mock.disableNetConnect();
const token='TEST_TOKEN_NOT_REAL',dart='TEST_DART_KEY_NOT_REAL';
mock.get('https://api.kiwoom.com').intercept({path:'/oauth2/token',method:'POST'}).reply(200,JSON.stringify({token,return_code:0,expires_dt:'20991231235959'}));
mock.get('https://api.kiwoom.com').intercept({path:'/api/dostk/stkinfo',method:'POST'}).reply(200,JSON.stringify({stk_nm:'삼성전자',cur_prc:'-70000',flu_rt:'-2.1',per:'10',return_code:0}));
const zip=zipSync({'CORPCODE.xml':strToU8('<result><list><corp_code>00126380</corp_code><corp_name>삼성전자</corp_name><stock_code>005930</stock_code></list></result>')});
mock.get('https://opendart.fss.or.kr').intercept({path:/\/api\/corpCode.xml/}).reply(200,Buffer.from(zip));
const rows=[{account_id:'ifrs-full_Revenue',sj_div:'IS',account_nm:'매출액',thstrm_amount:'40',thstrm_add_amount:'70',frmtrm_add_amount:'50',currency:'KRW',rcept_no:'20260814000001'}];
mock.get('https://opendart.fss.or.kr').intercept({path:/\/api\/fnlttSinglAcntAll.json/}).reply(200,JSON.stringify({status:'000',list:rows}));
mock.get('https://opendart.fss.or.kr').intercept({path:/\/api\/list.json/}).reply(200,JSON.stringify({status:'000',total_count:1,list:[{rcept_no:'20260814000001',report_nm:'반기보고서',rcept_dt:'20260814'}]}));
const persist='.sites-runtime/butler-tests-'+Date.now();
const options={modules:true,scriptPath:'.sites-runtime/butler-test.js',d1Databases:['DB'],d1Persist:persist+'/d1',r2Buckets:['BUCKET'],r2Persist:persist+'/r2',cf:false,fetchMock:mock,bindings:{DART_API_KEY:dart,KIWOOM_APP_KEY:'TEST_APP_KEY_NOT_REAL',KIWOOM_SECRET_KEY:'TEST_SECRET_NOT_REAL'}};
let mf=new Miniflare(options),db=await mf.getD1Database('DB');
await db.prepare('CREATE TABLE provider_cache(key TEXT PRIMARY KEY,meta TEXT NOT NULL)').run();
async function call(q,auth=true){const r=await mf.dispatchFetch('http://localhost/api/butler?'+q,{headers:auth?{'oai-authenticated-user-id':'test-user'}:{}});const text=await r.text();assert.ok(!text.includes(token)&&!text.includes(dart));return {status:r.status,data:JSON.parse(text)}}
try{
 assert.equal((await call('kind=status',false)).status,401);
 assert.equal((await call('kind=quote&code=bad')).status,400);
 assert.equal((await call('kind=financials&code=005930&year=2026&report=bad')).status,400);
 const q=await call('kind=quote&code=005930');assert.equal(q.data.data.price,70000);
 const cached=await call('kind=quote&code=005930');assert.equal(cached.data.meta.cached,true);
 const [f,n]=await Promise.all([call('kind=financials&code=005930&year=2026&report=11012'),call('kind=disclosures&code=005930')]);
 assert.equal(f.data.data.metrics[0].value,70);assert.equal(n.data.data[0].url,'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814000001');
 assert.equal((await call('kind=search&q=삼성전자')).data.data.find(x=>x.code==='005930').corpCode,'00126380');
 const meta=JSON.parse((await db.prepare('SELECT meta FROM provider_cache WHERE key=?').bind('butler:kiwoom:quote:005930').first()).meta);meta.checkedAt='2000-01-01T00:00:00Z';await db.prepare('UPDATE provider_cache SET meta=? WHERE key=?').bind(JSON.stringify(meta),'butler:kiwoom:quote:005930').run();
 await mf.dispose();const failed=createFetchMock();failed.disableNetConnect();failed.get('https://api.kiwoom.com').intercept({path:'/oauth2/token',method:'POST'}).reply(400,'Request Blocked').persist();mf=new Miniflare({...options,fetchMock:failed});
 const stale=await call('kind=quote&code=005930');assert.equal(stale.data.data.price,70000);assert.equal(stale.data.meta.stale,true);assert.equal(stale.data.meta.error.code,'HTTP_400');
 assert.equal((await call('kind=quote&code=005930')).data.meta.cached,true);
 console.log('PASS: authenticated routes, input validation, token/secret redaction, verified corporate snapshot mapping, parallel DART reads, persisted cache, stale fallback, failed-request dampening');
}finally{await mf.dispose()}
