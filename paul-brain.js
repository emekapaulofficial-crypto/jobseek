/* JobSeek Paul AI Brain
   Flow (like a human recruiter):
   1. Read the vacancy  2. Read the CV  3. Find the words/requirements the CV is missing
   4. Rewrite the CV so every TRUE keyword is visible  5. Ask the user to confirm the rest
   Smart mode: calls the Supabase Edge Function "paul-ai" (real AI model).
   Quick mode: runs fully in the browser if the AI function is not deployed or is slow.
   Paul never invents experience: a missing skill is only added after the user taps "Yes, I have this". */
(function () {
  'use strict';

  const STOP = new Set(('a an and or of to in for with from on at as is are be being been this that these those their they you your our we will can should must have has had it its by into about over under within using use used work working role position candidate candidates required requirements requirement preferred qualification qualifications experience experienced years year strong proven excellent good great ability able skills skill knowledge understanding looking seeking join team teams company opportunity responsibilities responsibility include includes including such well also more most other any all both each than then them who whom what which where when while across per via etc plus least minimum basic high level new based related relevant ensure ensuring provide providing support supporting help helping make making take taking part full time job description about location type nice have having able etc one two three four five six seven eight nine ten per day days month months week weeks apply application hiring hire needed need needs day-to-day closely work works worked').split(/\s+/));
  const GENERIC = new Set(['senior', 'junior', 'lead', 'manager', 'engineer', 'officer', 'executive', 'hybrid', 'onsite', 'on-site', 'lagos', 'nigeria', 'fulltime', 'full-time', 'permanent', 'contract', 'diploma', 'degree', 'bachelor', 'related', 'field', 'preferably', 'preferred']);

  const SYN = [
    ['supervise', 'supervised', 'supervising', 'supervision', 'oversee', 'oversaw', 'managed a team', 'led a team', 'team leadership', 'team lead', 'floor supervisor'],
    ['customer service', 'guest service', 'client service', 'customer satisfaction', 'guest satisfaction', 'customer care'],
    ['complaint', 'complaints', 'guest complaints', 'customer complaints'],
    ['budget', 'budgets', 'budgeting', 'expenses', 'cost control'],
    ['event planning', 'planned weddings', 'event coordination', 'event coordinator', 'plan events', 'planned events'],
    ['food safety', 'food hygiene', 'haccp'],
    ['pos', 'point of sale', 'pos systems', 'cash handling', 'cash reconciliation'],
    ['kubernetes', 'k8s', 'eks', 'aks', 'gke'],
    ['postgresql', 'postgres', 'psql'],
    ['javascript', 'js', 'ecmascript'],
    ['typescript', 'ts'],
    ['ci/cd', 'cicd', 'ci cd', 'jenkins', 'github actions', 'gitlab ci', 'continuous integration', 'continuous delivery'],
    ['rest api', 'rest apis', 'restful', 'rest endpoints', 'api design'],
    ['microservices', 'microservice', 'micro-services'],
    ['aws', 'amazon web services', 'ec2', 's3'],
    ['azure', 'microsoft azure'],
    ['communication', 'communicating', 'communicate'],
    ['stakeholder', 'stakeholders', 'stakeholder management'],
    ['sales', 'selling', 'sold', 'business development'],
    ['excel', 'microsoft excel', 'ms excel', 'spreadsheet', 'spreadsheets'],
    ['reporting', 'reports', 'report writing']
  ];

  const WEAK = new Set(['management', 'staff', 'events', 'team', 'levels', 'standards', 'hospitality']);
  const norm = s => String(s || '').toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/\s+/g, ' ').trim();
  const titleCase = s => String(s || '').replace(/\b([a-z])/g, m => m.toUpperCase()).replace(/\bAws\b/g, 'AWS').replace(/\bSql\b/g, 'SQL').replace(/\bApi(s?)\b/g, 'API$1').replace(/\bRest\b/g, 'REST').replace(/\bCi\/cd\b/gi, 'CI/CD').replace(/\bPos\b/g, 'POS').replace(/\bPostgresql\b/g, 'PostgreSQL');
  const stem = w => { w = w.toLowerCase(); if (w.length <= 4) return w; return w.replace(/(ations?|ition|ings?|ed|es|ers?|s)$/, ''); };
  const wordsOf = s => norm(s).match(/[a-z0-9+#./-]+/g) || [];
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const VERBS = new Set('plan plans planning coordinate coordinates coordinating handle handles handling manage manages managing supervise supervises supervising liaise liaising maintain maintains maintaining track tracking build building design designing develop developing deploy deploying write writing review reviewing mentor mentoring lead leading deliver delivering drive driving own owning create creating run running ensure train training report reporting set setting assist assisting perform performing prepare preparing monitor monitoring conduct conducting identify identifying analyse analyze analysing analyzing execute executing communicate communicating collaborate collaborating work worked'.split(' '));

  /* ---------- 1. READ THE VACANCY ---------- */
  function readVacancy(jd) {
    let lines = String(jd || '').replace(/\r/g, '').split(/\n|\u2022|\u25AA|\u25E6|(?<=[.!?])\s+/).map(x => x.trim()).filter(x => x.length > 2);
    if (lines.length > 3 && lines[0].split(/\s+/).length <= 6 && !/[.:,]/.test(lines[0])) lines = lines.slice(1); // job title line
    const score = new Map(), freq = new Map(), strongOrig = new Set();
    const bump = (t, w) => score.set(t, (score.get(t) || 0) + w);
    lines.forEach(line => {
      const w = 1 + (/(require|must|experience|knowledge|skill|proficien|degree|diploma|certif|years|familiar|hands-on|essential)/i.test(line) ? 1 : 0);
      const segs = line.split(/[,;:()\u2013\u2014|]|\s\/\s/);
      segs.forEach((seg, si) => {
        const orig = (seg.match(/[A-Za-z0-9+#.\/-]+/g) || []).map(t => t.replace(/^[./-]+|[./-]+$/g, '')).filter(Boolean);
        const toks = orig.map(t => t.toLowerCase());
        for (let n = 1; n <= 2; n++) {
          for (let i = 0; i + n <= toks.length; i++) {
            const win = toks.slice(i, i + n);
            if (win.some(t => STOP.has(t) || VERBS.has(t) || /^\d+\+?$/.test(t))) continue;
            if (win.every(t => GENERIC.has(t)) || win.some(t => t.length < 2)) continue;
            const key = win.join(' ');
            if (n === 1) {
              if (win[0].length < 3 || GENERIC.has(win[0])) continue;
              const o = orig[i];
              const acronym = /^[A-Z0-9+#\/]{2,}$/.test(o) || /[0-9+#]/.test(o);
              const proper = /^[A-Z][a-z]/.test(o) && (i > 0 || si > 0 || segs.length > 1);
              freq.set(key, (freq.get(key) || 0) + 1);
              if (acronym || proper) strongOrig.add(key);
            }
            bump(key, w * (n === 2 ? 1.5 : 1));
          }
        }
      });
    });
    const ranked = [...score.entries()].filter(([t]) => t.includes(' ') || strongOrig.has(t) || (freq.get(t) || 0) >= 2)
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
    const chosen = [];
    for (const [t] of ranked) {
      if (chosen.length >= 26) break;
      if (chosen.some(c => c === t || c.includes(t) || t.includes(c))) continue;
      chosen.push(t);
    }
    return { lines, terms: chosen };
  }

  /* ---------- 2. READ THE CV + 3. CHECK WHAT IS MISSING ---------- */
  function hasEvidence(cvNorm, cvStems, term) {
    if (cvNorm.includes(term)) return true;
    const group = SYN.find(g => g.includes(term));
    if (group && group.some(g => cvNorm.includes(g))) return true;
    const ws = term.split(' ');
    return ws.every(w => cvStems.has(stem(w)));
  }
  function analyse(cv, jd, confirmed) {
    const vac = readVacancy(jd);
    const cvNorm = norm(cv + ' ' + (confirmed || []).join(' '));
    const cvStems = new Set(wordsOf(cvNorm).map(stem));
    const matched = [], missing = [];
    vac.terms.forEach(t => (hasEvidence(cvNorm, cvStems, t) ? matched : missing).push(t));
    const total = vac.terms.length || 1;
    return { score: Math.round(matched.length / total * 100), matched, missing, terms: vac.terms };
  }

  /* ---------- 4. REWRITE (quick mode, honest) ---------- */
  function quickImprove(input, jd, confirmed) {
    confirmed = confirmed || [];
    const before = analyse(input.cv || '', jd, confirmed);
    const data = Object.assign({}, input);
    const skills = (Array.isArray(data.skills) ? data.skills : String(data.skills || '').split(/[,;\n]+/)).map(s => s.trim()).filter(Boolean);
    const skillNorm = skills.map(norm);
    const added = [];
    // Words that ARE already evidenced in the CV but missing from the skills list -> make them visible
    before.matched.forEach(t => {
      if (t.split(' ').length > 3 || WEAK.has(t)) return;
      if (!skillNorm.some(s => s.includes(t) || t.includes(s))) { skills.push(titleCase(t)); skillNorm.push(t); added.push(titleCase(t)); }
    });
    // Words the user has just confirmed are true
    confirmed.forEach(t => { if (!skillNorm.some(s => s === norm(t))) { skills.push(titleCase(t)); skillNorm.push(norm(t)); added.push(titleCase(t)); } });
    // Put vacancy-relevant skills first
    const rel = s => before.terms.some(t => norm(s).includes(t) || t.includes(norm(s))) ? 0 : 1;
    skills.sort((a, b) => rel(a) - rel(b));
    // Summary: keep the original; add one true sentence listing matched strengths
    let summary = String(data.summary || '').trim();
    const top = before.matched.filter(t => !norm(summary).includes(t) && !WEAK.has(t)).slice(0, 4);
    const role = data.targetRole || data.title || 'this role';
    if (top.length >= 2) summary = (summary ? summary.replace(/\s+$/, '') + (/[.!?]$/.test(summary) ? ' ' : '. ') : '') + 'Relevant strengths for ' + role + ': ' + top.map(titleCase).join(', ') + '.';
    data.skills = skills.slice(0, 30);
    data.summary = summary;
    const improve = (window.JobSeekSmartCV && window.JobSeekSmartCV.paulImprove) || window.JobSeekPaulImprove;
    const out = typeof improve === 'function' ? improve(data, jd) : data;
    const after = analyse(out.cv || '', jd, confirmed);
    return { out, before, after, added, gaps: after.missing.slice(0, 10), mode: 'quick' };
  }

  /* ---------- SMART MODE (real AI via Supabase Edge Function) ---------- */
  async function smartImprove(input, jd, confirmed) {
    const S = window.JobSeekSupabase;
    if (!S || !S.configured || window.JOBSEEK_PAUL_AI === false) throw new Error('smart mode off');
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    try {
      const r = await fetch(S.url + '/functions/v1/paul-ai', {
        method: 'POST', signal: ctl.signal,
        headers: { 'Content-Type': 'application/json', apikey: S.key, Authorization: 'Bearer ' + S.key },
        body: JSON.stringify({ cv: input.cv, vacancy: jd, role: input.targetRole || input.title || '', confirmed: confirmed || [] })
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      if (!j || !j.cv) throw new Error('empty');
      return j;
    } finally { clearTimeout(timer); }
  }

  /* ---------- Chat-style UI ---------- */
  const state = { confirmed: [], last: null };
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function chatBox() {
    let box = document.getElementById('paulChat');
    if (!box) {
      const host = document.getElementById('paulReview') || document.getElementById('paulSummary');
      box = document.createElement('div'); box.id = 'paulChat';
      box.style.cssText = 'margin:12px 0;display:grid;gap:8px';
      host.parentNode.insertBefore(box, host.nextSibling);
    }
    return box;
  }
  function say(html, who) {
    const b = chatBox(), d = document.createElement('div');
    d.style.cssText = 'padding:10px 14px;border-radius:14px;font-size:14px;line-height:1.55;max-width:96%;' + (who === 'me' ? 'background:#e8f0fe;justify-self:end' : 'background:#f3f6fb;border:1px solid #e1e8f3');
    d.innerHTML = html; b.appendChild(d); d.scrollIntoView({ block: 'nearest' }); return d;
  }

  async function improve(ctx) {
    // ctx: { cv, form, jd, role, apply(out), onScore(analysis) }
    const box = chatBox(); box.innerHTML = '';
    const input = Object.assign({}, ctx.form, { cv: ctx.cv, targetRole: ctx.role, jobDescription: ctx.jd });
    const m1 = say('📄 Reading the vacancy…'); await sleep(250);
    const vac = readVacancy(ctx.jd);
    m1.innerHTML = '📄 I read the vacancy. It asks for about <b>' + vac.terms.length + '</b> key things.';
    const m2 = say('🧾 Reading your CV…'); await sleep(250);
    const first = analyse(ctx.cv, ctx.jd, state.confirmed);
    m2.innerHTML = '🧾 I read your CV. You already cover <b>' + first.matched.length + '</b> of them (' + first.score + '%).';
    const m3 = say('🔎 Checking what is missing…'); await sleep(250);
    m3.innerHTML = first.missing.length ? '🔎 Missing from your CV: <b>' + first.missing.slice(0, 8).map(esc).join(', ') + '</b>.' : '🔎 Nothing important is missing.';
    const m4 = say('✍️ Writing the improved CV…');

    let res, mode = 'smart';
    try {
      const j = await smartImprove(input, ctx.jd, state.confirmed);
      const out = Object.assign({}, input, { cv: j.cv, summary: j.summary || input.summary, skills: j.skills || input.skills, experience: j.experience || input.experience });
      const after = analyse(out.cv, ctx.jd, state.confirmed);
      res = { out, before: first, after, added: j.added || [], gaps: (j.gaps && j.gaps.length ? j.gaps : after.missing).slice(0, 10), message: j.message, mode };
    } catch (e) {
      res = quickImprove(input, ctx.jd, state.confirmed); mode = 'quick';
    }
    m4.innerHTML = '✍️ Done' + (mode === 'smart' ? ' (smart mode).' : ' (quick mode).');
    state.last = { ctx, res };
    ctx.apply(res.out, res.after);

    let html = '<b>Your match went from ' + res.before.score + '% to ' + res.after.score + '%.</b>';
    if (res.added.length) html += '<br>✅ Now visible in your CV: ' + res.added.slice(0, 10).map(esc).join(', ') + '.';
    if (res.message) html += '<br>' + esc(res.message);
    say(html);
    if (res.gaps.length) {
      const g = say('I did <b>not</b> add these because I cannot see them in your CV. <b>Tap only the ones that are really true for you</b> and I will add them:<div id="paulChips" style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px"></div>');
      const chips = g.querySelector('#paulChips');
      res.gaps.forEach(t => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = '＋ ' + t;
        b.style.cssText = 'border:1px solid #1a5ff0;background:#fff;color:#1a5ff0;border-radius:999px;padding:6px 12px;font-size:13px;cursor:pointer';
        b.onclick = async () => {
          state.confirmed.push(t); b.disabled = true; b.textContent = '✓ ' + t;
          say('Yes, I have ' + esc(t), 'me');
          const cur = state.last.ctx; const again = quickImprove(Object.assign({}, cur.form, { cv: (cur.getCv ? cur.getCv() : cur.cv), targetRole: cur.role, jobDescription: cur.jd }), cur.jd, state.confirmed);
          cur.apply(again.out, again.after);
          say('Added <b>' + esc(titleCase(t)) + '</b> to your skills. New match: <b>' + again.after.score + '%</b>.');
        };
        chips.appendChild(b);
      });
    } else {
      say('Your CV now covers the vacancy well. Please read it once and check every line is true before you apply.');
    }
    return res;
  }

  window.PaulBrain = { improve, analyse, readVacancy, quickImprove, state, _titleCase: titleCase };
})();
