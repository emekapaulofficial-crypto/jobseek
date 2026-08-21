"""JobSeek multi-source job-feed updater.

Public feeds are configured in config/job-feeds.json. Secret API credentials are
read only from GitHub Actions environment variables/secrets and are never stored
in source code.
"""
import json, os, re, hashlib
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from xml.etree import ElementTree as ET

OUT='jobs.json'
CONFIG='config/job-feeds.json'

def clean(s): return re.sub(r'\s+', ' ', re.sub('<[^>]+>', ' ', str(s or ''))).strip()
def get(url, headers=None):
    h={'User-Agent':'JobSeek/1.0 public-job-feed'}; h.update(headers or {})
    req=Request(url,headers=h)
    with urlopen(req,timeout=30) as r: return r.read()

def parse_rss(data,source):
    root=ET.fromstring(data); out=[]
    for item in root.findall('.//item'):
        title=clean(item.findtext('title')); link=clean(item.findtext('link')); desc=clean(item.findtext('description'))
        if not title or not link: continue
        guid=clean(item.findtext('guid')) or link
        out.append(record(source,guid,title,desc,link,clean(item.findtext('pubDate')),clean(item.findtext('location')) or 'See listing'))
    return out

def parse_json(data,source):
    obj=json.loads(data); rows=obj if isinstance(obj,list) else obj.get('jobs',obj.get('results',[])); out=[]
    for x in rows:
        if not isinstance(x,dict): continue
        title=clean(x.get('title') or x.get('name')); link=x.get('url') or x.get('link')
        if not title or not link: continue
        out.append(record(source,str(x.get('id') or link),title,x.get('description') or x.get('summary'),link,x.get('published_at') or x.get('date'),x.get('location') or 'See listing',x.get('company')))
    return out

def record(source,guid,title,desc,link,published,location,company=None):
    return {'id':hashlib.sha256((source+guid).encode()).hexdigest()[:16],'title':title,'company':clean(company or source),'location':clean(location),'description':clean(desc)[:1800],'url':link,'source':source,'published_at':clean(published),'fetched_at':datetime.now(timezone.utc).isoformat()}

def adzuna_jobs():
    app_id=os.getenv('ADZUNA_APP_ID'); key=os.getenv('ADZUNA_APP_KEY')
    if not app_id or not key: return [], None
    countries=os.getenv('ADZUNA_COUNTRIES','gb,us,ca,au,de,fr,nl,nz,sg,za,ng').split(',')
    queries=os.getenv('ADZUNA_QUERIES','electrician,construction,driver,cleaner,cook,warehouse,hospitality,healthcare,engineering,technology').split(',')
    out=[]; errors=[]
    for country in countries:
        for q in queries:
            params={'app_id':app_id,'app_key':key,'results_per_page':'50','what':q.strip(),'content-type':'application/json'}
            try:
                data=json.loads(get('https://api.adzuna.com/v1/api/jobs/'+country.strip()+'/search/1?'+urlencode(params)))
                for x in data.get('results',[]):
                    out.append(record('Adzuna',str(x.get('id') or x.get('redirect_url')),x.get('title'),x.get('description'),x.get('redirect_url'),x.get('created'),(x.get('location') or {}).get('display_name') or country,x.get('company',{}).get('display_name')))
            except Exception as e: errors.append({'source':'Adzuna '+country,'query':q,'error':str(e)})
    return out, errors

def main():
    cfg=json.load(open(CONFIG,encoding='utf-8')); all_jobs=[]; errors=[]
    for f in cfg.get('feeds',[]):
        try:
            data=get(f['url']); all_jobs.extend(parse_json(data,f['name']) if f.get('format')=='json' else parse_rss(data,f['name']))
        except Exception as e: errors.append({'source':f.get('name'),'error':str(e)})
    aj,ae=adzuna_jobs(); all_jobs.extend(aj); errors.extend(ae or [])
    unique={j['url'].split('#')[0]:j for j in all_jobs if j.get('url')}
    jobs=list(unique.values())
    payload={'updated_at':datetime.now(timezone.utc).isoformat(),'count':len(jobs),'jobs':jobs,'source_errors':errors,'sources':sorted({j['source'] for j in jobs})}
    with open(OUT,'w',encoding='utf-8') as fp: json.dump(payload,fp,ensure_ascii=False,indent=2)
    print(f'JobSeek: wrote {len(jobs)} jobs from {len(payload["sources"])} sources; {len(errors)} errors')
if __name__=='__main__': main()
