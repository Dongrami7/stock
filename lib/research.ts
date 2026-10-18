import {metrics,median,num,flags,type Row,type Snapshot} from './finance';

export const yearKey=(year:number)=>String(year).slice(-2)+'E';
export function peerStats(row:Row,rows:Row[],year:number,min=3){
  const date=row.__quote?.date||'upload',basis=row['회계 기준'],period=row['27E 기준 기간'];
  // The original workbook only documents the 2027 fiscal period. Do not infer other periods.
  if(year!==2027||!basis||!period||period==='27E 없음'||!row['업종'])return {count:0,median:null,discount:null,reason:'동일 회계기간 확인 불가'};
  const peers=rows.filter(r=>r['업종']===row['업종']&&r['회계 기준']===basis&&r['27E 기준 기간']===period&&(r.__quote?.date||'upload')===date&&metrics(r,year).per!==null);
  const center=peers.length>=min?median(peers.map(r=>metrics(r,year).per)):null,p=metrics(row,year).per;
  return {count:peers.length,median:center,discount:p!==null&&center!==null&&center>0?1-p/center:null,reason:peers.length<min?`최소 ${min}개 미달`:null};
}
export function scenario(row:Row,year:number,earningsChange:number,targetPer:number){
  const ni=num(row[yearKey(year)+' 지배순이익']),cap=num(row['시총']);
  if(ni===null||ni<=0||cap===null||cap<=0||!Number.isFinite(earningsChange)||earningsChange<=-1||!Number.isFinite(targetPer)||targetPer<=0)return null;
  const stressed=ni*(1+earningsChange),impliedCap=stressed*targetPer;
  return {earnings:stressed,impliedCap,change:impliedCap/cap-1,fixedPricePer:cap/stressed,requiredEarnings:cap/targetPer,requiredChange:(cap/targetPer)/ni-1};
}
export function revisionAt(row:Row,current:Snapshot|undefined,previous:Snapshot|null,year:number){
  if(!current||!previous)return {value:null,label:'이전 업로드 없음'};
  // Revision requires a different forecast date, not just another quote observation.
  if(current.estimateDate===previous.estimateDate)return {value:null,label:'전망 기준일 동일'};
  const old=previous.rows.find(r=>r['코드']===row['코드']);
  if(!old||old['회계 기준']!==row['회계 기준']||!row['회계 기준']||year!==2027||!row['27E 기준 기간']||old['27E 기준 기간']!==row['27E 기준 기간'])return {value:null,label:'동일 회계기간 확인 불가'};
  const a=num(row[yearKey(year)+' 지배순이익']),b=num(old[yearKey(year)+' 지배순이익']);
  if(a===null||b===null)return {value:null,label:'추정치 없음'};
  if(b<=0)return {value:null,label:a>0?'흑자전환':a>b?'적자축소':a<b?'적자확대':'변동 없음'};
  if(a<=0)return {value:null,label:'적자전환'};
  return {value:a/b-1,label:'동일 연도 순이익 전망'};
}
export function researchFacts(row:Row,rows:Row[],year:number,current?:Snapshot,previous:Snapshot|null=null){
  const m=metrics(row,year),peer=peerStats(row,rows,year),revision=revisionAt(row,current,previous,year);
  const percent=(v:number)=>`${(v*100).toFixed(1)}%`;
  const support:string[]=[],risks=flags(row,year);
  if(m.per!==null)support.push(`${yearKey(year)} 단순 PER ${m.per.toFixed(2)}배`);
  if(peer.discount!==null)support.push(`동일 업종·회계기준·기간 ${peer.count}종목 중앙값 대비 ${peer.discount>=0?'할인':'할증'} ${percent(Math.abs(peer.discount))}`);
  if(m.niCagr!==null)support.push(`2026E~2028E 지배순이익 CAGR ${percent(m.niCagr)}`);
  if(revision.value!==null)support.push(`직전 업로드 대비 동일 연도 순이익 전망 ${percent(revision.value)}`);
  if(m.niCagr!==null&&m.salesCagr!==null&&m.niCagr-m.salesCagr>.3)risks.push('순이익 성장률이 매출 성장률보다 30%p 이상 높음 · 마진/기저 확인');
  if(m.per!==null&&m.per<5)risks.push('5배 미만 저배수 · 업황 고점·일회성 이익 확인');
  const checks=row['섹터']==='금융'?['ROE와 자본건전성','대손비용과 충당금','주주환원 지속 가능성']:risks.some(x=>x.includes('NAV'))?['보유 지분별 NAV와 할인율','상장 자회사 이익 중복','실제 배당·자사주 소각']:['영업현금흐름과 이익의 일치','순차입금·만기 구조','분기 실적과 전망의 근거'];
  return {m,peer,revision,support,risks:[...new Set(risks)],checks};
}

export function portfolioStress(positions:{row:Row;weight:number}[],year:number,earningsChange:number,multipleChange:number){
  const invalid=positions.some(p=>!Number.isFinite(p.weight)||p.weight<0)||!Number.isFinite(multipleChange)||multipleChange<=-1;
  const total=positions.reduce((s,p)=>s+p.weight,0);
  if(invalid||total>100.00001)return null;
  let impact=0,covered=0;
  const contributions=positions.map(p=>{const per=metrics(p.row,year).per,s=per!==null?scenario(p.row,year,earningsChange,per*(1+multipleChange)):null;const contribution=s?s.change*p.weight/100:null;if(contribution!==null){impact+=contribution;covered+=p.weight}return {code:p.row['코드'],weight:p.weight,change:s?.change??null,contribution}});
  return {total,cash:100-total,covered,unpriced:total-covered,impact,contributions};
}
