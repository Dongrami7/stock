"""Read credentials on hidden stdin; collect actual source JSON and import it.

Input: {siteUrl, siteToken, dartZipPath}. No secrets are logged or persisted.
Requires Python 3 standard library. The owner-private Site must remain private.
"""
import concurrent.futures, datetime, io, json, pathlib, sys, termios
import urllib.parse, urllib.request, zipfile

if sys.stdin.isatty():
    attrs = termios.tcgetattr(0)
    attrs[3] &= ~termios.ECHO
    termios.tcsetattr(0, termios.TCSANOW, attrs)
print('Ready for private refresh configuration on hidden stdin', flush=True)
config = json.loads(sys.stdin.readline())
site = config['siteUrl'].rstrip('/')
if site != 'https://per-observatory.truetoast17.chatgpt.site':
    raise SystemExit('Unexpected Site origin')
with zipfile.ZipFile(config['dartZipPath']) as archive:
    env = archive.read(next(p for p in archive.namelist() if p.endswith('/.env'))).decode()
key = next(line.partition('=')[2].strip().strip('"').strip("'") for line in env.splitlines() if line.startswith('DART_API_KEY='))
now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9)))
y, m = now.year, now.month
year, report = (y, '11014') if m >= 11 else (y, '11012') if m >= 8 else (y, '11013') if m >= 5 else (y-1, '11011')
end = now.strftime('%Y%m%d')
begin = (now-datetime.timedelta(days=90)).strftime('%Y%m%d')
jobs=[]
for file in ['index.json','quotes_min.json','today.json','disclosures.json']:
    jobs.append(({'kind':'public','file':file}, 'https://aikstockdata.com/data/public/'+file, {}))
for code, corp in [('005930','00126380'),('000660','00164779')]:
    for yr, rp in set([(year,report),(y-1,'11011')]):
        jobs.append(({'kind':'financials','code':code,'year':yr,'report':rp,'fs':'CFS'}, 'https://opendart.fss.or.kr/api/fnlttSinglAcntAll.json', {'crtfc_key':key,'corp_code':corp,'bsns_year':str(yr),'reprt_code':rp,'fs_div':'CFS'}))
    jobs.append(({'kind':'disclosures','code':code,'endDate':end}, 'https://opendart.fss.or.kr/api/list.json', {'crtfc_key':key,'corp_code':corp,'bgn_de':begin,'end_de':end,'page_count':'30','sort':'date','sort_mth':'desc','last_reprt_at':'N'}))

def collect(job):
    item,url,params=job
    label=item.get('file',item.get('code','')+':'+item['kind']+':'+str(item.get('year',''))+':'+item.get('report',''))
    try:
        request=urllib.request.Request(url+('?' + urllib.parse.urlencode(params) if params else ''),headers={'Accept':'application/json'})
        with urllib.request.urlopen(request,timeout=35) as response:
            raw=response.read(6000000)
        data=json.loads(raw)
        if item['kind']!='public' and data.get('status') not in (['000','013'] if item['kind']=='disclosures' else ['000']):
            return None, {'source':label,'ok':False,'status':data.get('status')}
        if item['kind']=='disclosures' and data.get('status')=='013': data['list']=[]
        return {**item,'data':data,'collectedAt':now.isoformat()}, {'source':label,'ok':True,'rows':len(data.get('list',data.get('rows',[]))),'asOf':data.get('as_of_iso') or data.get('as_of')}
    except Exception as error:
        return None, {'source':label,'ok':False,'error':type(error).__name__}

items=[]
statuses=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    for item,status in pool.map(collect,jobs):
        statuses.append(status)
        print(json.dumps(status,ensure_ascii=False),flush=True)
        if item: items.append(item)
if not items: raise SystemExit('No source data; existing snapshots preserved')
public={'version':1,'generatedAt':now.isoformat(),'items':items,'status':statuses}
out=pathlib.Path('.sites-runtime');out.mkdir(exist_ok=True)
(out/'daily-public.json').write_text(json.dumps(public,ensure_ascii=False),encoding='utf-8')
payload=json.dumps({'version':1,'items':items},ensure_ascii=False).encode()
headers={'Content-Type':'application/json','OAI-Sites-Authorization':'Bearer '+config['siteToken']}
request=urllib.request.Request(site+'/api/daily',data=payload,headers=headers,method='POST')
try:
    with urllib.request.urlopen(request,timeout=60) as response: written=json.load(response)
    with urllib.request.urlopen(urllib.request.Request(site+'/api/daily',headers=headers),timeout=30) as response: readback=json.load(response)
    if readback.get('lastSuccess')!=written.get('lastSuccess') or readback.get('count')!=len(items): raise ValueError('Readback mismatch')
    print(json.dumps({'saved':True,'verified':True,'count':len(items),'lastSuccess':readback['lastSuccess']},ensure_ascii=False),flush=True)
except Exception as error:
    print(json.dumps({'saved':False,'error':type(error).__name__,'http':getattr(error,'code',None)}),flush=True)
    raise SystemExit(1)
