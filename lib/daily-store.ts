import {env} from 'cloudflare:workers';
import {validatePublic} from './aik';
import snapshot from '../data/dart-companies.json';
const files=['index.json','quotes_min.json','today.json','disclosures.json'];
export async function importDaily(body:any){
 if(body?.version!==1||!Array.isArray(body.items)||body.items.length<1||body.items.length>20)throw Error('일일 수집 형식 오류');
 const prepared=body.items.map((item:any)=>{
  if(item.kind==='public'&&files.includes(item.file))return {key:item.file,data:validatePublic(item.file,item.data),sourceUrl:'https://aikstockdata.com/data/public/'+item.file};
  const corp=snapshot.companies.find(c=>c.code===item.code);
  if(!corp)throw Error('기업코드 오류');
  if(item.kind==='disclosures'){if(!/^\d{8}$/.test(item.endDate)||!['000','013'].includes(item.data?.status)||!Array.isArray(item.data.list)||item.data.list.some((r:any)=>r.corp_code!==corp.corpCode))throw Error('공시 응답 확인 필요');return {key:`butler:dart:disclosures:${corp.corpCode}:${item.endDate}`,data:item.data,sourceUrl:'https://opendart.fss.or.kr/api/list.json'};}
  if(!Number.isInteger(item.year)||item.year<2015||item.year>new Date().getUTCFullYear()||!['11011','11012','11013','11014'].includes(item.report)||!['CFS','OFS'].includes(item.fs))throw Error('수집 대상 오류');
  if(item.kind!=='financials'||item.data?.status!=='000'||!Array.isArray(item.data.list)||!item.data.list.length||item.data.list.length>1500)throw Error('실제 재무 응답 확인 필요');
  if(item.data.list.some((r:any)=>r.corp_code!==corp.corpCode||String(r.bsns_year)!==String(item.year)||r.reprt_code!==item.report||(r.fs_div&&r.fs_div!==item.fs)))throw Error('기업·기간 불일치');
  return {key:`butler:dart:financial:${corp.corpCode}:${item.year}:${item.report}:${item.fs}`,data:item.data,sourceUrl:'https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json'};
 });
 const now=new Date().toISOString(),written=[];
 for(const item of prepared){
  const text=JSON.stringify(item.data),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(x=>x.toString(16).padStart(2,'0')).join(''),rawKey=`daily/${sha}.json`;
  await env.BUCKET!.put(rawKey,text,{httpMetadata:{contentType:'application/json'}});
  const meta={source:item.key.startsWith('butler:')?'dart':'aik',sourceUrl:item.sourceUrl,rawKey,sha256:sha,fetchedAt:now,checkedAt:now,lastSuccess:now,asOf:item.data.as_of_iso||item.data.as_of||null,error:null,stale:false,servingLastGood:false,refreshMode:'daily',transport:'scheduled-import'};
  await env.DB!.prepare('INSERT INTO provider_cache(key,meta) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET meta=excluded.meta').bind(item.key,JSON.stringify(meta)).run();written.push({key:item.key,sha256:sha});
 }
 const status={lastSuccess:now,written,count:written.length,quoteAsOf:prepared.find((x:any)=>x.key==='quotes_min.json')?.data?.as_of_iso||null};
 await env.DB!.prepare('INSERT INTO provider_cache(key,meta) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET meta=excluded.meta').bind('daily:status',JSON.stringify(status)).run();return status;
}
export async function dailyStatus(){const row=await env.DB!.prepare('SELECT meta FROM provider_cache WHERE key=?').bind('daily:status').first<{meta:string}>();return row?JSON.parse(row.meta):{lastSuccess:null,count:0};}
