import {configuration,companies,quote,financials,disclosures,safeError} from '../../../lib/butler-provider';
import {reports} from '../../../lib/butler-model';
const json=(v:unknown,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(req:Request){
 if(!req.headers.get('oai-authenticated-user-id'))return json({error:'로그인이 필요합니다.'},401);
 const p=new URL(req.url).searchParams,kind=p.get('kind')||'status',code=p.get('code')||'';
 if(kind==='status')return json({configuration:configuration()});
 try{
  if(kind==='search'){const q=(p.get('q')||'').trim().slice(0,50);if(q.length<2)return json({data:[]});const r=await companies();return json({data:(r.data||[]).filter((c:any)=>(c.name+' '+c.code).toLowerCase().includes(q.toLowerCase())).slice(0,25),meta:r.meta});}
  if(!/^[0-9A-Z]{6}$/.test(code))return json({error:'6자리 종목코드를 확인하세요.'},400);
  if(kind==='quote')return json(await quote(code));
  if(kind==='disclosures')return json(await disclosures(code));
  if(kind==='financials'){
   const year=Number(p.get('year')),report=p.get('report')||'',fs=p.get('fs')||'CFS';
   if(!Number.isInteger(year)||year<2015||year>new Date().getUTCFullYear()||!reports[report]||!['CFS','OFS'].includes(fs))return json({error:'연도·보고서·연결/별도 기준을 확인하세요.'},400);
   return json(await financials(code,year,report,fs));
  }
  return json({error:'지원하지 않는 조회입니다.'},400);
 }catch(e){return json({error:safeError(e).message,code:safeError(e).code},502);}
}
