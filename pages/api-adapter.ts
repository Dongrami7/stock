import companies from '../data/dart-companies.json';
import {normalizeQuotes,normalizeDisclosure,freshness} from '../lib/aik';
import {normalizeFinancials} from '../lib/butler-model';
type Local=(url:any,init?:any)=>Promise<Response>;
let pending:Promise<any>|null=null;
async function dataset(){if(!pending)pending=fetch(new URL('./data/daily.json',document.baseURI),{cache:'no-store'}).then(async r=>{if(!r.ok)throw Error('일일 데이터 파일 조회 실패');const d:any=await r.json();if(d.version!==1||!Array.isArray(d.items))throw Error('일일 데이터 형식 오류');return d}).catch(e=>{pending=null;throw e});return pending;}
const source=(d:any,file:string)=>d.items.find((x:any)=>x.kind==='public'&&x.file===file)?.data;
const names=new Map(companies.companies.map(c=>[c.code,c.name]));
const meta=(d:any)=>({source:'daily-api',fetchedAt:d.generatedAt,lastSuccess:d.generatedAt,refreshMode:'daily',error:null});
export async function pagesApi(url:any,init:any,local:Local):Promise<Response>{
 const u=new URL(String(url),location.href),p=u.searchParams,kind=p.get('kind')||'overview',code=p.get('code')||'',d=await dataset(),q=source(d,'quotes_min.json'),quotes=q?normalizeQuotes(q):{},idx=source(d,'index.json'),disclosures=source(d,'disclosures.json');
 const response=(v:any,status=200)=>Response.json(v,{status});
 if(u.pathname==='/api/state'){
  const r=await local(url,init);if(init?.body||!r.ok)return r;const state:any=await r.json();
  // Public API rows have no analyst forecasts. Do not synthesize estimates.
  const rows=Object.values(quotes).map((v:any)=>({'코드':v.code,'종목':names.get(v.code)||v.code,'시장':'공개 시세','업종':'업종 미분류','섹터':'미분류','시총':v.marketCapKrw===null?null:v.marketCapKrw/1e8,'주가(10/12)':v.close,'회계 기준':'실적 전망 미제공','27E 기준 기간':'27E 없음'})).filter((v:any)=>typeof v['시총']==='number'&&v['시총']>=0);
  const quoteDate=q?.as_of_iso||q?.as_of||d.generatedAt.slice(0,10);
  const apiSnapshot={id:'daily-api-'+quoteDate,hash:'daily-api-'+quoteDate,created:d.generatedAt,name:'API 종가 · 실적 전망 미제공',priceDate:quoteDate,estimateDate:quoteDate,rows,notes:['API로 수집한 실제 종가·시총입니다. 전망치가 없어 예상 PER·CAGR은 계산하지 않습니다.','자료 기준일과 수집일은 다릅니다.']};
  return response({...state,snapshots:[apiSnapshot,...(state.snapshots||[])]});
 }
 if(u.pathname==='/api/daily')return response({lastSuccess:d.generatedAt,quoteAsOf:q?.as_of_iso,count:d.items.length});
 if(u.pathname==='/api/market'){
  if(kind==='overview'){const latest:any={};for(const e of disclosures?.events||[]){const n=normalizeDisclosure(e);if(!latest[e.code]||n.date>latest[e.code].date)latest[e.code]={...n,label:n.label||n.title};}return response({quotes,index:idx,today:source(d,'today.json'),latest,status:idx?freshness(idx):null,meta:[meta(d),meta(d),meta(d),meta(d)]});}
  return response({stock:null,earnings:[],disclosures:(disclosures?.events||[]).filter((x:any)=>x.code===code).map((x:any)=>normalizeDisclosure(x)),history:null,indices:{},summary:[],method:{},events:[],meta:[{...meta(d),error:'상세 공급자 자료는 일일 수집 범위에 포함되지 않았습니다.'}]});
 }
 if(u.pathname==='/api/butler'){
  if(kind==='status')return response({configuration:{dart:true,kiwoom:false,ordersEnabled:false}});
  if(kind==='search'){const v=(p.get('q')||'').toLowerCase();return response({data:companies.companies.filter(x=>(x.name+' '+x.code).toLowerCase().includes(v)).slice(0,25),meta:meta(d)});}
  if(kind==='quote'){const value=quotes[code];return value?response({data:{code,name:names.get(code)||code,price:value.close,change:value.change===null?null:value.change*100,providerPer:null,providerPbr:null,providerEps:null,quoteDate:value.date},meta:{...meta(d),fallback:true,primaryError:{message:'키움 실시간 시세 미연결 · 공개 API 확정 종가입니다.'}}}):response({data:null,error:'수집한 시세가 없는 종목입니다.'});}
  const company=companies.companies.find(c=>c.code===code),base={company,meta:meta(d)};
  if(kind==='financials'){const item=d.items.find((i:any)=>i.kind==='financials'&&i.code===code&&String(i.year)===p.get('year')&&i.report===p.get('report')&&i.fs===(p.get('fs')||'CFS'));return item?response({...base,data:normalizeFinancials(item.data.list,item.year,item.report,item.fs)}):response({...base,data:null,error:'선택 기업·기간의 재무자료는 아직 수집되지 않았습니다. 현재 삼성전자·SK하이닉스의 최신 정기보고서와 전년도 사업보고서를 수집합니다.'});}
  if(kind==='disclosures'){const item=d.items.find((i:any)=>i.kind==='disclosures'&&i.code===code);return item?response({...base,total:item.data.total_count??0,data:(item.data.list||[]).map((r:any)=>({id:r.rcept_no,title:r.report_nm,date:r.rcept_dt,filer:r.flr_nm,remark:r.rm,url:'https://dart.fss.or.kr/dsaf001/main.do?rcpNo='+r.rcept_no}))}):response({...base,data:[],error:'선택 기업의 공시가 아직 수집되지 않았습니다.'});}
 }
 return local(url,init);
}
(window as any).stockApi=(u:any,i:any,l:Local)=>pagesApi(u,i,l).catch(e=>Response.json({error:e.message},{status:503}));
