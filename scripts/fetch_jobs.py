"""JobSeek public job-feed updater.

Fetches jobs from public RSS/JSON feeds configured in JOB_FEEDS_JSON.
No credentials are embedded in the repository. A source must expose a public
RSS/Atom or JSON endpoint and the resulting records are normalized into jobs.json.
"""
import json, os, re, hashlib
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

OUT='jobs.json'
DEFAULT_FEEDS=[]

def clean(s):
    return re.sub(r'\\s+', ' ', re.sub('<[^>]+>', ' ', s or '')).strip()

def load_feeds():
    raw=os.getenv('JOB_FEEDS_JSON','')
    if not raw: return DEFAULT_FEEDS
    try: return json.loads(raw)
    except Exception: return DEFAULT_FEEDS

def get(url):
    req=Request(url,headers={'User-Agent':'JobSeek/1.0 public-job-feed'})
    with urlopen(req,timeout=25) as r: return r.read()

def parse_rss(data,source):
    root=ET.fromstring(data); out=[]
    for item in root.findall('.//item'):
        title=clean(item.findtext('title')); link=clean(item.findtext('link')); desc=clean(item.findtext('description'))
        if not title or not link: continue
        guid=clean(item.findtext('guid')) or link
        out.append({'id':hashlib.sha256((source+guid).encode()).hexdigest()[:16],'title':title,'company':source,'location':clean(item.findtext('location')) or 'See listing','description':desc[:1200],'url':link,'source':source,'published_at':clean(item.findtext('pubDate')),'fetched_at':datetime.now(timezone.utc).isoformat()})
    return out

def parse_json(data,source):
    obj=json.loads(data); rows=obj if isinstance(obj,list) else obj.get('jobs',obj.get('results',[])); out=[]
    for x in rows:
        if not isinstance(x,dict): continue
        title=clean(str(x.get('title') or x.get('name') or '')); link=x.get('url') or x.get('link') or ''
        if not title or not link: continue
        guid=str(x.get('id') or link)
        out.append({'id':hashlib.sha256((source+guid).encode()).hexdigest()[:16],'title':title,'company':clean(str(x.get('company') or source)),'location':clean(str(x.get('location') or 'See listing')),'description':clean(str(x.get('description') or x.get('summary') or ''))[:1200],'url':link,'source':source,'published_at':str(x.get('published_at') or x.get('date') or ''),'fetched_at':datetime.now(timezone.utc).isoformat()})
    return out

def main():
    feeds=load_feeds(); all_jobs=[]; errors=[]
    for f in feeds:
        try:
            source=f.get('name','Public feed'); data=get(f['url']); fmt=f.get('format','rss').lower()
            all_jobs.extend(parse_json(data,source) if fmt=='json' else parse_rss(data,source))
        except Exception as e: errors.append({'source':f.get('name','unknown'),'error':str(e)})
    # Deduplicate by normalized URL, keeping the first source record.
    unique={j['url'].split('#')[0]:j for j in all_jobs if j.get('url')}
    jobs=list(unique.values())
    payload={'updated_at':datetime.now(timezone.utc).isoformat(),'count':len(jobs),'jobs':jobs,'source_errors':errors}
    with open(OUT,'w',encoding='utf-8') as fp: json.dump(payload,fp,ensure_ascii=False,indent=2)
    print(f'JobSeek: wrote {len(jobs)} jobs; {len(errors)} feed errors')

if __name__=='__main__': main()
