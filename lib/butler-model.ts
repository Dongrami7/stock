// Pure transformations. Amounts are KRW; prices and EPS are KRW/share.
export type Raw = Record<string, any>;
export const reports: Record<string,string> = {'11013':'1분기','11012':'반기','11014':'3분기','11011':'연간'};
export function amount(value: unknown): number|null {
 if(value===null||value===undefined||String(value).trim()===''||String(value).trim()==='-')return null;
 const s=String(value).replaceAll(',','').trim();
 if(!/^[+-]?\d+(\.\d+)?$/.test(s))return null;
 const n=Number(s);return Number.isFinite(n)?n:null;
}
export function ratio(a:number|null,b:number|null){return a!==null&&b!==null&&b>0?a/b:null;}
export function growthValue(a:number|null,b:number|null){return a!==null&&b!==null&&b>0?a/b-1:null;}
export function normalizeKiwoom(raw:Raw,code:string){
 const price=amount(raw.cur_prc),positive=(v:unknown)=>{const n=amount(v);return n!==null&&n>0?n:null};
 return {code,name:String(raw.stk_nm||code),price:price===null?null:Math.abs(price),change:amount(raw.flu_rt),volume:positive(raw.trde_qty),providerPer:positive(raw.per),providerPbr:positive(raw.pbr),providerEps:amount(raw.eps),providerRoe:amount(raw.roe),high52:positive(raw['250hgst']),low52:positive(raw['250lwst']),quoteDate:null,source:'키움 REST · ka10001'};
}
export type Metric={key:string;label:string;value:number|null;previous:number|null;change:number|null;account:string|null;accountId:string|null;basis:string;sourceUrl:string|null;currency:string|null;reason:string|null};
const specs:[string,string,string[],string[],string[]][]=[
 ['revenue','매출액',['ifrs-full_Revenue'],['매출액','수익(매출액)','영업수익'],['IS','CIS']],
 ['operating','영업이익',['dart_OperatingIncomeLoss'],['영업이익','영업이익(손실)','영업손실'],['IS','CIS']],
 ['net','당기순이익',['ifrs-full_ProfitLoss'],['당기순이익','당기순이익(손실)','반기순이익','분기순이익'],['IS','CIS']],
 ['parent','지배기업 순이익',['ifrs-full_ProfitLossAttributableToOwnersOfParent'],['지배기업의 소유주에게 귀속되는 당기순이익(손실)','지배기업 소유주지분'],['IS','CIS']],
 ['cashflow','영업현금흐름',['ifrs-full_CashFlowsFromUsedInOperatingActivities'],['영업활동현금흐름','영업활동으로 인한 현금흐름','영업활동으로부터의 현금흐름'],['CF']],
 ['assets','자산총계',['ifrs-full_Assets'],['자산총계'],['BS']],
 ['liabilities','부채총계',['ifrs-full_Liabilities'],['부채총계'],['BS']],
 ['equity','자본총계',['ifrs-full_Equity'],['자본총계'],['BS']],
 ['cash','현금및현금성자산',['ifrs-full_CashAndCashEquivalents'],['현금및현금성자산','현금 및 현금성자산'],['BS']],
];
export function normalizeFinancials(list:Raw[],year:number,report:string,fs:string){
 const annual=report==='11011';
 const metrics:Metric[]=specs.map(([key,label,ids,names,sections])=>{
  const possible=list.filter(r=>sections.includes(r.sj_div));
  const found=possible.find(r=>ids.includes(r.account_id))||possible.find(r=>names.includes(r.account_nm));
  const income=found&&['IS','CIS'].includes(found.sj_div),balance=sections[0]==='BS';
  const basis=balance?'기말 / 전기말':annual?'연간 / 전년 연간':income||sections[0]==='CF'?'누적 / 전년 동기 누적':'누적';
  if(!found)return {key,label,value:null,previous:null,change:null,account:null,accountId:null,basis,sourceUrl:null,currency:null,reason:'계정 매칭 불가'};
  const currency=found.currency||null;
  let value=amount(income&&!annual?found.thstrm_add_amount:found.thstrm_amount);
  let previous=amount(income&&!annual?found.frmtrm_add_amount:!annual&&!balance?found.frmtrm_q_amount:found.frmtrm_amount);
  // Q1 is already cumulative. H1/Q3 never fall back from YTD to 3-month amounts.
  if(income&&report==='11013'){value??=amount(found.thstrm_amount);previous??=amount(found.frmtrm_q_amount);}
  const reason=currency!=='KRW'?'원화 금액 확인 불가':value===null?'금액 또는 누적 항목 누락':null;
  if(currency!=='KRW'){value=null;previous=null;}
  const receipt=String(found.rcept_no||'');
  return {key,label,value,previous,change:growthValue(value,previous),account:found.account_nm,accountId:found.account_id,basis,currency,reason,sourceUrl:/^\d{14}$/.test(receipt)?'https://dart.fss.or.kr/dsaf001/main.do?rcpNo='+receipt:null};
 });
 const get=(k:string)=>metrics.find(m=>m.key===k)?.value??null;
 return {year,report,period:`${year} ${reports[report]}`,fs,metrics,margin:ratio(get('operating'),get('revenue')),debtRatio:ratio(get('liabilities'),get('equity')),cashConversion:ratio(get('cashflow'),get('net')),missing:metrics.filter(m=>m.value===null).map(m=>m.label),receiptDate:String(list[0]?.rcept_no||'').slice(0,8),notice:'누적 손익을 연간 이익으로 환산하지 않습니다. 부채총계는 순차입금과 다릅니다.'};
}
