"""JobSeek 24/7 job discovery agent.

This agent uses permitted public feeds/APIs, normalizes listings, scores source
and listing quality, removes duplicates, checks application URLs, and emits
jobs.json for the static site. It does not claim a job is guaranteed legitimate;
verification is evidence-based and candidates are sent to the original source.
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
USER_AGENT = "JobSeek-AI-Agent/1.0 (+https://github.com/emekapaulofficial-crypto/jobseek)"
TRUSTED_AGGREGATORS = {"arbeitnow", "adzuna", "jobicy", "remoteok"}
SCAM_TERMS = re.compile(r"\b(pay\s+to\s+apply|registration\s+fee|processing\s+fee|buy\s+equipment|crypto\s+payment|gift\s+card|western\s+union|telegram\s+only|whatsapp\s+only|guaranteed\s+income)\b", re.I)
CATEGORY_RULES = {
    "Construction & Skilled Trades": ["construction", "electrician", "welder", "plumber", "carpenter", "mason", "bricklayer", "roofer", "mechanic"],
    "Technology & IT": ["software", "developer", "engineer", "programmer", "devops", "cloud", "cybersecurity", "it support", "data analyst", "data scientist", "qa", "frontend", "backend", "full stack"],
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

def risk_for(title, description, company, url):
    text = f"{title} {description} {company} {url}"
    hits = SCAM_TERMS.findall(text)
    if hits:
        return "high", 25, sorted(set(hits))
    if not company or company.lower() in TRUSTED_AGGREGATORS:
        return "medium", 60, []
    return "low", 85, []

def normalize(source, item):
    title = clean(item.get("title") or item.get("jobTitle") or item.get("name"))
    url = clean(item.get("url") or item.get("link"))
    if not title or not url:
        return None
    description = clean(item.get("description") or item.get("jobDescription") or item.get("summary") or item.get("jobExcerpt"))
    company = clean(item.get("company") or item.get("companyName"))
    location = clean(item.get("location") or item.get("jobGeo") or "See listing")
    published = clean(item.get("published_at") or item.get("pubDate") or item.get("pubDate") or item.get("created") or item.get("date"))
    risk, quality, risk_flags = risk_for(title, description, company, url)
    source_key = source.lower().replace(" ", "")
    direct_evidence = bool(re.search(r"direct apply|posted directly by the employer|apply on (the )?employer|employer.?s own (site|website|career)", description, re.I))
    return {
        "id": hashlib.sha256((source + "|" + url).encode()).hexdigest()[:16],
        "title": title,
        "company": company or source,
        "location": location,
        "description": description[:2200],
        "url": url,
        "apply_url": url,
        "source": source,
        "source_url": url,
        "published_at": published,
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "category": category_for(title, description),
        "employment_type": clean(item.get("jobType") or item.get("type") or item.get("employment_type")),
        "salary": clean(item.get("salary") or ""),
        "remote": bool(re.search(r"remote|work from home|anywhere", f"{location} {description}", re.I)),
        "direct_employer": direct_evidence,
        "source_trusted": source_key in TRUSTED_AGGREGATORS,
        "quality_score": quality,
        "risk_level": risk,
        "risk_flags": risk_flags,
        "verification_status": "source_verified" if quality >= 60 and risk != "high" else "needs_review",
        "apply_url_checked": False,
        "apply_url_status": "not_checked",
    }

def from_json(data, source):
    obj = json.loads(data)
    rows = obj.get("jobs", obj.get("results", [])) if isinstance(obj, dict) else obj
    out = []
    for row in rows or []:
        if isinstance(row, dict):
            job = normalize(source, row)
            if job: out.append(job)
    return out

def from_rss(data, source):
    root = ET.fromstring(data)
    out = []
    for node in root.findall(".//item"):
        row = {
            "title": node.findtext("title"),
            "link": node.findtext("link"),
            "description": node.findtext("description"),
            "pubDate": node.findtext("pubDate"),
            "location": node.findtext("location"),
        }
        job = normalize(source, row)
        if job: out.append(job)
    return out

def jobicy():
    data, _ = fetch("https://jobicy.com/api/v2/remote-jobs?count=200")
    return from_json(data, "Jobicy")

def remoteok():
    data, _ = fetch("https://remoteok.com/api")
    obj = json.loads(data)
    rows = [x for x in obj if isinstance(x, dict) and x.get("id") and x.get("position")]
    return [normalize("RemoteOK", {"id": x.get("id"), "title": x.get("position"), "company": x.get("company"), "location": x.get("location") or "Remote", "description": x.get("description"), "url": x.get("url") or ("https://remoteok.com/" + str(x.get("slug", ""))), "published_at": x.get("date")}) for x in rows]

def adzuna():
    aid, key = os.getenv("ADZUNA_APP_ID"), os.getenv("ADZUNA_APP_KEY")
    if not aid or not key: return [], []
    countries = os.getenv("ADZUNA_COUNTRIES", "gb,us,ca,au,de,fr,nl,nz,sg,za,ng").split(",")
    queries = os.getenv("ADZUNA_QUERIES", "construction,electrician,driver,warehouse,healthcare,engineering,technology,hospitality,cleaning,finance,sales").split(",")
    out, errors = [], []
    for country in countries:
        for query in queries:
            try:
                params = urlencode({"app_id": aid, "app_key": key, "results_per_page": 50, "what": query.strip(), "content-type": "application/json"})
                data, _ = fetch(f"https://api.adzuna.com/v1/api/jobs/{country.strip()}/search/1?{params}")
                obj = json.loads(data)
                for x in obj.get("results", []):
                    job = normalize("Adzuna", {"id": x.get("id"), "title": x.get("title"), "description": x.get("description"), "url": x.get("redirect_url"), "published_at": x.get("created"), "location": (x.get("location") or {}).get("display_name") or country, "company": (x.get("company") or {}).get("display_name")})
                    if job: out.append(job)
            except Exception as exc:
                errors.append({"source": f"Adzuna:{country}", "query": query.strip(), "error": str(exc)})
    return out, errors

def main():
    cfg = json.load(open(CONFIG, encoding="utf-8"))
    jobs, errors = [], []
    for feed in cfg.get("feeds", []):
        try:
            data, _ = fetch(feed["url"])
            jobs.extend(from_json(data, feed["name"]) if feed.get("format") == "json" else from_rss(data, feed["name"]))
        except Exception as exc:
            errors.append({"source": feed.get("name"), "error": str(exc)})
    for name, loader in (("Jobicy", jobicy), ("RemoteOK", remoteok)):
        try:
            jobs.extend(loader())
        except Exception as exc:
            errors.append({"source": name, "error": str(exc)})
    extra, extra_errors = adzuna()
    jobs.extend(extra); errors.extend(extra_errors)

    unique = {}
    for job in jobs:
        if not job: continue
        key = re.sub(r"#.*$", "", job["url"]).rstrip("/").lower()
        if key and key not in unique:
            unique[key] = job
    jobs = list(unique.values())

    # Validate a bounded sample of application URLs so the scheduled job remains fast.
    limit = int(os.getenv("JOB_URL_CHECK_LIMIT", "40"))
    for job in jobs[:limit]:
        ok, status = check_url(job["apply_url"])
        job["apply_url_checked"] = True
        job["apply_url_status"] = status
        if not ok:
            job["verification_status"] = "needs_review"
            job["quality_score"] = min(job["quality_score"], 40)
            job["risk_flags"] = sorted(set(job["risk_flags"] + ["application_url_unreachable"]))

    jobs.sort(key=lambda x: (x.get("quality_score", 0), x.get("published_at", "")), reverse=True)
    payload = {
        "agent": {"name": "JobSeek AI Job Agent", "version": "1.0", "mode": "automated_discovery", "updated_at": datetime.now(timezone.utc).isoformat()},
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "count": len(jobs),
        "verified_source_count": sum(1 for j in jobs if j["verification_status"] == "source_verified"),
        "direct_employer_count": sum(1 for j in jobs if j["direct_employer"]),
        "needs_review_count": sum(1 for j in jobs if j["verification_status"] == "needs_review"),
        "jobs": jobs,
        "source_errors": errors,
        "sources": sorted({j["source"] for j in jobs}),
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"JobSeek AI Agent: {len(jobs)} jobs; {payload['verified_source_count']} source-verified; {payload['needs_review_count']} need review; {len(errors)} source errors")

if __name__ == "__main__":
    main()
