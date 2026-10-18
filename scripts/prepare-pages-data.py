"""Turn collected public API responses into the Pages dataset and daily report."""
import datetime,json,pathlib,sys
source=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '.sites-runtime/daily-public.json')
d=json.loads(source.read_text())
for item in d['items']:item.setdefault('collectedAt',d['generatedAt'])
if len(sys.argv)>2 and pathlib.Path(sys.argv[2]).exists():
 old=json.loads(pathlib.Path(sys.argv[2]).read_text())
 def identity(i):return (i['kind'],i.get('file'),i.get('code'),i.get('year'),i.get('report'),i.get('fs'))
 present={identity(i) for i in d['items']}
 for item in old.get('items',[]):
  if identity(item) not in present:
   item.setdefault('collectedAt',old['generatedAt']);d['items'].append(item)
names={c['code']:c['name'] for c in json.loads(pathlib.Path('data/dart-companies.json').read_text())['companies']}
q=next((i['data'] for i in d['items'] if i.get('file')=='quotes_min.json'),None)
if not q:raise SystemExit('No verified quote response; do not replace published data')
cols=q['columns'];rows=[dict(zip(cols,r)) for r in q['rows']];assert len(rows)==q['n'] and len(rows)>1000
date=datetime.datetime.fromisoformat(d['generatedAt']).astimezone(datetime.timezone(datetime.timedelta(hours=9))).date().isoformat()
def number(n):
 try:return f'{float(str(n).replace(",","")):,.0f}'
 except:return '미확인'
lines=[f'# 주식시장 일간 보고서 · {date}','',f'- 수집시각: {d["generatedAt"]}',f'- 실제 종가 기준일: {q.get("as_of_iso",q.get("as_of"))}',f'- API 시세 수록: {len(rows):,}종목','- 주말·공휴일에는 종가 기준일이 이전 거래일로 유지될 수 있습니다.','- 키움 API는 등록 IP 문제로 미연결입니다. 아래 가격은 공개 API 확정 종가입니다.','','## 주요 기업 시세','', '| 기업 | 종가(원) | 등락률 | 시가총액(억원) |','|---|---:|---:|---:|']
for code in ['005930','000660']:
 r=next((r for r in rows if r.get('c')==code),{})
 cap=r.get('mrktTotAmt');cap=number(float(cap)/1e8) if cap is not None else '미확인'
 lines.append(f'| {names.get(code,code)} | {number(r.get("clpr"))} | {r.get("fltRt","미확인")}% | {cap} |')
lines+=['','## 정기보고서 확인','']
for i in d['items']:
 if i['kind']!='financials' or i['report']=='11011':continue
 basis={'11012':'반기 누적','11013':'1분기 누적','11014':'3분기 누적'}.get(i['report'],i['report'])
 lines.append(f'### {names.get(i["code"],i["code"])} · {i["year"]} {basis} · 연결')
 for label,ids in [('매출액',['ifrs-full_Revenue']),('영업이익',['dart_OperatingIncomeLoss'])]:
  r=next((r for r in i['data']['list'] if r.get('account_id') in ids and r.get('sj_div') in ['IS','CIS']),{})
  v=r.get('thstrm_add_amount') if i['report']!='11011' else r.get('thstrm_amount')
  amount=number(float(v.replace(',',''))/1e8)+'억원' if v and r.get('currency')=='KRW' else '미확인'
  lines.append(f'- {label}: {amount}')
 receipt=next((r.get('rcept_no') for r in i['data']['list'] if r.get('rcept_no')),None)
 if receipt:lines.append(f'- 원문: https://dart.fss.or.kr/dsaf001/main.do?rcpNo={receipt}')
 lines.append('')
lines+=['## 최근 공시','']
for i in d['items']:
 if i['kind']=='disclosures':
  for r in i['data'].get('list',[])[:3]:lines.append(f'- {names.get(i["code"],i["code"])} · {r.get("rcept_dt")} · {r.get("report_nm")} · https://dart.fss.or.kr/dsaf001/main.do?rcpNo={r.get("rcept_no")}')
lines+=['','## 수집 상태와 해석 범위','']
for s in d['status']:lines.append(f'- {s["source"]}: '+('성공' if s['ok'] else '실패 · 기존 자료 보존 필요'))
lines+=['','## 다음 확인 사항','','- 잠정 실적과 정기보고서 확정 실적을 구분합니다.','- 공개 시세만 있는 기업의 예상 PER·EPS·CAGR은 미제공입니다. 전망치는 별도 자료를 업로드해야 합니다.','- 이 보고서는 API 사실 요약이며 LLM 분석·매매 신호가 아닙니다.','','출처: 금융감독원 OpenDART https://opendart.fss.or.kr / 한국주식데이터 https://aikstockdata.com . 원천별 이용 조건을 따릅니다.']
d['reportDate']=date;d['report']='\n'.join(lines)+'\n';source.write_text(json.dumps(d,ensure_ascii=False))
(source.parent/'daily-report.md').write_text(d['report'])
print(json.dumps({'reportDate':date,'quotes':len(rows),'financialResponses':sum(i['kind']=='financials' for i in d['items']),'reportCharacters':len(d['report'])}))
