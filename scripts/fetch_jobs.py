"""JobSeek multi-source updater with conservative direct-employer classification."""
import json,os,re,hashlib
from datetime import datetime,timezone
from urllib.request import Request,urlopen
from urllib.parse import urlencode
from xml.etree import ElementTree as ET
OUT='jobs.json'; CONFIG='config/job-feeds.json'
def clean(s): return re.sub(r'\s+',' ',re.sub('<[^>]+>',' ',str(s or ''))).strip()
def get(url):
 req=Request(url,headers={'User-Agent':'JobSeek/1.0 public-job-feed'})
 with urlopen(req,timeout=30) as r:return r.read()
def direct_flag(desc,source,company=None):
 t=clean(desc).lower(); s=clean(source).lower(); c=clean(company).lower()
 # Conservative: generic aggregators are never treated as proof by themselves.
 evidence=bool(re.search(r'direct apply|posted directly by the employer|apply on (the )?employer|employer.?s own (site|website|career)',t))
 return evidence and bool(c) and c not in {'arbeitnow','remotive','adzuna','jobseek'}
def record(source,guid,title,desc,link,published,location,company=None):
 company=clean(company or '')
 return {'id':hashlib.sha256((source+guid).encode()).hexdigest()[:16],'title':clean(title),'company':company or source,'location':clean(location),'description':clean(desc)[:1800],'url':link,'source':source,'published_at':clean(published),'fetched_at':datetime.now(timezone.utc).isoformat(),'direct_employer':direct_flag(desc,source,company)}
def rss(data,source):
 root=ET.fromstring(data);out=[]
 for x in root.findall('.//item'):
  t=clean(x.findtext('title'));u=clean(x.findtext('link'));d=clean(x.findtext('description'))
  if t and u:out.append(record(source,clean(x.findtext('guid')) or u,t,d,u,clean(x.findtext('pubDate')),clean(x.findtext('location')) or 'See listing'))
 return out
def js(data,source):
 o=json.loads(data);rows=o if isinstance(o,list) else o.get('jobs',o.get('results',[]));out=[]
 for x in rows:
  if not isinstance(x,dict):continue
  t=clean(x.get('title') or x.get('name'));u=x.get('url') or x.get('link')
  if t and u:out.append(record(source,str(x.get('id') or u),t,x.get('description') or x.get('summary'),u,x.get('published_at') or x.get('date'),x.get('location') or 'See listing',x.get('company')))
 return out
def adzuna():
 aid,key=os.getenv('ADZUNA_APP_ID'),os.getenv('ADZUNA_APP_KEY')
 if not aid or not key:return [],[]
 countries=os.getenv('ADZUNA_COUNTRIES','gb,us,ca,au,de,fr,nl,nz,sg,za,ng').split(',');queries=os.getenv('ADZUNA_QUERIES','electrician,construction,driver,cleaner,cook,warehouse,hospitality,engineering').split(',');out=[];err=[]
 for c in countries:
  for q in queries:
   try:
    p=urlencode({'app_id':aid,'app_key':key,'results_per_page':50,'what':q.strip(),'content-type':'application/json'});d=json.loads(get(f'https://api.adzuna.com/v1/api/jobs/{c.strip()}/search/1?{p}'))
    for x in d.get('results',[]):out.append(record('Adzuna',str(x.get('id') or x.get('redirect_url')),x.get('title'),x.get('description'),x.get('redirect_url'),x.get('created'),(x.get('location') or {}).get('display_name') or c,(x.get('company') or {}).get('display_name')))
   except Exception as e:err.append({'source':'Adzuna '+c,'query':q,'error':str(e)})
 return out,err
def main():
 cfg=json.load(open(CONFIG,encoding='utf-8'));jobs=[];errors=[]
 for f in cfg.get('feeds',[]):
  try:jobs += js(get(f['url']),f['name']) if f.get('format')=='json' else rss(get(f['url']),f['name'])
  except Exception as e:errors.append({'source':f.get('name'),'error':str(e)})
 a,e=adzuna();jobs+=a;errors+=e
 unique={j['url'].split('#')[0]:j for j in jobs if j.get('url')};jobs=list(unique.values())
 payload={'updated_at':datetime.now(timezone.utc).isoformat(),'count':len(jobs),'direct_employer_count':sum(1 for j in jobs if j['direct_employer']),'jobs':jobs,'source_errors':errors,'sources':sorted({j['source'] for j in jobs})}
 with open(OUT,'w',encoding='utf-8') as f:json.dump(payload,f,ensure_ascii=False,indent=2)
 print(f'JobSeek: {len(jobs)} jobs; {payload["direct_employer_count"]} direct-employer evidence matches; {len(errors)} source errors')
if __name__=='__main__':main()
