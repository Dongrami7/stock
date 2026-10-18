import {configuration,quote,financials,safeError} from '../../../../lib/butler-provider';
import {env} from 'cloudflare:workers';
// Shared, fixed-scope public-market diagnostic. The owner-private Sites dispatch
// authenticates browser and service callers; service credentials carry no user ID.
// Never expose credentials, account data, arbitrary URLs or trading operations.
export async function GET(){
 const year=new Date().getUTCFullYear()-1;
 const checks=await Promise.allSettled([quote('005930'),financials('005930',year,'11011','CFS')]);
 const summarize=(r:PromiseSettledResult<any>)=>r.status==='rejected'?{ok:false,error:safeError(r.reason)}:{ok:!!r.value.data&&!r.value.meta?.error&&!r.value.meta?.fallback,error:r.value.meta?.primaryError||r.value.meta?.error||null,fetchedAt:r.value.meta?.fetchedAt||null,source:r.value.meta?.source||null,fallbackAvailable:!!r.value.meta?.fallback};
 let storage:any={connected:false,kiwoomSnapshots:null};
 try{const row=await env.DB!.prepare("SELECT COUNT(*) AS count FROM provider_cache WHERE key LIKE 'butler:kiwoom:quote:%' AND json_extract(meta,'$.rawKey') IS NOT NULL").first<{count:number}>();storage={connected:true,kiwoomSnapshots:row?.count??0};}catch{storage={...storage,error:'데이터 저장 상태 조회 실패'};}
 return Response.json({configuration:configuration(),kiwoom:summarize(checks[0]),dart:summarize(checks[1]),storage},{headers:{'Cache-Control':'private, no-store'}});
}
