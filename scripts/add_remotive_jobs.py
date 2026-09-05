"""Merge Remotive's public remote-job feed into jobs.json.
Remotive is treated as a discovery source; each listing keeps its original URL and
is not called employer-verified merely because it came from this source.
"""
import hashlib, html, json, re, urllib.request
from datetime import datetime, timezone

OUT='jobs.json'; URL='https://remotive.com/api/remote-jobs'
SCAM=re.compile(r'\b(pay\s+to\s+apply|registration\s+fee|processing\s+fee|crypto\s+payment|gift\s+card|western\s+union|telegram\s+only|whatsapp\s+only)\b',re.I)

def clean(v):
    v=html.unescape(str(v or ''));v=re.sub(r'<[^>]+>',' ',v);return re.sub(r'\s+',' ',v).strip()

def fetch():
    req=urllib.request.Request(URL,headers={'User-Agent':'JobSeek-AI-Agent/1.0'})
    with urllib.request.urlopen(req,timeout=30) as r:return json.loads(r.read())

def normalize(x):
    title=clean(x.get('title'));url=clean(x.get('url'))
    if not title or not url:return None
    desc=clean(x.get('description'));company=clean(x.get('company_name'))
    location=clean(x.get('candidate_required_location') or 'Remote')
    risk='high' if SCAM.search(' '.join([title,desc,company,url])) else 'low'
    return {'id':hashlib.sha256(('Remotive|'+url).encode()).hexdigest()[:16],'title':title,'company':company or 'Remotive listing','location':location,'description':desc[:2200],'url':url,'apply_url':url,'source':'Remotive','source_url':url,'published_at':clean(x.get('publication_date')),'fetched_at':datetime.now(timezone.utc).isoformat(),'category':clean(x.get('category') or 'Remote & Freelance'),'employment_type':clean(x.get('job_type')),'salary':clean(x.get('salary')),'remote':True,'direct_employer':False,'source_trusted':True,'quality_score':85 if risk=='low' else 25,'risk_level':risk,'risk_flags':[] if risk=='low' else ['scam_language'],'verification_status':'source_verified' if risk=='low' else 'needs_review','apply_url_checked':False,'apply_url_status':'not_checked'}

def main():
    with open(OUT,encoding='utf-8') as f:p=json.load(f)
    existing=p.get('jobs',[]);keys={re.sub(r'#.*$','',str(j.get('url',''))).rstrip('/').lower() for j in existing}
    added=0
    try:
        for x in fetch().get('jobs',[]):
            j=normalize(x);k=re.sub(r'#.*$','',j['url']).rstrip('/').lower() if j else ''
            if j and k and k not in keys and j['risk_level']!='high':existing.append(j);keys.add(k);added+=1
    except Exception as e:
        p.setdefault('source_errors',[]).append({'source':'Remotive','error':str(e)})
    p['jobs']=existing;p['count']=len(existing);p['sources']=sorted({str(j.get('source','')) for j in existing if j.get('source')});p['verified_source_count']=sum(1 for j in existing if j.get('verification_status') in {'source_verified','verified'});p['needs_review_count']=sum(1 for j in existing if j.get('verification_status')=='needs_review');p.setdefault('agent',{})['last_remotive_merge']=datetime.now(timezone.utc).isoformat()
    with open(OUT,'w',encoding='utf-8') as f:json.dump(p,f,ensure_ascii=False,indent=2)
    print(f'Remotive merge: added={added}, total={len(existing)}')
if __name__=='__main__':main()
