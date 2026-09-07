"""Add additional remote/global sources and remove Jobicy from the public feed."""
import hashlib
import html
import json
import re
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from xml.etree import ElementTree as ET

OUT = "jobs.json"
UA = "JobSeek-Source-Agent/1.0"
SCAM = re.compile(r"\b(pay\s+to\s+apply|registration\s+fee|processing\s+fee|buy\s+equipment|crypto\s+payment|gift\s+card|western\s+union|telegram\s+only|whatsapp\s+only|guaranteed\s+income)\b", re.I)
VISA = re.compile(r"\b(visa sponsorship|visa sponsor|sponsorship available|sponsor visa|work permit sponsorship|work permit provided|employer sponsorship|immigration sponsorship|sponsorship provided)\b", re.I)
NO_VISA = re.compile(r"\b(no sponsorship|without sponsorship|must have right to work|must already have work authorization|no visa sponsorship|unable to sponsor)\b", re.I)

def clean(v):
    v = html.unescape(str(v or ""))
    v = re.sub(r"<[^>]+>", " ", v)
    return re.sub(r"\s+", " ", v).strip()

def fetch(url):
    req = Request(url, headers={"User-Agent": UA, "Accept": "application/json, application/xml, text/xml, */*"})
    with urlopen(req, timeout=30) as r:
        return r.read()

def parse_date(v):
    if isinstance(v, (int, float)):
        return datetime.fromtimestamp(v / 1000 if v > 100000000000 else v, tz=timezone.utc).isoformat()
    return clean(v)

def normalize(source, item):
    title = clean(item.get("title"))
    url = clean(item.get("applicationLink") or item.get("url") or item.get("link"))
    if not title or not url:
        return None
    desc = clean(item.get("description") or item.get("excerpt") or item.get("summary"))
    company = clean(item.get("companyName") or item.get("company"))
    restrictions = item.get("locationRestrictions") or []
    location = clean(item.get("location") or item.get("jobGeo") or ", ".join(map(str, restrictions)) or "Remote")
    text = f"{title} {desc} {location}"
    visa = bool(VISA.search(text)) and not bool(NO_VISA.search(text))
    risk_flags = sorted(set(SCAM.findall(f"{title} {desc} {company} {url}")))
    return {
        "id": hashlib.sha256((source + "|" + url).encode()).hexdigest()[:16],
        "title": title, "company": company, "location": location or "Remote",
        "description": desc[:3000], "url": url, "apply_url": url,
        "source": source, "source_url": url,
        "published_at": parse_date(item.get("pubDate") or item.get("published_at") or item.get("date")),
        "closing_date": parse_date(item.get("expiryDate") or item.get("closing") or item.get("deadline")) or "Not specified",
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "category": "Remote & Freelance", "employment_type": clean(item.get("employmentType") or item.get("type")),
        "salary": clean(item.get("salary") or ""), "remote": True,
        "direct_employer": False, "direct_application": False, "employer_identified": bool(company),
        "source_trusted": True, "visa_sponsorship": visa,
        "visa_evidence": sorted(set(VISA.findall(text))) if visa else [],
        "risk_level": "high" if risk_flags else "low", "risk_flags": risk_flags,
        "verification_status": "NOT CONFIRMED", "verification_reasons": [],
        "verification_checked_at": datetime.now(timezone.utc).isoformat(),
        "apply_url_checked": False, "apply_url_status": "source_feed"
    }

def himalayas():
    out, cursor = [], None
    for _ in range(5):
        url = "https://himalayas.app/jobs/api?limit=20" + (("&cursor=" + cursor) if cursor else "")
        data = json.loads(fetch(url))
        for row in data.get("jobs", []):
            job = normalize("Himalayas", row)
            if job: out.append(job)
        cursor = data.get("nextCursor")
        if not cursor: break
    return out

def wwr():
    root = ET.fromstring(fetch("https://weworkremotely.com/remote-jobs.rss"))
    out = []
    for node in root.findall(".//item"):
        job = normalize("We Work Remotely", {"title": node.findtext("title"), "link": node.findtext("link"), "description": node.findtext("description"), "pubDate": node.findtext("pubDate"), "company": node.findtext("company")})
        if job: out.append(job)
    return out

def main():
    data = json.load(open(OUT, encoding="utf-8"))
    existing = [j for j in data.get("jobs", []) if str(j.get("source", "")).strip().lower() != "jobicy"]
    aggregator_sources = {"Adzuna", "Arbeitnow", "RemoteOK", "Remotive", "Jobicy", "Himalayas", "We Work Remotely"}
    for j in existing:
        if j.get("source") in aggregator_sources:
            j["employer_identified"] = bool(j.get("company"))
            j["direct_employer"] = False
            j["direct_application"] = False
    seen = {re.sub(r"#.*$", "", str(j.get("url", ""))).rstrip("/").lower() for j in existing}
    added = []
    for name, loader in (("Himalayas", himalayas), ("We Work Remotely", wwr)):
        try:
            for job in loader():
                key = re.sub(r"#.*$", "", job["url"]).rstrip("/").lower()
                if not key or key in seen or job["risk_level"] == "high": continue
                seen.add(key); added.append(job)
        except Exception as exc:
            data.setdefault("source_errors", []).append({"source": name, "error": str(exc)})
    jobs = existing + added
    data["jobs"] = jobs
    data["count"] = len(jobs)
    data["verified_count"] = sum(j.get("verification_status") == "VERIFIED" for j in jobs)
    data["not_confirmed_count"] = sum(j.get("verification_status") == "NOT CONFIRMED" for j in jobs)
    data["direct_employer_count"] = sum(j.get("direct_employer") is True for j in jobs)
    data["visa_sponsorship_count"] = sum(j.get("visa_sponsorship") is True for j in jobs)
    data["sources"] = sorted({j.get("source") for j in jobs if j.get("source")})
    data["source_policy"] = {"excluded": ["Jobicy"], "added": ["Himalayas", "We Work Remotely"], "direct_employer_rule": "Third-party boards are discovery sources only unless explicit direct-employer evidence is present."}
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    with open(OUT, "w", encoding="utf-8") as fh: json.dump(data, fh, ensure_ascii=False, indent=2)
    print(f"Trusted source pass: removed Jobicy; added {len(added)} jobs from Himalayas/We Work Remotely; total={len(jobs)}")

if __name__ == "__main__": main()
