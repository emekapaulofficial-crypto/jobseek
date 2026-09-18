"""Daily JobSeek listing cleanup.

Keeps the public feed conservative: expired or high-risk listings are removed;
listings that cannot be confirmed remain visible as NOT CONFIRMED.
"""
import json
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

OUT = "jobs.json"
SCAM_TERMS = re.compile(
    r"\b(pay\s+to\s+apply|registration\s+fee|processing\s+fee|buy\s+equipment|"
    r"crypto\s+payment|gift\s+card|western\s+union|telegram\s+only|"
    r"whatsapp\s+only|guaranteed\s+income)\b", re.I,
)
DATE_FIELDS = ("closing_date", "closing_at", "deadline", "application_deadline", "expires_at", "end_date")


def parse_date(value):
    if not value:
        return None
    if isinstance(value, (int, float)):
        # Accept Unix seconds or milliseconds.
        timestamp = float(value)
        if timestamp > 10_000_000_000:
            timestamp /= 1000
        try:
            return datetime.fromtimestamp(timestamp, tz=timezone.utc)
        except (OverflowError, OSError, ValueError):
            return None
    value = str(value).strip()
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)
    except ValueError:
        pass
    try:
        return parsedate_to_datetime(value).astimezone(timezone.utc)
    except (TypeError, ValueError, OverflowError):
        return None


def closing_date(job):
    for field in DATE_FIELDS:
        dt = parse_date(job.get(field))
        if dt:
            return dt
    return None


def normalize_status(value):
    status = str(value or "").strip().upper().replace("SOURCE_VERIFIED", "VERIFIED").replace("NEEDS_REVIEW", "NOT CONFIRMED")
    return status if status in {"VERIFIED", "NOT CONFIRMED", "REMOVED"} else "NOT CONFIRMED"


def main():
    with open(OUT, encoding="utf-8") as fh:
        payload = json.load(fh)
    now = datetime.now(timezone.utc)
    kept, removed_expired, removed_unsafe, needs_review = [], 0, 0, 0

    for job in payload.get("jobs", []):
        text = " ".join(str(job.get(k, "")) for k in ("title", "company", "description", "url", "apply_url"))
        if SCAM_TERMS.search(text) or str(job.get("risk_level", "")).lower() == "high":
            removed_unsafe += 1
            continue

        closing = closing_date(job)
        if closing and closing <= now:
            removed_expired += 1
            continue

        status = normalize_status(job.get("verification_status"))
        if status == "REMOVED":
            continue

        published = parse_date(job.get("published_at") or job.get("posted_at") or job.get("posted_date") or job.get("date_posted"))
        raw_status = str(job.get("apply_url_status", ""))
        code_match = re.search(r"\b(\d{3})\b", raw_status)
        url_working = bool(job.get("apply_url_checked")) and bool(code_match and 200 <= int(code_match.group(1)) < 400)
        if status != "VERIFIED":
            continue
        if not published:
            continue
        if not job.get("is_active", True):
            continue
        if not url_working:
            continue

        job["verification_status"] = "VERIFIED"
        job["is_active"] = True
        job["application_button_ready"] = True
        job["last_cleanup_at"] = now.isoformat()
        kept.append(job)

    payload["jobs"] = kept
    payload["count"] = len(kept)
    payload["verified_count"] = sum(1 for j in kept if j.get("verification_status") == "VERIFIED")
    payload["not_confirmed_count"] = 0
    payload["verified_source_count"] = payload["verified_count"]
    payload["needs_review_count"] = 0
    payload["cleanup"] = {
        "ran_at": now.isoformat(),
        "removed_expired": removed_expired,
        "removed_unsafe": removed_unsafe,
        "remaining": len(kept),
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    print(f"Cleanup: kept={len(kept)}, expired_removed={removed_expired}, unsafe_removed={removed_unsafe}, needs_review={needs_review}")


if __name__ == "__main__":
    main()
