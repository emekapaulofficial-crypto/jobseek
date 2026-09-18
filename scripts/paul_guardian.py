"""Paul Job Guardian: continuous conservative quality control for the public job feed.

Only listings that are verified, have a parseable posting date, are still active,
and have a checked 2xx/3xx application URL remain public. Clearly risky listings
are removed. This is automated quality control, not a guarantee that an employer
or vacancy is legitimate.
"""
import json, re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse
from urllib.request import Request, urlopen

OUT = "jobs.json"
MAX_WORKERS = 20
TIMEOUT = 10
SCAM_TERMS = re.compile(r"\b(pay\s+to\s+apply|registration\s+fee|processing\s+fee|buy\s+equipment|crypto\s+payment|gift\s+card|western\s+union|telegram\s+only|whatsapp\s+only|guaranteed\s+income)\b", re.I)

def parse_date(value):
    if not value or str(value).strip() == "Not specified":
        return None
    text = str(value).strip()
    try:
        return datetime.fromisoformat(text.replace("Z","+00:00")).astimezone(timezone.utc)
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(text).astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None

def check_url(url):
    try:
        p=urlparse(str(url))
        if p.scheme not in {"http","https"} or not p.hostname:
            return False,"invalid_url"
        req=Request(str(url),headers={"User-Agent":"JobSeek-Paul-Guardian/1.0"},method="HEAD")
        try:
            with urlopen(req,timeout=TIMEOUT) as r:
                return 200 <= r.status < 400, str(r.status)
        except Exception:
            req=Request(str(url),headers={"User-Agent":"JobSeek-Paul-Guardian/1.0"},method="GET")
            with urlopen(req,timeout=TIMEOUT) as r:
                return 200 <= r.status < 400, str(r.status)
    except Exception as exc:
        return False,type(exc).__name__

def main():
    data=json.load(open(OUT,encoding="utf-8"))
    jobs=data.get("jobs",[])
    now=datetime.now(timezone.utc)
    results=[None]*len(jobs)

    def verify(pair):
        i,j=pair
        reasons=[]
        published=parse_date(j.get("published_at") or j.get("posted_at") or j.get("posted_date") or j.get("date_posted"))
        closing=parse_date(j.get("closing_date") or j.get("closing_at") or j.get("application_deadline") or j.get("end_date") or j.get("expires_at"))
        if not published: reasons.append("missing_posted_date")
        if closing and closing <= now: reasons.append("expired")
        if str(j.get("verification_status","")).upper() != "VERIFIED":
            reasons.append("not_verified")
        if not j.get("source_trusted",False):
            reasons.append("source_not_trusted")
        source=str(j.get("source","")).strip().lower()
        trusted_sources={"remoteok","remotive","himalayas","we work remotely","arbeitnow","adzuna","usajobs"}
        if source not in trusted_sources:
            reasons.append("unapproved_source")
        apply_url=str(j.get("apply_url","")).strip()
        source_url=str(j.get("url","")).strip()
        if not apply_url or apply_url == source_url:
            reasons.append("missing_direct_application_url")
        text=" ".join(str(j.get(k,"")) for k in ("title","company","description","url","apply_url"))
        if SCAM_TERMS.search(text): reasons.append("scam_indicator")
        ok,status=check_url(j.get("apply_url"))
        j["apply_url_checked"]=True
        j["apply_url_status"]=status
        j["verification_checked_at"]=now.isoformat()
        j["paul_guardian_checked_at"]=now.isoformat()
        if not ok:
            reasons.append("application_url_unreachable")
        j["is_active"]=not reasons
        j["application_button_ready"]=not reasons
        j["verification_reasons"]=sorted(set(reasons))
        return i,j,reasons

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures=[pool.submit(verify,p) for p in enumerate(jobs)]
        for f in as_completed(futures):
            i,j,reasons=f.result()
            results[i]=(j,reasons)

    kept=[]
    removed=0
    for j,reasons in results:
        if not reasons:
            kept.append(j)
        else:
            removed+=1

    data["jobs"]=kept
    data["count"]=len(kept)
    data["verified_count"]=len(kept)
    data["not_confirmed_count"]=0
    data["verified_source_count"]=len(kept)
    data["needs_review_count"]=0
    data["paul_guardian"]={
        "name":"Paul",
        "visibility":"ADMIN_ONLY",
        "public_display":False,
        "status":"ACTIVE",
        "mode":"automated_job_quality_control",
        "last_run_at":now.isoformat(),
        "removed_this_run":removed,
        "public_rule":"VERIFIED + posted date + active + working 2xx/3xx application URL",
    }
    data["updated_at"]=now.isoformat()
    with open(OUT,"w",encoding="utf-8") as fh:
        json.dump(data,fh,ensure_ascii=False,indent=2)
    print(f"Paul Guardian: kept={len(kept)} removed={removed}; every remaining job has a checked application URL.")

if __name__=="__main__":
    main()
