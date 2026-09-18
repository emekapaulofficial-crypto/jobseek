"""Normalize JobSeek categories and freshness across every published listing."""
import html
import json
import os
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

OUT = Path("jobs.json")
MAX_AGE_DAYS = max(1, int(os.getenv("JOB_MAX_AGE_DAYS", "14")))

RULES = [
    ("Construction & Skilled Trades", ["electrician","electrical technician","welder","welding","carpenter","carpentry","mason","bricklayer","roofer","scaffolder","plumber","pipefitter","boilermaker","concrete worker","construction","site supervisor","general labourer","general laborer","tradesperson","heavy equipment operator","plant operator"]),
    ("Farming & Agriculture", ["farm worker","farmhand","agriculture","agricultural","fruit picker","harvest worker","greenhouse","livestock","poultry","dairy","tractor operator","irrigation","horticulture","orchard","vineyard"]),
    ("Healthcare", ["registered nurse","nurse","nursing","doctor","physician","medical","healthcare","caregiver","carer","pharmacist","pharmacy","dentist","dental","radiographer","physiotherapist","occupational therapist","health aide"]),
    ("Engineering", ["civil engineer","mechanical engineer","electrical engineer","chemical engineer","structural engineer","engineering manager","engineer"]),
    ("Driving & Transport", ["truck driver","lorry driver","bus driver","delivery driver","driver","chauffeur","transportation","haulier","heavy goods vehicle"]),
    ("Logistics & Warehouse", ["warehouse","logistics","supply chain","forklift","picker","packer","inventory","dispatch","fulfilment","fulfillment"]),
    ("Hospitality & Catering", ["hotel","hospitality","chef","cook","restaurant","catering","waiter","waitress","barista","housekeeping"]),
    ("Cleaning & Facilities", ["cleaner","cleaning","janitor","facilities","maintenance technician","custodian","groundskeeper"]),
    ("Security", ["security officer","security guard","security","loss prevention"]),
    ("Finance & Accounting", ["accountant","accounting","finance","financial analyst","auditor","bookkeeper","payroll","accounts payable","accounts receivable"]),
    ("Administration", ["administrator","administrative assistant","office assistant","receptionist","office manager","human resources","hr assistant"]),
    ("Sales & Customer Service", ["sales","customer service","customer support","account manager","call center","call centre","business development","customer success"]),
    ("Marketing & Design", ["marketing","seo","content writer","copywriter","graphic designer","ux designer","ui designer","designer","social media","brand manager"]),
    ("Education", ["teacher","tutor","lecturer","education","school","professor","instructor"]),
    ("Retail", ["retail","store manager","cashier","merchandiser","shop assistant"]),
    ("Technology & IT", ["software engineer","software developer","developer","programmer","devops","cloud engineer","cloud","cybersecurity","cyber security","it support","information technology","data analyst","data scientist","data engineer","machine learning","artificial intelligence","ai engineer","ai trainer","qa engineer","quality assurance","frontend","front-end","backend","back-end","full stack","kubernetes","golang","python developer","javascript developer","solutions architect","systems administrator","database administrator"]),
]

def clean(value):
    value = html.unescape(str(value or ""))
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value)).strip()

def parse_date(value):
    text = clean(value)
    if not text or text.lower() == "not specified":
        return None
    try:
        dt = parsedate_to_datetime(text)
        return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        pass
    for fmt in ("%Y-%m-%dT%H:%M:%SZ", "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%d"):
        try:
            dt = datetime.strptime(text, fmt)
            return (dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).astimezone(timezone.utc)
        except ValueError:
            pass
    return None

def category_for(job):
    title = clean(job.get("title")).lower()
    description = clean(job.get("description")).lower()
    # Title matches carry much more weight so a stray keyword in a long description
    # cannot put an unrelated vacancy into the wrong career area.
    scores = {}
    for category, terms in RULES:
        score = 0
        for term in terms:
            if re.search(r"(?<![a-z0-9])" + re.escape(term) + r"(?![a-z0-9])", title):
                score += 10
            if re.search(r"(?<![a-z0-9])" + re.escape(term) + r"(?![a-z0-9])", description):
                score += 1
        if score:
            scores[category] = score
    if scores:
        return max(scores, key=scores.get)
    return "Remote & Freelance" if job.get("remote") is True else "Other"

def main():
    data = json.loads(OUT.read_text(encoding="utf-8"))
    now = datetime.now(timezone.utc)
    fresh = []
    stale = 0
    for job in data.get("jobs", []):
        if not isinstance(job, dict):
            continue
        published = parse_date(job.get("published_at") or job.get("posted_at") or job.get("posted_date") or job.get("date_posted"))
        if published and (now - published).total_seconds() > MAX_AGE_DAYS * 86400:
            stale += 1
            continue
        job["category"] = category_for(job)
        fresh.append(job)
    data["jobs"] = fresh
    data["count"] = len(fresh)
    data["verified_count"] = sum(j.get("verification_status") == "VERIFIED" for j in fresh)
    data["not_confirmed_count"] = sum(j.get("verification_status") != "VERIFIED" for j in fresh)
    data["removed_count"] = 0
    data["direct_employer_count"] = sum(j.get("direct_employer") is True for j in fresh)
    data["visa_sponsorship_count"] = sum(j.get("visa_sponsorship") is True for j in fresh)
    data["freshness_window_days"] = MAX_AGE_DAYS
    data["updated_at"] = now.isoformat()
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Reclassified {len(fresh)} listings; removed {stale} dated listings older than {MAX_AGE_DAYS} days.")

if __name__ == "__main__":
    main()
