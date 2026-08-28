/* JobSeek candidate matching utilities. Runs client-side without exposing secrets. */
(function () {
  const STOP = new Set(['and','the','for','with','from','that','this','you','your','our','are','job','jobs','work','years','year','required','requirements','experience','role','team','will','have','has','not','all','any','into','about','over','under']);
  function text(value) { return Array.isArray(value) ? value.join(' ') : String(value || ''); }
  function tokens(value) {
    return new Set(text(value).toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').split(/\s+/).filter(x => x.length > 2 && !STOP.has(x)));
  }
  function overlap(wanted, available) {
    const a = tokens(wanted), b = tokens(available);
    if (!a.size) return { score: 60, matched: [] };
    const matched = [...a].filter(x => b.has(x));
    return { score: Math.round(100 * matched.length / a.size), matched };
  }
  function experienceScore(years, jobText) {
    const candidate = Number(years || 0);
    const nums = [...String(jobText || '').toLowerCase().matchAll(/(\d+(?:\.\d+)?)\s*(?:-|to)?\s*(\d+(?:\.\d+)?)?\s*(?:years?|yrs?)/g)];
    if (!nums.length) return 70;
    const required = Math.max(...nums.map(m => Number(m[2] || m[1])));
    if (candidate >= required) return 100;
    if (candidate >= Math.max(required - 1, 0)) return 75;
    return Math.max(20, Math.round(candidate / required * 100));
  }
  function locationScore(profile, job) {
    const preferred = (profile.preferred_countries || []).map(x => String(x).toLowerCase()).filter(Boolean);
    const location = `${job.location || ''} ${job.country || ''}`.toLowerCase();
    if (job.remote || /remote|anywhere|work from home/i.test(location)) return 100;
    if (preferred.length && preferred.some(x => location.includes(x))) return 100;
    const residence = String(profile.country_of_residence || '').toLowerCase();
    if (residence && location.includes(residence)) return 85;
    return 45;
  }
  function preferenceScore(profile, job) {
    const wanted = (profile.preferred_job_types || []).map(x => String(x).toLowerCase());
    const type = String(job.employment_type || job.job_type || '').toLowerCase();
    if (!wanted.length || !type) return 60;
    return wanted.some(x => type.includes(x) || x.includes(type)) ? 100 : 35;
  }
  function visaScore(profile, job) {
    if (!job.visa_sponsorship) return 60;
    const status = String(profile.visa_status || '').toLowerCase();
    return /need|sponsor|require/.test(status) ? 100 : 80;
  }
  function match(profile, job) {
    const jobText = [job.title, job.description, job.category, job.requirements, job.employment_type, job.job_type, job.country].map(text).join(' ');
    const skill = overlap(profile.skills || [], jobText);
    const experience = experienceScore(profile.years_experience, jobText);
    const location = locationScore(profile, job);
    const preference = preferenceScore(profile, job);
    const visa = visaScore(profile, job);
    const score = Math.max(0, Math.min(100, Math.round(skill.score * .40 + experience * .25 + location * .15 + preference * .10 + visa * .10)));
    return { score, skills: skill.score, experience, location, preference, visa, matched: skill.matched };
  }
  window.JobSeekMatcher = { match };
})();
