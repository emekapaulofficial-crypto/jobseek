"""JobSeek candidate/job matching engine.

This is a transparent baseline matcher that can run without an LLM. It scores
skills, experience, location/preferences and job type. An LLM can be added later
for richer explanations, but scores should remain bounded and explainable.
"""
import re


def tokens(value):
    return {x for x in re.findall(r"[a-z0-9+#.]+", str(value or "").lower()) if len(x) > 1}


def overlap(candidate_values, job_text):
    wanted = tokens(" ".join(candidate_values or []))
    available = tokens(job_text)
    if not wanted:
        return 50
    return round(100 * len(wanted & available) / len(wanted))


def experience_score(years, description):
    years = float(years or 0)
    text = str(description or "").lower()
    matches = re.findall(r"(\d+)\s*(?:-|to)?\s*(\d+)?\s*(?:years?|yrs?)", text)
    required = 0
    for a, b in matches:
        required = max(required, int(a), int(b or a))
    if not required:
        return 70
    if years >= required:
        return 100
    if years >= max(required - 1, 0):
        return 75
    return max(20, round(100 * years / required))


def location_score(candidate, job):
    preferred = {str(x).lower() for x in candidate.get("preferred_countries", [])}
    location = str(job.get("location") or "").lower()
    country = str(job.get("country") or "").lower()
    if job.get("remote"):
        return 100
    if preferred and any(x in f"{location} {country}" for x in preferred):
        return 100
    residence = str(candidate.get("country_of_residence") or "").lower()
    if residence and residence in f"{location} {country}":
        return 85
    return 45


def preference_score(candidate, job):
    preferred_types = {str(x).lower() for x in candidate.get("preferred_job_types", [])}
    job_type = str(job.get("employment_type") or "").lower()
    if not preferred_types or not job_type:
        return 60
    return 100 if any(x in job_type for x in preferred_types) else 35


def visa_score(candidate, job):
    if not job.get("visa_sponsorship"):
        return 60
    status = str(candidate.get("visa_status") or "").lower()
    if any(x in status for x in ("need", "sponsor", "require")):
        return 100
    return 80


def match(candidate, job):
    description = f"{job.get('title','')} {job.get('description','')} {job.get('category','')}"
    skills = overlap(candidate.get("skills", []), description)
    experience = experience_score(candidate.get("years_experience", 0), description)
    location = location_score(candidate, job)
    preference = preference_score(candidate, job)
    visa = visa_score(candidate, job)
    # Skills and experience carry the most weight for recruitment relevance.
    score = round(skills * 0.40 + experience * 0.25 + location * 0.15 + preference * 0.10 + visa * 0.10)
    explanation = (
        f"Skills {skills}%, experience {experience}%, location {location}%, "
        f"job preference {preference}%, visa fit {visa}%."
    )
    return {
        "match_score": max(0, min(100, score)),
        "skills_score": skills,
        "experience_score": experience,
        "location_score": location,
        "preference_score": preference,
        "visa_score": visa,
        "explanation": explanation,
    }
