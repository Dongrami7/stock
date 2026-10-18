import {importDaily,dailyStatus} from '../../../lib/daily-store';
// Shared public-market cache only. Owner-private Sites dispatch authenticates
// service calls. No visitor identity, user records, URLs or secrets are accepted.
const json=(v:any,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'private, no-store'}});
export async function GET(){return json(await dailyStatus())}
export async function POST(req:Request){try{const text=await req.text();if(text.length>6000000)return json({error:'수집 자료 크기 초과'},413);return json(await importDaily(JSON.parse(text)))}catch(e:any){return json({error:e.message||'수집 저장 실패'},400)}}
