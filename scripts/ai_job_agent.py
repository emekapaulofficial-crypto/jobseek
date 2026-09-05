"""JobSeek job discovery and evidence-based verification agent.

Listings are discovery data, not hiring guarantees. A listing becomes VERIFIED
only after the configured evidence checks pass; otherwise it remains NOT CONFIRMED
or is removed when it is clearly expired/scam-risk.
"""
import hashlib
import html
import json
import os
import re
import socket
from datetime import datetime, timezone
from urllib.parse import urlparse, urlencode
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

OUT = "jobs.json"
CONFIG = "config/job-feeds.json"
USER_AGENT = "JobSeek-AI-Agent/2.0"
TRUSTED_SOURCES = {"arbeitnow", "adzuna", "jobicy", "remoteok", "remotive"}
SCAM_TERMS = re.compile(r"\b(pay\s+to\s+apply|registration\s+fee|processing\s+fee|buy\s+equipment|crypto\s+payment|gift\s+card|western\s+union|telegram\s+only|whatsapp\s+only|guaranteed\s+income)\b", re.I)
VISA_TERMS = re.compile(r"\b(visa sponsorship|visa sponsor|sponsorship available|sponsor visa|work permit sponsorship|work permit provided|employer sponsorship|immigration sponsorship|sponsorship provided)\b", re.I)
NO_VISA_TERMS = re.compile(r"\b(no sponsorship|without sponsorship|must have right to work|must already have work authorization|no visa sponsorship|unable to sponsor)\b", re.I)
CATEGORY_RULES = {
    "Construction & Skilled Trades": ["construction", "electrician", "welder", "plumber", "carpenter", "mason", "bricklayer", "roofer", "mechanic", "scaffolder", "laborer"],
    "Farming & Agriculture": ["farm", "agriculture", "fruit picker", "harvest", "greenhouse", "livestock", "poultry", "dairy", "tractor", "irrigation", "horticulture", "orchard", "vineyard"],
    "Technology & IT": ["software", "developer", "programmer", "devops", "cloud", "cybersecurity", "it support", "data analyst", "data scientist", "qa", "frontend", "backend", "full stack"],
    "Healthcare": ["nurse", "nursing", "doctor", "medical", "healthcare", "caregiver", "pharmacy", "dental"],
    "Engineering": ["civil engineer", "mechanical engineer", "electrical engineer", "chemical engineer", "engineering"],
    "Driving & Transport": ["driver", "truck", "delivery", "transport", "chauffeur"],
    "Logistics & Warehouse": ["warehouse", "logistics", "supply chain", "forklift", "picker", "packer"],
    "Hospitality & Catering": ["hotel", "hospitality", "chef", "cook", "restaurant", "catering", "housekeeping"],
    "Cleaning & Facilities": ["cleaner", "cleaning", "janitor", "facilities", "maintenance"],
    "Security": ["security", "guard", "loss prevention"],
    "Finance & Accounting": ["accountant", "accounting", "finance", "auditor", "bookkeeper"],
    "Administration": ["administrator", "administrative", "office assistant", "receptionist", "hr assistant"],
    "Sales & Customer Service": ["sales", "customer service", "customer support", "account manager", "call center"],
    "Marketing & Design": ["marketing", "seo", "content", "copywriter", "graphic designer", "designer", "social media"],
    "Education": ["teacher", "tutor", "lecturer", "education", "school"],
    "Retail": ["retail", "store", "cashier", "merchandiser"],
}

def clean(value):
    value = html.unescape(str(value or ""))
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", value).strip()

