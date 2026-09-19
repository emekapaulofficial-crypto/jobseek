"""Automatic JobSeek discovery wrapper.

Job discovery, verification and publication are now handled by the automatic
job upload pipeline. No separate Pablo/Paul workflow is required.
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
    data["freshness_window_days"]=3
    data["updated_at"]=now
    data["automatic_upload"]={
        "status":"ACTIVE",
        "verification":"AUTOMATIC",
        "manual_upload_required":False,
        "separate_pablo":False,
        "separate_paul":False
    }
    with open(path,"w",encoding="utf-8") as fh:
        json.dump(data,fh,ensure_ascii=False,indent=2)
    print(f"Automatic JobSeek upload: {len(data.get('jobs',[]))} listings processed; {data.get('verified_count',0)} verified.")

if __name__=="__main__":
    main()
