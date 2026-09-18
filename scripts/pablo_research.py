"""Pablo — underground Job Research Manager.

Pablo owns discovery only. It refreshes the existing JobSeek research engine with
a strict 3-day freshness window, records that the feed was researched by Pablo,
and leaves final publication/quality control to Paul.
"""
import json, os, subprocess
from datetime import datetime, timezone

def main():
    env=os.environ.copy()
    env["JOB_MAX_AGE_DAYS"]="3"
    env["JOB_URL_CHECK_LIMIT"]="1000"
    subprocess.run(["python","scripts/ai_job_agent.py"],env=env,check=True)
    path="jobs.json"
    data=json.load(open(path,encoding="utf-8"))
    now=datetime.now(timezone.utc).isoformat()
    for job in data.get("jobs",[]):
        job["pablo_researched_at"]=now
        job["pablo_research_window_days"]=3
        job["pablo_research_status"]="RESEARCHED"
    data["pablo"]={
        "name":"Pablo",
        "visibility":"ADMIN_ONLY",
        "public_display":False,
        "status":"ACTIVE",
        "role":"job_research_manager",
        "research_window_days":3,
        "last_research_at":now,
        "handoff":"PAUL_PENDING",
        "rule":"Find jobs posted within the last 3 days; reject expired, unsafe or unreachable application routes before handoff."
    }
    data["freshness_window_days"]=3
    data["updated_at"]=now
    with open(path,"w",encoding="utf-8") as f:
        json.dump(data,f,ensure_ascii=False,indent=2)
    print(f"Pablo: researched {len(data.get('jobs',[]))} fresh jobs and handed them to Paul.")

if __name__=="__main__":
    main()
