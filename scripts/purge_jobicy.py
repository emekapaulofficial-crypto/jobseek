#!/usr/bin/env python3
"""Permanently purge Jobicy listings from the public JobSeek feed."""
import json
from datetime import datetime, timezone
from pathlib import Path

PATH = Path("jobs.json")


def main():
    data = json.loads(PATH.read_text(encoding="utf-8"))
    jobs = data.get("jobs", [])
    before = len(jobs)
    jobs = [j for j in jobs if str(j.get("source", "")).strip().lower() != "jobicy"]

    # Also remove any legacy source aliases that point at Jobicy.
    aliases = ("jobicy.com", "www.jobicy.com")
    jobs = [j for j in jobs if not any(a in str(j.get(k, "")).lower() for k in ("url", "apply_url") for a in aliases)]

    data["jobs"] = jobs
    data["count"] = len(jobs)
    data["verified_count"] = sum(1 for j in jobs if str(j.get("verification_status", "")).upper() == "VERIFIED")
    data["not_confirmed_count"] = sum(1 for j in jobs if str(j.get("verification_status", "")).upper() == "NOT CONFIRMED")
    data["sources"] = sorted({str(j.get("source", "")).strip() for j in jobs if j.get("source")})
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    data["jobicy_removed"] = True

    PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Removed {before - len(jobs)} Jobicy listings; {len(jobs)} remain.")


if __name__ == "__main__":
    main()
