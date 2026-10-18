"""Twelve Data quote collector. Private config on hidden stdin; never publish keys.

Input: {apiKey, symbols:[AAPL,...]}. Requires Python standard library.
Writes ignored .sites-runtime/twelve-quotes.json for private review.
Publishing quotes requires external-display rights; this script does not publish.
"""
import datetime,math,json,pathlib,sys,termios,urllib.request,urllib.parse,re
if sys.stdin.isatty():
 attrs=termios.tcgetattr(0);attrs[3]&=~termios.ECHO;termios.tcsetattr(0,termios.TCSANOW,attrs)
print('Ready for private Twelve Data configuration on hidden stdin',flush=True)
config=json.loads(sys.stdin.readline());key=config.get('apiKey','');symbols=config.get('symbols',[])
if not key or not isinstance(symbols,list) or not 1<=len(symbols)<=8 or any(not isinstance(s,str) or not re.fullmatch(r'[A-Z][A-Z0-9.\-]{0,14}',s) for s in symbols):raise SystemExit('Invalid configuration')
quotes=[];failures=[]
for symbol in dict.fromkeys(symbols):
 try:
  url='https://api.twelvedata.com/quote?'+urllib.parse.urlencode({'symbol':symbol,'apikey':key})
  with urllib.request.urlopen(url,timeout=20) as response:d=json.load(response)
  if d.get('status')=='error':failures.append({'symbol':symbol,'code':d.get('code')});continue
  price=float(d['close'])
  if not math.isfinite(price) or price<=0 or d.get('symbol')!=symbol or d.get('currency')!='USD':raise ValueError('Unsupported quote')
  quotes.append({'symbol':symbol,'price':price,'currency':d['currency'],'datetime':d.get('datetime'),'timestamp':d.get('timestamp'),'is_market_open':d.get('is_market_open'),'source':'Twelve Data','fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()})
 except Exception as e:failures.append({'symbol':symbol,'error':type(e).__name__})
out=pathlib.Path('.sites-runtime');out.mkdir(exist_ok=True);(out/'twelve-quotes.json').write_text(json.dumps({'quotes':quotes,'failures':failures},ensure_ascii=False))
print(json.dumps({'successCount':len(quotes),'failures':failures},ensure_ascii=False))