def fetch(url):
    req = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json, application/rss+xml, application/xml, text/xml, */*"})
    with urlopen(req, timeout=30) as response:
        return response.read(), response.geturl()

def check_url(url):
    try:
        parsed = urlparse(url)
        if parsed.scheme not in {"http", "https"} or not parsed.hostname:
            return False, "invalid_url"
        socket.gethostbyname(parsed.hostname)
        req = Request(url, headers={"User-Agent": USER_AGENT}, method="HEAD")
        with urlopen(req, timeout=12) as response:
            return 200 <= response.status < 400, str(response.status)
    except Exception:
        try:
            req = Request(url, headers={"User-Agent": USER_AGENT}, method="GET")
            with urlopen(req, timeout=12) as response:
                return 200 <= response.status < 400, str(response.status)
        except Exception as exc:
            return False, type(exc).__name__

def category_for(title, description):
    text = f"{title} {description}".lower()
    for category, terms in CATEGORY_RULES.items():
        if any(term in text for term in terms):
            return category
    return "Other"

def parse_date(value):
    text = clean(value)
    if not text:
        return None
    # Keep parsing deliberately conservative. Unknown formats are not treated as expired.
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d", "%a, %d %b %Y %H:%M:%S %z"):
        try:
            dt = datetime.strptime(text, fmt)
            if dt.tzinfo is None: dt = dt.replace(tzinfo=timezone.utc)
            return dt.astimezone(timezone.utc)
        except ValueError:
            pass
    return None

def risk_for(title, description, company, url):
    text = f"{title} {description} {company} {url}"
    hits = SCAM_TERMS.findall(text)
    if hits:
        return "high", sorted(set(hits))
    return "low", []

def normalize(source, item):
    title = clean(item.get("title") or item.get("jobTitle") or item.get("name"))
    url = clean(item.get("url") or item.get("link"))
    if not title or not url: return None
    description = clean(item.get("description") or item.get("jobDescription") or item.get("summary") or item.get("jobExcerpt"))
    company = clean(item.get("company") or item.get("companyName"))
    location = clean(item.get("location") or item.get("jobGeo") or "See listing")
    published = clean(item.get("published_at") or item.get("pubDate") or item.get("created") or item.get("date"))
    closing = clean(item.get("closing") or item.get("closing_date") or item.get("deadline") or item.get("expires") or item.get("expirationDate"))
    risk, risk_flags = risk_for(title, description, company, url)
    text = f"{title} {description} {location}"
    visa = bool(VISA_TERMS.search(text)) and not bool(NO_VISA_TERMS.search(text))
    visa_evidence = VISA_TERMS.findall(text) if visa else []
    source_key = source.lower().replace(" ", "")
    return {
        "id": hashlib.sha256((source + "|" + url).encode()).hexdigest()[:16],
        "title": title, "company": company, "location": location,
        "description": description[:3000], "url": url, "apply_url": url,
        "source": source, "source_url": url, "published_at": published,
        "closing_date": closing or "Not specified",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "category": category_for(title, description),
        "employment_type": clean(item.get("jobType") or item.get("type") or item.get("employment_type")),
        "salary": clean(item.get("salary") or ""),
        "remote": bool(re.search(r"remote|work from home|anywhere", text, re.I)),
        "direct_employer": bool(company),
        "source_trusted": source_key in TRUSTED_SOURCES,
        "visa_sponsorship": visa,
        "visa_evidence": sorted(set(visa_evidence)),
        "risk_level": risk, "risk_flags": risk_flags,
        "verification_status": "NOT CONFIRMED",
        "verification_reasons": [],
        "verification_checked_at": None,
        "apply_url_checked": False, "apply_url_status": "not_checked",
    }

def from_json(data, source):
    obj = json.loads(data)
    rows = obj.get("jobs", obj.get("results", [])) if isinstance(obj, dict) else obj
    return [job for row in rows or [] if isinstance(row, dict) and (job := normalize(source, row))]

def from_rss(data, source):
    root = ET.fromstring(data); out = []
    for node in root.findall(".//item"):
        job = normalize(source, {"title": node.findtext("title"), "link": node.findtext("link"), "description": node.findtext("description"), "pubDate": node.findtext("pubDate"), "location": node.findtext("location")})
        if job: out.append(job)
    return out

def jobicy():
    data, _ = fetch("https://jobicy.com/api/v2/remote-jobs?count=200"); return from_json(data, "Jobicy")

def remoteok():
    data, _ = fetch("https://remoteok.com/api"); obj = json.loads(data)
    out=[]
    for x in obj:
        if isinstance(x, dict) and x.get("id") and x.get("position"):
            job=normalize("RemoteOK", {"title":x.get("position"),"company":x.get("company"),"location":x.get("location") or "Remote","description":x.get("description"),"url":x.get("url") or ("https://remoteok.com/"+str(x.get("slug",""))),"published_at":x.get("date")})
            if job: out.append(job)
    return out

def remotive():
    data, _ = fetch("https://remotive.com/api/remote-jobs?limit=200"); return from_json(data, "Remotive")

def adzuna():
    aid,key=os.getenv("ADZUNA_APP_ID"),os.getenv("ADZUNA_APP_KEY")
    if not aid or not key: return [], []
    countries=os.getenv("ADZUNA_COUNTRIES","gb,us,ca,au,de,fr,nl,nz,sg,za,ng").split(",")
    queries=os.getenv("ADZUNA_QUERIES","construction,electrician,driver,warehouse,healthcare,engineering,technology,hospitality,cleaning,finance,sales").split(",")
    out=[]; errors=[]
    for country in countries:
        for query in queries:
            try:
                params=urlencode({"app_id":aid,"app_key":key,"results_per_page":50,"what":query.strip(),"content-type":"application/json"})
                data,_=fetch(f"https://api.adzuna.com/v1/api/jobs/{country.strip()}/search/1?{params}")
                for x in json.loads(data).get("results",[]):
                    job=normalize("Adzuna",{"title":x.get("title"),"description":x.get("description"),"url":x.get("redirect_url"),"published_at":x.get("created"),"location":(x.get("location") or {}).get("display_name") or country,"company":(x.get("company") or {}).get("display_name")})
                    if job: out.append(job)
            except Exception as exc: errors.append({"source":f"Adzuna:{country}","query":query.strip(),"error":str(exc)})
    return out,errors

def verify_job(job, check_urls=True):
    now=datetime.now(timezone.utc); reasons=[]
    if not job.get("company"): reasons.append("employer_not_identified")
    if job.get("risk_level")=="high": reasons.extend([f"scam_indicator:{x}" for x in job.get("risk_flags",[])])
    if check_urls:
        ok,status=check_url(job["apply_url"]); job["apply_url_checked"]=True; job["apply_url_status"]=status
        if not ok: reasons.append("application_url_unreachable")
    published=parse_date(job.get("published_at")); closing=parse_date(job.get("closing_date"))
    if closing and closing < now: reasons.append("expired")
    job["verification_checked_at"]=now.isoformat()
    job["verification_reasons"]=sorted(set(reasons))
    if "expired" in reasons or job.get("risk_level")=="high":
        job["verification_status"]="REMOVED"
    elif not reasons and job.get("source_trusted") and job.get("apply_url_checked"):
        job["verification_status"]="VERIFIED"
    else:
        job["verification_status"]="NOT CONFIRMED"
    return job

def main():
    cfg=json.load(open(CONFIG,encoding="utf-8")); jobs=[]; errors=[]
    for feed in cfg.get("feeds",[]):
        try:
            data,_=fetch(feed["url"]); jobs.extend(from_json(data,feed["name"]) if feed.get("format")=="json" else from_rss(data,feed["name"]))
        except Exception as exc: errors.append({"source":feed.get("name"),"error":str(exc)})
    for name,loader in (("Jobicy",jobicy),("RemoteOK",remoteok),("Remotive",remotive)):
        try: jobs.extend(loader())
        except Exception as exc: errors.append({"source":name,"error":str(exc)})
    extra,extra_errors=adzuna(); jobs.extend(extra); errors.extend(extra_errors)
    unique={}
    for job in jobs:
        key=re.sub(r"#.*$","",job["url"]).rstrip("/").lower()
        if key and key not in unique: unique[key]=job
    jobs=list(unique.values())
    limit=int(os.getenv("JOB_URL_CHECK_LIMIT","60"))
    for i,job in enumerate(jobs): verify_job(job, check_urls=(i<limit))
    # Never publish expired or high-risk listings to the public feed.
    public_jobs=[j for j in jobs if j["verification_status"]!="REMOVED"]
    public_jobs.sort(key=lambda x:(x.get("verification_status")=="VERIFIED",x.get("published_at", "")),reverse=True)
    payload={
        "agent":{"name":"JobSeek AI Job Agent","version":"2.0","mode":"automated_discovery_and_verification","updated_at":datetime.now(timezone.utc).isoformat()},
        "updated_at":datetime.now(timezone.utc).isoformat(),"count":len(public_jobs),
        "verified_count":sum(j["verification_status"]=="VERIFIED" for j in public_jobs),
        "not_confirmed_count":sum(j["verification_status"]=="NOT CONFIRMED" for j in public_jobs),
        "removed_count":sum(j["verification_status"]=="REMOVED" for j in jobs),
        "direct_employer_count":sum(j["direct_employer"] for j in public_jobs),
        "visa_sponsorship_count":sum(j["visa_sponsorship"] for j in public_jobs),
        "jobs":public_jobs,"source_errors":errors,"sources":sorted({j["source"] for j in public_jobs})
    }
    with open(OUT,"w",encoding="utf-8") as fh: json.dump(payload,fh,ensure_ascii=False,indent=2)
    print(f"JobSeek: {len(public_jobs)} public jobs; {payload['verified_count']} VERIFIED; {payload['not_confirmed_count']} NOT CONFIRMED; {payload['removed_count']} removed")

if __name__=="__main__": main()
