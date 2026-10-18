import {env} from 'cloudflare:workers';
import {unzipSync,strFromU8} from 'fflate';
import {normalizeFinancials,normalizeKiwoom,type Raw} from './butler-model';
import {sourceFile} from './provider';
import {normalizeQuotes} from './aik';
import corporateSnapshot from '../data/dart-companies.json';
type Runtime={DART_API_KEY?:string;KIWOOM_APP_KEY?:string;KIWOOM_SECRET_KEY?:string;DB?:D1Database;BUCKET?:R2Bucket};
const runtime=()=>env as unknown as Runtime;
export class ProviderError extends Error {constructor(public code:string,message:string){super(message);}}
const inFlight=new Map<string,Promise<any>>();
let token:{value:string;expires:number}|null=null,tokenPending:Promise<string>|null=null;
export function configuration(){const e=runtime();return {dart:!!e.DART_API_KEY,kiwoom:!!(e.KIWOOM_APP_KEY&&e.KIWOOM_SECRET_KEY),ordersEnabled:false};}
function safeError(error:unknown){return error instanceof ProviderError?{code:error.code,message:error.message}:{code:'NETWORK',message:'통신에 실패했습니다. 잠시 후 다시 조회하세요.'};}
function publicMessage(value:unknown){let s=String(value||'').slice(0,600);const e=runtime();for(const secret of [e.DART_API_KEY,e.KIWOOM_APP_KEY,e.KIWOOM_SECRET_KEY,token?.value])if(secret)s=s.replaceAll(secret,'[비공개]');return s.replace(/https?:\/\/\S+/g,'[주소]').slice(0,160);}
async function fetchJson(url:string,init:RequestInit={},provider='DART'){
 let r:Response;try{r=await fetch(url,{...init,signal:AbortSignal.timeout(18000)});}catch{throw new ProviderError('NETWORK',`${provider} 연결 시간 초과 또는 네트워크 오류`);}
 if(!r.ok)throw new ProviderError('HTTP_'+r.status,`${provider} HTTP ${r.status} · API 사용 설정과 등록 IP, 서비스 상태를 확인하세요.`);
 try{return await r.json() as Raw}catch{throw new ProviderError('FORMAT',`${provider} 응답 형식 오류`);}
}
async function cached(key:string,ttl:number,fetcher:()=>Promise<any>){
 if(inFlight.has(key))return inFlight.get(key)!;
 const task=(async()=>{
  const e=runtime(),now=Date.now();let previous:any=null;
  try{const row=await e.DB?.prepare('SELECT meta FROM provider_cache WHERE key=?').bind('butler:'+key).first<{meta:string}>();if(row)previous=JSON.parse(row.meta);}catch{}
  const load=async()=>{try{return previous?.rawKey?(await e.BUCKET?.get(previous.rawKey))?.json():null}catch{return null}};
  // Also damp repeated failures, including unsuccessful first requests.
  const validFor=previous?.refreshMode==='daily'?86400000:ttl;
  if(previous&&now-Date.parse(previous.checkedAt)<Math.min(validFor,previous.error?60000:validFor)){
   const data=await load();return {data,meta:{...previous,cached:true}};
  }
  try{
   const data=await fetcher(),serialized=JSON.stringify(data),hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(serialized)))).map(x=>x.toString(16).padStart(2,'0')).join('');
   const rawKey=`butler/${key}/${hash}.json`,stamp=new Date().toISOString();
   const meta={source:key.split(':')[0],fetchedAt:stamp,checkedAt:stamp,lastSuccess:stamp,rawKey,error:null,stale:false,cached:false};
   if(e.BUCKET&&e.DB){try{await e.BUCKET.put(rawKey,serialized,{httpMetadata:{contentType:'application/json'}});await e.DB.prepare('INSERT INTO provider_cache(key,meta) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET meta=excluded.meta').bind('butler:'+key,JSON.stringify(meta)).run();}catch{}}
   return {data,meta};
  }catch(error){
   const meta={...previous,source:key.split(':')[0],checkedAt:new Date().toISOString(),error:safeError(error),stale:!!previous?.rawKey,cached:false};
   try{await e.DB?.prepare('INSERT INTO provider_cache(key,meta) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET meta=excluded.meta').bind('butler:'+key,JSON.stringify(meta)).run();}catch{}
   return {data:await load(),meta};
  }
 })();inFlight.set(key,task);try{return await task}finally{inFlight.delete(key)}
}
async function dart(file:string,params:Record<string,string>){
 const key=runtime().DART_API_KEY;if(!key)throw new ProviderError('NOT_CONFIGURED','DART 인증키 미설정');
 const data=await fetchJson('https://opendart.fss.or.kr/api/'+file+'?'+new URLSearchParams({...params,crtfc_key:key}));
 if(data.status==='013')return {...data,list:[]};
 if(data.status!=='000')throw new ProviderError('DART_'+data.status,({'010':'DART 인증키 등록 확인 필요','011':'DART 인증키 사용 중지','012':'DART 허용 IP 확인 필요','020':'DART 호출 한도 초과','800':'DART 서비스 점검 중'} as Record<string,string>)[data.status]||'DART 요청 실패 · 상태 '+String(data.status).slice(0,6));
 return data;
}
export async function companies(refresh=false){if(!refresh&&Date.now()-Date.parse(corporateSnapshot.asOf+'T00:00:00Z')<30*86400000)return {data:corporateSnapshot.companies,meta:{source:'dart',mappingSnapshot:corporateSnapshot.asOf,cached:true,stale:false,error:null}};const result=await cached('dart:companies',24*3600000,async()=>{
 const key=runtime().DART_API_KEY;if(!key)throw new ProviderError('NOT_CONFIGURED','DART 인증키 미설정');
 let r:Response;try{r=await fetch('https://opendart.fss.or.kr/api/corpCode.xml?'+new URLSearchParams({crtfc_key:key}),{signal:AbortSignal.timeout(22000)});}catch{throw new ProviderError('NETWORK','DART 기업 목록 연결 실패');}
 if(!r.ok)throw new ProviderError('DART_HTTP','DART 기업 목록 응답 오류');
 const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>20000000)throw new ProviderError('SIZE','기업 목록 크기 초과');
 if(bytes[0]!==80||bytes[1]!==75)throw new ProviderError('DART_KEY','DART 기업 목록 확인 실패 · 인증키와 허용 IP 확인');
 const zip=unzipSync(bytes),file=Object.values(zip)[0];if(!file)throw new ProviderError('FORMAT','기업 목록 형식 오류');
 const xml=strFromU8(file),records=[];
 for(const m of xml.matchAll(/<list>([\s\S]*?)<\/list>/g)){
  const get=(tag:string)=>m[1].match(new RegExp('<'+tag+'>([\\s\\S]*?)</'+tag+'>'))?.[1]?.trim()||'';
  const stock=get('stock_code');if(/^[0-9A-Z]{6}$/.test(stock))records.push({code:stock,corpCode:get('corp_code'),name:get('corp_name').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>')});
 }
 if(!records.length)throw new ProviderError('FORMAT','상장기업 목록 없음');return records;
});return result.data?result:{data:corporateSnapshot.companies,meta:{...result.meta,mappingSnapshot:corporateSnapshot.asOf,stale:true}};}
export async function resolveCorp(code:string){const known=corporateSnapshot.companies.find(r=>r.code===code);if(known)return {...known,mappingSnapshot:corporateSnapshot.asOf};const c=await companies(true);const found=c.data?.find((r:any)=>r.code===code);if(!found)throw new ProviderError('CORP_NOT_FOUND',c.meta.error?.message||'DART 기업코드 미확인 · ETF·우선주 등은 발행기업 코드로 확인하세요.');return found;}
async function accessToken(){
 if(token&&token.expires>Date.now()+60000)return token.value;
 if(tokenPending)return tokenPending;
 tokenPending=(async()=>{const e=runtime();if(!e.KIWOOM_APP_KEY||!e.KIWOOM_SECRET_KEY)throw new ProviderError('NOT_CONFIGURED','키움 API 키 미설정');
  const data=await fetchJson('https://api.kiwoom.com/oauth2/token',{method:'POST',headers:{'Content-Type':'application/json;charset=UTF-8'},body:JSON.stringify({grant_type:'client_credentials',appkey:e.KIWOOM_APP_KEY,secretkey:e.KIWOOM_SECRET_KEY})},'키움');
  if(!data.token||Number(data.return_code||0)!==0)throw new ProviderError('KIWOOM_AUTH','키움 인증 실패 ['+String(data.return_code??'미확인').slice(0,12)+'] · '+publicMessage(data.return_msg||'앱키·시크릿키·등록 IP·사용 신청 상태 확인'));
  const s=String(data.expires_dt||''),expiry=/^\d{14}$/.test(s)?Date.parse(`${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}T${s.slice(8,10)}:${s.slice(10,12)}:${s.slice(12,14)}+09:00`):Date.now()+3600000;
  token={value:data.token,expires:expiry};return token.value;
 })();try{return await tokenPending}finally{tokenPending=null}
}
export async function quote(code:string){const primary=await cached('kiwoom:quote:'+code,30000,async()=>{
 const access=await accessToken();const data=await fetchJson('https://api.kiwoom.com/api/dostk/stkinfo',{method:'POST',headers:{'Content-Type':'application/json;charset=UTF-8',authorization:'Bearer '+access,'api-id':'ka10001'},body:JSON.stringify({stk_cd:code})},'키움');
 if(Number(data.return_code||0)!==0){token=null;throw new ProviderError('KIWOOM_QUOTE','키움 시세 조회 실패 · 사용 권한과 종목코드 확인');}
 const result=normalizeKiwoom(data,code);if(!result.name||result.price===null)throw new ProviderError('QUOTE_EMPTY','키움 시세 값이 없습니다.');return result;
});if(primary.data)return primary;
 const publicData=await sourceFile('quotes_min.json');
 const value=publicData.data?normalizeQuotes(publicData.data)[code]:null;
 if(!value?.close)return primary;
 return {data:{code,name:corporateSnapshot.companies.find(c=>c.code===code)?.name||code,price:value.close,change:value.change===null?null:value.change*100,providerPer:null,providerPbr:null,providerEps:null,quoteDate:value.date},meta:{...publicData.meta,source:'aik',fallback:true,primaryError:primary.meta.error,stale:!!publicData.meta.error,error:null}};
}
export async function financials(code:string,year:number,report:string,fs:string){
 const corp=await resolveCorp(code);const response=await cached(`dart:financial:${corp.corpCode}:${year}:${report}:${fs}`,30*60000,async()=>dart('fnlttSinglAcntAll.json',{corp_code:corp.corpCode,bsns_year:String(year),reprt_code:report,fs_div:fs}));
 return {company:corp,meta:response.meta,data:response.data?.list?.length?normalizeFinancials(response.data.list,year,report,fs):null,noData:response.data?.status==='013'};
}
export async function disclosures(code:string){
 const corp=await resolveCorp(code),end=new Date(),begin=new Date(end);begin.setUTCDate(begin.getUTCDate()-90);
 const fmt=(d:Date)=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul'}).format(d).replaceAll('-','');
 const response=await cached(`dart:disclosures:${corp.corpCode}:${fmt(end)}`,5*60000,async()=>dart('list.json',{corp_code:corp.corpCode,bgn_de:fmt(begin),end_de:fmt(end),page_count:'30',sort:'date',sort_mth:'desc',last_reprt_at:'N'}));
 return {company:corp,meta:response.meta,total:response.data?.total_count??null,data:(response.data?.list||[]).map((r:Raw)=>({id:r.rcept_no,title:r.report_nm,date:r.rcept_dt,filer:r.flr_nm,remark:r.rm,url:/^\d{14}$/.test(r.rcept_no)?'https://dart.fss.or.kr/dsaf001/main.do?rcpNo='+r.rcept_no:null}))};
}
export {safeError};
