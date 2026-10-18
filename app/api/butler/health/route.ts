import {configuration,quote,financials,safeError} from '../../../../lib/butler-provider';
// Shared, fixed-scope public-market diagnostic. The owner-private Sites dispatch
// authenticates browser and service callers; service credentials carry no user ID.
// Never expose credentials, account data, arbitrary URLs or trading operations.
export async function GET(){
 const year=new Date().getUTCFullYear()-1;
 const checks=await Promise.allSettled([quote('005930'),financials('005930',year,'11011','CFS')]);
 const summarize=(r:PromiseSettledResult<any>)=>r.status==='rejected'?{ok:false,error:safeError(r.reason)}:{ok:!!r.value.data&&!r.value.meta?.error,error:r.value.meta?.error||null,fetchedAt:r.value.meta?.fetchedAt||null};
 return Response.json({configuration:configuration(),kiwoom:summarize(checks[0]),dart:summarize(checks[1])},{headers:{'Cache-Control':'private, no-store'}});
}
