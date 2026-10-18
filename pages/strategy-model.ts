export type Plan={symbol:string;market:'KR'|'US';currency:'KRW'|'USD';name:string;role:string;quantity:number;average:number|null;buyLow:number|null;buyHigh:number|null;trim:number|null;sell1:number|null;sell2:number|null;support:number|null;critical:number|null;memo:string};
export const priceFields=['average','buyLow','buyHigh','trim','sell1','sell2','support','critical'] as const;
export function plan(input:any):Plan{
 const symbol=String(input.symbol||'').trim().toUpperCase(),market=input.market==='US'?'US':'KR';
 if(!(market==='KR'?/^[0-9A-Z]{6}$/:/^[A-Z][A-Z0-9.\-]{0,14}$/).test(symbol))throw Error('시장과 종목코드를 확인하세요.');
 const out:any={symbol,market,currency:market==='KR'?'KRW':'USD',name:String(input.name||symbol).slice(0,80),role:String(input.role||'관찰').slice(0,30),memo:String(input.memo||'').slice(0,3000),quantity:Number(input.quantity||0)};
 if(!Number.isFinite(out.quantity)||out.quantity<0)throw Error('보유수량은 0 이상의 숫자여야 합니다.');
 for(const k of priceFields){out[k]=input[k]==null||input[k]===''?null:Number(input[k]);if(out[k]!==null&&(!Number.isFinite(out[k])||out[k]<=0))throw Error('가격은 양수로 입력하거나 비워두세요.');}
 for(const [lo,hi,label]of [['buyLow','buyHigh','매수'],['sell1','sell2','매도'],['critical','support','지지선']])if(out[lo]!=null&&out[hi]!=null&&out[lo]>out[hi])throw Error(label+' 가격 순서를 확인하세요.');
 return out;
}
export function assessment(p:Plan,price:number|null){
 if(price===null||!Number.isFinite(price)||price<=0)return {state:'시세 미확인',tone:'muted',targetReturn:null,pnl:null};
 let state='관찰',tone='neutral';
 if(p.critical!=null&&price<p.critical){state='핵심 지지 하회 · 재검토';tone='danger';}
 else if(p.support!=null&&price<p.support){state='1차 지지 하회';tone='warn';}
 else if(p.sell2!=null&&price>=p.sell2){state='2차 매도 기준 도달';tone='good';}
 else if(p.sell1!=null&&price>=p.sell1){state='1차 매도 기준 도달';tone='good';}
 else if(p.trim!=null&&price>=p.trim){state='덜어내기 기준 도달';tone='good';}
 else if(p.buyLow!=null&&p.buyHigh!=null&&price>=p.buyLow&&price<=p.buyHigh){state='매수 관찰 구간';tone='good';}
 else if(priceFields.every(k=>k==='average'||p[k]==null)){state='전략 가격 입력 필요';tone='muted';}
 const target=p.sell1??p.trim;return {state,tone,targetReturn:p.average&&target?target/p.average-1:null,pnl:p.average?(price/p.average-1):null};
}
export function prompt(plans:Plan[],quotes:Record<string,any>){return ['다음은 사용자가 직접 입력한 투자 전략입니다. 수치는 거래 지시가 아닌 검토 기준입니다.','실제 시세 기준일, 사용자 가정, 미확인 항목을 구분하고 위험·반대 근거·시나리오·추가 확인 공시를 정리해주세요.','구간 도달을 자동 매수/매도 권고로 단정하지 말고 확정되지 않은 가격이나 전망을 만들어내지 마세요.','통화가 다른 종목은 환율 없이 합산하지 마세요.','',...plans.map(p=>JSON.stringify({plan:p,quote:quotes[p.market+':'+p.symbol]||null,status:assessment(p,quotes[p.market+':'+p.symbol]?.price??null)},null,2))].join('\n');}
