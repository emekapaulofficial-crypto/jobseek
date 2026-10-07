/* JobSeek CV Pro — accurate CV reading + professional CV output
   Parser, OCR cross-check, role packs, employer-friendly layout, real-text PDF.
   Works in the browser (window.JobSeekCVPro) and in Node (module.exports) for testing. */
(function (root) {
  "use strict";

  /* ---------- small helpers ---------- */
  var SMALL = /^(and|or|of|the|in|at|for|to|a|an|on|with|by)$/i;
  function norm(s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function titleCase(s) {
    return String(s || "").toLowerCase().replace(/[a-z][a-z'’]*/g, function (w, i) {
      if (i > 0 && SMALL.test(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    });
  }
  function isAllCaps(s) { var l = String(s).replace(/[^A-Za-z]/g, ""); return l.length > 2 && l === l.toUpperCase(); }
  function isAllLower(s) { var l = String(s).replace(/[^A-Za-z]/g, ""); return l.length > 2 && l === l.toLowerCase(); }
  function sentenceCase(s) { s = String(s || "").trim(); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

  /* ---------- job-title catalogue (Nigeria-friendly, entry level to professional) ---------- */
  var TITLES = [
    "kitchen assistant", "kitchen helper", "kitchen staff", "store keeper", "store-keeper", "storekeeper", "store officer",
    "waitress", "waiter", "cashier", "cleaner", "janitor", "cook", "chef", "baker", "barista", "bartender", "receptionist",
    "sales girl", "sales boy", "sales representative", "sales assistant", "sales executive", "shop attendant", "attendant",
    "security guard", "driver", "dispatch rider", "delivery rider", "caregiver", "nanny", "tailor", "fashion designer", "hairdresser",
    "barber", "makeup artist", "painter", "electrician", "plumber", "welder", "carpenter", "mechanic", "tiler", "bricklayer",
    "secretary", "administrative assistant", "admin assistant", "customer service", "customer care", "accountant", "data entry",
    "teacher", "nurse", "pharmacy assistant", "laundry attendant", "supervisor", "manager", "assistant manager", "marketer",
    "graphic designer", "web developer", "software developer", "developer", "engineer", "analyst", "designer", "technician",
    "administrator", "entrepreneur", "farmer", "geologist", "officer", "operator", "assistant", "coordinator", "hostess", "steward"
  ];
  TITLES.sort(function (a, b) { return b.length - a.length; });

  function findTitles(text) {
    var t = " " + norm(text) + " ", hits = [], used = [];
    TITLES.forEach(function (ti) {
      var re = new RegExp("(^|[^a-z])" + ti.replace(/[-]/g, "[- ]?") + "(?![a-z])", "g"), m;
      while ((m = re.exec(t))) {
        var s = m.index + m[1].length, e = s + ti.length;
        if (!used.some(function (u) { return s < u[1] && e > u[0]; })) { used.push([s, e]); hits.push({ at: s, t: ti }); }
      }
    });
    hits.sort(function (a, b) { return a.at - b.at; });
    var seen = {}, out = [];
    hits.forEach(function (h) { var k = h.t.replace(/[- ]/g, ""); if (!seen[k]) { seen[k] = 1; out.push(h.t.replace("store-keeper", "store keeper")); } });
    return out;
  }

  /* ---------- garbage / name detection ---------- */
  function isGarbageLine(line) {
    var s = String(line || "").trim();
    if (!s) return true;
    var letters = s.replace(/[^A-Za-z]/g, "");
    if (letters.length < 3) return true;
    var toks = s.split(/\s+/).filter(Boolean);
    if (toks.length >= 4) {
      var shortRep = toks.filter(function (t) { var u = t.replace(/[^A-Za-z]/g, "").toLowerCase(); return u.length >= 1 && u.length <= 4 && new Set(u.split("")).size <= 2; }).length;
      if (shortRep / toks.length >= 0.6) return true;
    }
    var uniq = new Set(letters.toLowerCase().split("")).size;
    if (letters.length >= 8 && uniq <= 3) return true;
    var vowels = (letters.match(/[aeiouAEIOU]/g) || []).length;
    if (letters.length >= 6 && vowels / letters.length < 0.12) return true;
    return false;
  }
  var PLACES = /\b(nigeria|lagos|abuja|enugu|ekiti|ado ekiti|ado-ekiti|ibadan|akure|benin|kano|kaduna|port harcourt|warri|delta|ondo|osun|oyo|ogun|edo|kwara|kogi|rivers|imo|abia|anambra|plateau|borno|kebbi|sokoto|katsina|niger|bauchi|gombe|adamawa|taraba|benue|nasarawa|cross river|akwa ibom|bayelsa|ebonyi|jigawa|yobe|zamfara|street|road|avenue|close|estate|layout|quarters)\b/i;
  var HEAD_WORDS = /^(curriculum vitae|resume|cv|profile|summary|professional summary|work experience|professional experience|education|skills|core skills|references|personal details|personal information|positions? applied for|objective)$/i;
  function looksLikeName(line) {
    var s = String(line || "").trim().replace(/[,;|]+$/, "");
    if (s.length < 3 || s.length > 50) return false;
    if (/[@\d:\/]/.test(s) || /[\[\]{}]/.test(s)) return false;
    if (isGarbageLine(s) || HEAD_WORDS.test(s)) return false;
    var toks = s.split(/\s+/);
    if (toks.length < 2 || toks.length > 5) return false;
    if (!toks.every(function (t) { return /^[A-Za-z][A-Za-z'’.\-]*$/.test(t); })) return false;
    if (findTitles(s).length) return false;
    if (PLACES.test(s)) return false;
    if (toks.some(function (t) { return t.length > 20; })) return false;
    return true;
  }
  function nameFromFilename(fn) {
    var b = String(fn || "").replace(/\.[a-z0-9]{2,4}$/i, "").replace(/[_\-.()+]+/g, " ").replace(/\b(cv|resume|curriculum|vitae|final|updated|new|copy|pdf|docx?|\d+)\b/gi, " ").replace(/\s+/g, " ").trim();
    return looksLikeName(b) ? titleCase(b) : "";
  }

  /* ---------- text fixes (letters dropped by PDF fonts, pipes for I, etc.) ---------- */
  function fixCommon(s) {
    return String(s || "")
      .replace(/(^|[\s(])[|](?=\s+(am|have|was|will|can|hold|hope|enjoy|work|ready|would|want|love|believe|speak|completed|graduated)\b)/gi, "$1I")
      .replace(/\bEkit(?=\s*(State|,|\.|$))/g, "Ekiti")
      .replace(/\bEki(?=\s*(State|,|\.|$))/g, "Ekiti")
      .replace(/\bWillngness\b/g, "Willingness")
      .replace(/[ \t]{2,}/g, " ");
  }

  /* ---------- placeholders like [Add any place she has worked …] ---------- */
  var PH_RE = /\[[^\]]{0,240}\]/g;
  function isPlaceholder(inner) {
    return /^(add|insert|enter|type|write|your|e\.g|eg\b|delete|example|state|city|name|date|company|\.\.\.|tbd|n\/a|xxx)/i.test(inner.trim()) ||
      /(delete this section|if none|if any|add any|to be added|your name)/i.test(inner);
  }
  function stripPlaceholders(text, found) {
    return String(text || "").replace(PH_RE, function (m) {
      var inner = m.slice(1, -1);
      if (isPlaceholder(inner)) { found.push(m); return ""; }
      return m;
    });
  }

  /* ---------- headings ---------- */
  var HEADS = [
    ["positions", ["POSITIONS APPLIED FOR", "POSITION APPLIED FOR", "JOB OBJECTIVE", "TARGET ROLES?"]],
    ["personal", ["PERSONAL DETAILS", "PERSONAL INFORMATION", "PERSONAL DATA", "BIO-?DATA", "PERSONAL PARTICULARS"]],
    ["references", ["REFERENCES?", "REFEREES"]],
    ["summary", ["PROFESSIONAL SUMMARY", "CAREER SUMMARY", "PROFILE SUMMARY", "PERSONAL PROFILE", "CAREER OBJECTIVE", "SUMMARY", "PROFILE", "OBJECTIVE", "ABOUT ME"]],
    ["experience", ["PROFESSIONAL EXPERIENCE", "WORK EXPERIENCE", "EMPLOYMENT HISTORY", "WORK HISTORY", "RELEVANT EXPERIENCE", "EMPLOYMENT", "EXPERIENCE"]],
    ["education", ["EDUCATIONAL BACKGROUND", "EDUCATION AND QUALIFICATIONS?", "ACADEMIC QUALIFICATIONS?", "ACADEMIC BACKGROUND", "EDUCATION", "QUALIFICATIONS?"]],
    ["skills", ["CORE COMPETENCIES", "CORE SKILLS", "KEY SKILLS", "TECHNICAL SKILLS", "SKILLS AND ABILITIES", "COMPETENCIES", "SKILLS"]],
    ["certifications", ["PROFESSIONAL CERTIFICATIONS?", "CERTIFICATIONS?", "CERTIFICATES?", "TRAININGS?", "LICENSES?"]],
    ["projects", ["SELECTED PROJECTS", "PROJECTS?"]],
    ["languages", ["LANGUAGES?"]],
    ["interests", ["INTERESTS? & MOTIVATION", "INTERESTS?", "HOBBIES"]],
    ["additional", ["ADDITIONAL INFORMATION", "ADDITIONAL DETAILS"]]
  ];
  var HEAD_LINE = HEADS.map(function (h) { return [h[0], new RegExp("^(?:" + h[1].join("|") + ")\\s*:?$", "i")]; });
  var HEAD_INLINE = new RegExp("\\b(" + HEADS.reduce(function (a, h) { return a.concat(h[1]); }, []).sort(function (a, b) { return b.length - a.length; }).join("|") + ")(?![A-Za-z])", "g");
  function headingKey(line) {
    var s = String(line).replace(/[:\-–—_•*#]+$/g, "").replace(/^[#*\s]+/, "").trim();
    for (var i = 0; i < HEAD_LINE.length; i++) if (HEAD_LINE[i][1].test(s)) return HEAD_LINE[i][0];
    return "";
  }

  /* ---------- labelled personal details ---------- */
  var LABELS = [
    ["address", /^(?:home |residential |contact )?(address|location|residence)$/i],
    ["phone", /^(phone|tel|telephone|mobile|whatsapp|phone number|contact number)$/i],
    ["email", /^(e-?mail|email address)$/i],
    ["stateOfOrigin", /^(state of origin|state)$/i],
    ["lga", /^(lga|local government(?: area)?)$/i],
    ["nationality", /^nationality$/i],
    ["dob", /^(date of birth|d\.?o\.?b\.?|birth ?date)$/i],
    ["maritalStatus", /^marital status$/i],
    ["gender", /^(gender|sex)$/i],
    ["languages", /^languages?(?: spoken)?$/i]
  ];
  var LABEL_WORDS = "Address|Home Address|Residential Address|Location|Residence|Phone Number|Phone|Telephone|Tel|Mobile|WhatsApp|E-?mail Address|E-?mail|State of Origin|Local Government Area|Local Government|LGA|Nationality|Date of Birth|DOB|Marital Status|Gender|Sex|Languages Spoken|Languages?";
  var LABEL_SPLIT = new RegExp("(^|[\\s,;])(" + LABEL_WORDS + ")\\s*:", "gi");
  function labelKey(l) { for (var i = 0; i < LABELS.length; i++) if (LABELS[i][1].test(l.trim())) return LABELS[i][0]; return ""; }

  /* ---------- phone ---------- */
  function normPhone(p) {
    var d = String(p || "").replace(/[^\d+]/g, "");
    if (/^\+?234\d{10}$/.test(d)) { d = d.replace(/^\+?234/, ""); return "+234 " + d.slice(0, 3) + " " + d.slice(3, 6) + " " + d.slice(6); }
    if (/^0[789]\d{9}$/.test(d)) return d.slice(0, 4) + " " + d.slice(4, 7) + " " + d.slice(7);
    return String(p || "").replace(/\s+/g, " ").trim();
  }
  function findPhone(t) {
    var m = t.match(/(?:\+?234|0)[\s().-]*[789][01]\d[\s().-]*\d{3}[\s().-]*\d{4}/);
    if (m) return normPhone(m[0]);
    m = t.match(/\+?\d[\d\s().-]{7,}\d/);
    if (m) { var n = m[0].replace(/\D/g, ""); if (n.length >= 9 && n.length <= 15) return normPhone(m[0]); }
    return "";
  }

  /* ---------- bullets ---------- */
  function cleanBullet(l) { return String(l || "").replace(/^\s*(?:[•▪◦●■□✓✔➢►▶·*]|[-–—+](?=\s))\s*/, "").trim(); }
  function hadBullet(l) { return /^\s*(?:[•▪◦●■□✓✔➢►▶·*]|[-–—+](?=\s))/.test(l); }

  /* ================== MAIN PARSER ================== */
  function parseCV(rawText, opts) {
    opts = opts || {};
    var warnings = [], placeholders = [];
    var t = String(rawText || "").replace(/\r/g, "").replace(/\u00a0/g, " ").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "");
    t = stripPlaceholders(t, placeholders);
    t = fixCommon(t);
    // run-together headings (PDF text often arrives as one long line): split before ALL-CAPS headings only
    t = t.replace(HEAD_INLINE, "\n$1\n");
    t = t.replace(LABEL_SPLIT, function (m, pre, lab) { return "\n" + lab + ":"; });
    var lines = t.split(/\n+/).map(function (x) { return x.replace(/[ \t]+/g, " ").trim(); }).filter(Boolean);

    var out = {
      name: "", email: "", phone: "", location: "", title: "", summary: "", skills: "", experience: "", education: "",
      projects: "", certifications: "", stateOfOrigin: "", nationality: "", languages: "", dob: "", maritalStatus: "", references: "",
      role: "", warnings: warnings, placeholders: placeholders
    };

    // bucket by section
    var b = {}, cur = "", header = [], labelled = {};
    lines.forEach(function (line) {
      var hk = headingKey(line);
      if (hk) { cur = hk; if (!b[cur]) b[cur] = []; return; }
      var lm = line.match(/^([A-Za-z][A-Za-z .\/'-]{1,28}?)\s*:\s*(.*)$/);
      if (lm) {
        var k = labelKey(lm[1]);
        if (k) { var lv = lm[2].replace(/^[|\s]+|[|\s]+$/g, ""); if (lv && !labelled[k]) labelled[k] = lv; return; }
        // "Skills: a, b" style
        var hk2 = headingKey(lm[1]);
        if (hk2 && lm[2].trim()) { cur = hk2; (b[cur] = b[cur] || []).push(lm[2].trim()); return; }
      }
      if (!cur) header.push(line); else (b[cur] = b[cur] || []).push(line);
    });

    // ----- contact -----
    var email = (t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
    out.email = labelled.email && /@/.test(labelled.email) ? labelled.email : email;
    out.phone = labelled.phone ? normPhone(labelled.phone) : findPhone(t);

    // ----- name & title from header -----
    var hdr = header.filter(function (l) { return !/@/.test(l) && !isGarbageLine(l); });
    var nameLine = hdr.find(looksLikeName) || "";
    if (!nameLine && opts.altHeaderLines) nameLine = (opts.altHeaderLines.find(looksLikeName) || "");
    if (!nameLine && opts.filename) nameLine = nameFromFilename(opts.filename);
    out.name = nameLine ? (isAllLower(nameLine) ? titleCase(nameLine) : nameLine.replace(/\s+/g, " ").trim()) : "";
    if (!out.name) warnings.push("I could not read your name from the file. Please type it in the Full Name box.");

    var titleLine = hdr.find(function (l) {
      return l !== nameLine && l.length <= 90 && !/\d{5,}/.test(l) && !/@/.test(l) && !PLACES.test(l) && (findTitles(l).length || /,|\//.test(l));
    }) || "";
    var positionsText = (b.positions || []).join(" ");
    var posTitles = positionsText ? findTitles(positionsText) : [];
    if (titleLine) out.title = isAllLower(titleLine) || isAllCaps(titleLine) ? titleCase(titleLine) : titleLine;
    else if (posTitles.length) out.title = posTitles.map(titleCase).join(" / ");
    if (posTitles.length) out.role = posTitles.map(titleCase).join(", ");
    else if (out.title) out.role = out.title;

    // ----- location -----
    var loc = labelled.address || "";
    if (!loc) {
      var hl = header.find(function (l) { return l !== nameLine && PLACES.test(l) && !/@/.test(l); });
      if (hl) loc = hl.split(/\s*[|•·]\s*/).filter(function (p) { return PLACES.test(p); })[0] || hl;
      loc = loc.replace(/(?:\+?\d[\d\s().-]{7,}\d)/g, "").replace(/^[\s\-–,|•·]+|[\s\-–,|•·]+$/g, "");
    }
    out.location = fixCommon(loc).trim();

    // ----- personal details -----
    out.stateOfOrigin = labelled.stateOfOrigin || "";
    out.nationality = labelled.nationality || "";
    out.dob = labelled.dob || "";
    out.maritalStatus = labelled.maritalStatus || "";
    var langs = labelled.languages || (b.languages || []).join(", ");
    out.languages = langs.replace(/\s*[;/&]\s*|\s+and\s+/gi, ", ").replace(/,\s*,/g, ",").replace(/^,|,$/g, "").trim();
    if (!out.stateOfOrigin) warnings.push("State of origin is empty. Nigerian employers often ask for it, so please add it.");

    // ----- summary -----
    out.summary = sentenceCase((b.summary || []).map(cleanBullet).join(" ").replace(/\s+/g, " ").replace(/\bi\b/g, "I").trim());

    // ----- skills -----
    var skillLines = (b.skills || []).filter(function (l) { return l.replace(/[^A-Za-z]/g, "").length > 1; });
    var skills = [];
    if (skillLines.length === 1 && !hadBullet(skillLines[0]) && /,|;/.test(skillLines[0])) skills = skillLines[0].split(/\s*[,;]\s*/);
    else skills = skillLines.map(cleanBullet);
    skills = skills.map(function (s) { return sentenceCase(s.replace(/[.;,]+$/, "").trim()); }).filter(Boolean);
    out.skills = skills.join(", ");

    // ----- experience (bullets normalised) -----
    out.experience = (b.experience || []).map(function (l) { return hadBullet(l) ? "• " + cleanBullet(l) : l; }).join("\n").trim();
    if (!out.experience) warnings.push("No work experience was found. If you have worked, helped in a shop, restaurant, church kitchen or family business, add it under Work Experience. Employers look at this first.");

    // ----- education -----
    var edu = (b.education || []).map(function (l) { return isAllCaps(l) ? titleCase(l) : l; });
    out.education = edu.join("\n").trim();
    if (out.education && !/\b(19|20)\d{2}\b/.test(out.education) && !/(ssce|waec|neco|nce|ond|hnd|b\.?sc|bachelor|diploma|certificate|degree|nabteb)/i.test(out.education))
      warnings.push("Education only shows the school name. Add your qualification and year, e.g. “SSCE (WAEC), 2022”.");

    out.certifications = (b.certifications || []).map(cleanBullet).join("\n").trim();
    out.projects = (b.projects || []).map(function (l) { return hadBullet(l) ? "• " + cleanBullet(l) : l; }).join("\n").trim();
    out.references = (b.references || []).join(" ").replace(/\s+/g, " ").trim();
    if (!out.email) warnings.push("No email address was found. Add a professional email, or employers may have no way to reply.");
    if (/\b(hard-?working|team player|honest|polite)\b/i.test(out.summary) && !/\d/.test(out.summary))
      warnings.push("The summary uses general words like “hardworking”. Employers prefer one clear line about what you can do, e.g. “Trained to serve customers politely and keep a clean work area.”");
    if (placeholders.length) warnings.push("I removed " + placeholders.length + " template note(s) such as “[Add …]” so they do not appear on your CV.");
    return out;
  }

  /* ================== OCR CROSS-CHECK ================== */
  function core(tok) { var m = /^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/.exec(tok); return { pre: m[1], core: m[2], post: m[3] }; }
  function isSubseq(a, b) { var i = 0; for (var j = 0; j < b.length && i < a.length; j++) if (a[i] === b[j]) i++; return i === a.length; }
  function lev1(a, b) {
    if (a === b) return true; if (Math.abs(a.length - b.length) > 1) return false;
    var i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
    if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
    return a.length < b.length ? a.slice(i) === b.slice(i + 1) : a.slice(i + 1) === b.slice(i);
  }
  /* lines: array of strings from the PDF text layer. ocrWords: [{text, conf}]. Returns {lines, fixes}. */
  function mergeWithOcr(lines, ocrWords) {
    var A = [];
    lines.forEach(function (ln, li) { String(ln).split(/\s+/).filter(Boolean).forEach(function (w) { A.push({ w: w, li: li }); }); });
    var B = (ocrWords || []).filter(function (w) { return w && w.text && String(w.text).trim(); }).map(function (w) { return { w: String(w.text).trim(), conf: w.conf == null ? 100 : w.conf }; });
    var n = A.length, m = B.length, fixes = [];
    if (!n || !m || n * m > 4000000) return { lines: lines.slice(), fixes: fixes };
    var ac = A.map(function (x) { return core(x.w).core.toLowerCase(); }), bc = B.map(function (x) { return core(x.w).core.toLowerCase(); });
    function sub(i, j) {
      if (ac[i] === bc[j]) return 0;
      if (ac[i].length >= 3 && bc[j].length > ac[i].length && bc[j].length - ac[i].length <= 2 && /^[a-z'’-]+$/.test(bc[j]) && B[j].conf >= 70 && isSubseq(ac[i], bc[j])) return 0.3;
      if (lev1(ac[i], bc[j])) return 0.9;
      return 2.6;
    }
    var GAP = 1, D = [], P = [];
    for (var i = 0; i <= n; i++) { D.push(new Float32Array(m + 1)); P.push(new Uint8Array(m + 1)); }
    for (i = 1; i <= n; i++) { D[i][0] = i * GAP; P[i][0] = 1; }
    for (var j = 1; j <= m; j++) { D[0][j] = j * GAP; P[0][j] = 2; }
    for (i = 1; i <= n; i++) for (j = 1; j <= m; j++) {
      var d = D[i - 1][j - 1] + sub(i - 1, j - 1), u = D[i - 1][j] + GAP, l = D[i][j - 1] + GAP;
      if (d <= u && d <= l) { D[i][j] = d; P[i][j] = 0; } else if (u <= l) { D[i][j] = u; P[i][j] = 1; } else { D[i][j] = l; P[i][j] = 2; }
    }
    var map = new Array(n); i = n; j = m;
    while (i > 0 || j > 0) {
      var p = P[i][j];
      if (i > 0 && j > 0 && p === 0) { map[i - 1] = j - 1; i--; j--; } else if (i > 0 && (j === 0 || p === 1)) { i--; } else { j--; }
    }
    var res = lines.map(function () { return []; });
    for (i = 0; i < n; i++) {
      var tok = A[i].w, jj = map[i];
      if (jj !== undefined && jj >= 0 && ac[i] !== bc[jj] && sub(i, jj) === 0.3) {
        var c = core(tok); var fixed = c.pre + core(B[jj].w).core + c.post;
        // keep the original capitalisation style
        if (c.core === c.core.toUpperCase() && c.core.length > 1) fixed = c.pre + core(B[jj].w).core.toUpperCase() + c.post;
        fixes.push([tok, fixed]); tok = fixed;
      }
      res[A[i].li].push(tok);
    }
    return { lines: res.map(function (a) { return a.join(" "); }), fixes: fixes };
  }

  /* ================== ROLE PACKS (so short or empty vacancies still get a fair check) ================== */
  var ROLE_PACKS = {
    "waitress": ["customer", "communication", "teamwork", "hygiene", "cash", "orders", "serving", "punctual"],
    "waiter": ["customer", "communication", "teamwork", "hygiene", "cash", "orders", "serving", "punctual"],
    "kitchen assistant": ["hygiene", "food", "kitchen", "teamwork", "pressure", "instructions", "cleaning"],
    "kitchen helper": ["hygiene", "food", "kitchen", "teamwork", "pressure", "instructions", "cleaning"],
    "store keeper": ["stock", "inventory", "records", "honest", "counting", "organis"],
    "cashier": ["cash", "customer", "honest", "counting", "accuracy", "pos"],
    "cleaner": ["clean", "hygiene", "punctual", "instructions", "honest", "teamwork"],
    "receptionist": ["customer", "communication", "phone", "records", "computer", "polite"],
    "sales": ["customer", "communication", "selling", "product", "target", "cash"],
    "security": ["vigilan", "patrol", "report", "honest", "punctual", "alert"],
    "driver": ["licence", "road safety", "vehicle", "punctual", "route", "honest"],
    "cook": ["food", "hygiene", "cooking", "kitchen", "clean", "teamwork"],
    "baker": ["baking", "hygiene", "dough", "oven", "clean", "punctual"]
  };
  var DUTIES = {
    "waitress": ["Welcomed customers and took their orders", "Served food and drinks politely and quickly", "Kept tables and the dining area clean", "Handled cash and gave correct change", "Worked well with the kitchen team during busy hours"],
    "kitchen assistant": ["Prepared ingredients for cooking (washing, peeling, cutting)", "Kept the kitchen, utensils and work area clean", "Followed food hygiene rules every day", "Washed dishes and arranged the kitchen after use", "Helped the cook during busy hours"],
    "store keeper": ["Received goods and counted them against the delivery note", "Kept a daily record of items coming in and going out", "Arranged the store neatly so items could be found quickly", "Reported low stock to the manager", "Kept the store clean and secure"],
    "cashier": ["Received payments and gave correct change", "Recorded daily sales accurately", "Counted the cash at the end of each day", "Served customers politely at the counter"],
    "cleaner": ["Cleaned floors, tables, toilets and windows daily", "Used cleaning materials safely", "Arrived on time and kept to the cleaning schedule", "Reported damaged items to the supervisor"],
    "sales": ["Welcomed customers and helped them choose products", "Explained prices and product details", "Kept the shelves tidy and well arranged", "Recorded sales and handled cash"],
    "_": ["Worked with the team to finish tasks on time", "Followed instructions and learned new tasks quickly", "Kept the work area clean and organised", "Served customers politely"]
  };
  function dutySuggestions(title) {
    var t = norm(title).replace(/store-?keeper/g, "store keeper");
    var keys = Object.keys(DUTIES).filter(function (k) { return k !== "_" && t.indexOf(k) >= 0; });
    if (!keys.length && /\bwaiter/.test(t)) keys = ["waitress"];
    if (!keys.length && /\bsales|shop/.test(t)) keys = ["sales"];
    return keys.length ? DUTIES[keys[0]] : DUTIES._;
  }
  function packFor(role) {
    var r = norm(role).replace(/store-?keeper/g, "store keeper"), keys = Object.keys(ROLE_PACKS), out = [];
    keys.forEach(function (k) { if (r.indexOf(k) >= 0 || (k === "sales" && /\bsales/.test(r)) || (k === "security" && /\bsecurity|guard/.test(r))) ROLE_PACKS[k].forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); });
    return out;
  }
  /* If the vacancy text is empty or too short to analyse, build a requirements list from the role names. */
  function effectiveVacancy(role, jd) {
    var words = (String(jd || "").match(/[A-Za-z]{3,}/g) || []).length;
    if (words >= 25) return { text: jd, synthetic: false };
    var pack = packFor(role);
    if (!pack.length) return { text: jd, synthetic: false };
    var lines = ["Requirements for " + role + ":"].concat(pack.map(function (p) { return "Required skills: " + p + "."; }));
    return { text: (jd ? jd + "\n" : "") + lines.join("\n"), synthetic: true, pack: pack };
  }

  /* ================== STRUCTURED EXPERIENCE / EDUCATION ================== */
  var DATE_RE = /((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(19|20)\d{2}\s*(?:[-–—]|to)\s*(?:((?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}|present|date|now|till date)|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?(?:19|20)\d{2}/i;
  function parseEntries(text) {
    var entries = [], cur = null;
    String(text || "").split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean).forEach(function (line) {
      if (hadBullet(line)) { if (!cur) { cur = { head: [], bullets: [], notes: [] }; entries.push(cur); } cur.bullets.push(cleanBullet(line)); return; }
      if (/\s\|\s/.test(line) || (DATE_RE.test(line) && line.length < 90)) { cur = { head: line.split(/\s+\|\s+/).map(function (s) { return s.trim(); }), bullets: [], notes: [] }; entries.push(cur); return; }
      if (cur && cur.head.length && !cur.bullets.length && line.length < 70 && !/[.!?]$/.test(line) && cur.notes.length < 1 && !cur.sub) { cur.sub = line; return; }
      if (!cur) { cur = { head: [line], bullets: [], notes: [] }; entries.push(cur); return; }
      cur.notes.push(line);
    });
    return entries;
  }
  function entryParts(e) {
    var dates = "", rest = [];
    e.head.forEach(function (p) { if (!dates && DATE_RE.test(p) && p.length < 40) dates = p; else rest.push(p); });
    return { title: rest[0] || "", sub: rest.slice(1).concat(e.sub ? [e.sub] : []).join(", "), dates: dates };
  }

  /* ================== PROFESSIONAL LAYOUT (HTML preview) ================== */
  var LABELS_SEC = { summary: "Professional Summary", experience: "Professional Experience", skills: "Core Skills", education: "Education", projects: "Projects", certifications: "Certifications", personal: "Personal Details", references: "References" };
  function effectiveOrder(order, f) {
    var o = (order || []).slice();
    ["personal", "references"].forEach(function (k) { if (o.indexOf(k) < 0) o.push(k); });
    if (!String(f.experience || "").trim()) {
      o = o.filter(function (k) { return k !== "education"; });
      var at = o.indexOf("summary"); o.splice(at >= 0 ? at + 1 : 0, 0, "education");
    }
    return o;
  }
  function contactItems(f) {
    var seen = {}, items = [];
    [f.phone, f.email, f.location].forEach(function (x) { x = String(x || "").trim(); if (x && !seen[x.toLowerCase()]) { seen[x.toLowerCase()] = 1; items.push(x); } });
    return items;
  }
  function personalRows(f) {
    var r = [];
    [["State of Origin", f.stateOfOrigin], ["Nationality", f.nationality], ["Languages", f.languages], ["Date of Birth", f.dob], ["Marital Status", f.maritalStatus]].forEach(function (p) { if (String(p[1] || "").trim()) r.push(p); });
    return r;
  }
  function sectionHtml(k, f) {
    var body = "";
    if (k === "summary") { var s = String(f.summary || "").replace(/\s+/g, " ").trim(); if (s) body = "<p class=\"rs-p\">" + esc(s) + "</p>"; }
    else if (k === "skills") {
      var sk = String(f.skills || "").split(/[,;\n]+/).map(function (x) { return cleanBullet(x); }).filter(Boolean);
      if (sk.length) body = "<ul class=\"rs-skills\">" + sk.map(function (x) { return "<li>" + esc(sentenceCase(x)) + "</li>"; }).join("") + "</ul>";
    } else if (k === "experience") {
      var ex = parseEntries(f.experience);
      body = ex.map(function (e) {
        var p = entryParts(e);
        return "<div class=\"rs-job\"><div class=\"rs-row\"><span class=\"rs-strong\">" + esc(p.title) + "</span><span class=\"rs-dates\">" + esc(p.dates) + "</span></div>" +
          (p.sub ? "<div class=\"rs-sub\">" + esc(p.sub) + "</div>" : "") +
          (e.notes.length ? "<p class=\"rs-p\">" + esc(e.notes.join(" ")) + "</p>" : "") +
          (e.bullets.length ? "<ul class=\"rs-list\">" + e.bullets.map(function (b) { return "<li>" + esc(sentenceCase(b)) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
      }).join("");
    } else if (k === "education") {
      var ed = parseEntries(f.education);
      body = ed.map(function (e) {
        var p = entryParts(e);
        return "<div class=\"rs-job\"><div class=\"rs-row\"><span class=\"rs-strong\">" + esc(p.title) + "</span><span class=\"rs-dates\">" + esc(p.dates) + "</span></div>" +
          (p.sub ? "<div class=\"rs-sub\">" + esc(p.sub) + "</div>" : "") +
          (e.notes.length ? "<p class=\"rs-p\">" + esc(e.notes.join(" ")) + "</p>" : "") +
          (e.bullets.length ? "<ul class=\"rs-list\">" + e.bullets.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>" : "") + "</div>";
      }).join("");
    } else if (k === "projects" || k === "certifications") {
      var items = String(f[k] || "").split(/\n+/).map(cleanBullet).filter(Boolean);
      if (items.length) body = "<ul class=\"rs-list\">" + items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>";
    } else if (k === "personal") {
      var rows = personalRows(f);
      if (rows.length) body = "<div class=\"rs-personal\">" + rows.map(function (r) { return "<div><span class=\"rs-strong\">" + esc(r[0]) + ":</span> " + esc(r[1]) + "</div>"; }).join("") + "</div>";
    } else if (k === "references") {
      body = "<p class=\"rs-p\">" + esc(String(f.references || "").trim() || "Available on request.") + "</p>";
    }
    if (!body) return "";
    return "<section class=\"rs-sec\"><h3 class=\"rs-h\">" + esc(LABELS_SEC[k]) + "</h3>" + body + "</section>";
  }
  function renderResume(f, order, variant) {
    var items = contactItems(f);
    var head = "<header class=\"rs-head\"><div class=\"rs-name\">" + esc(f.name || "Your Full Name") + "</div>" +
      (f.title ? "<div class=\"rs-title\">" + esc(f.title) + "</div>" : "") +
      "<div class=\"rs-contact\">" + (items.length ? items.map(function (x) { return "<span>" + esc(x) + "</span>"; }).join("<i> | </i>") : "<span>Phone | Email | Location</span>") + "</div></header>";
    var body = effectiveOrder(order, f).map(function (k) { return sectionHtml(k, f); }).join("");
    return "<article class=\"resume-page rs " + (variant || "classic") + "\">" + head + "<div class=\"rs-body\">" + body + "</div></article>";
  }
  var RS_CSS = ".resume-page.rs{width:100%;max-width:794px;min-height:1123px;margin:0 auto;background:#fff;color:#111;padding:44px 52px;font-family:Calibri,Arial,Helvetica,sans-serif;line-height:1.38;box-shadow:0 8px 30px rgba(8,26,51,.12);font-size:12.5px}" +
    ".rs .rs-head{border-bottom:2.5px solid #155eef;padding-bottom:12px;margin-bottom:6px}.rs .rs-name{font-size:30px;font-weight:800;letter-spacing:.3px;color:#0b1f3a;line-height:1.15}.rs .rs-title{font-size:15px;color:#155eef;font-weight:700;margin-top:3px}.rs .rs-contact{font-size:12px;color:#333;margin-top:7px}.rs .rs-contact i{font-style:normal;color:#9aa7b8;margin:0 4px}" +
    ".rs .rs-sec{margin-top:15px;break-inside:avoid}.rs .rs-h{font-size:12.5px;font-weight:800;letter-spacing:1.6px;text-transform:uppercase;color:#0b1f3a;border-bottom:1px solid #c9d3e0;padding-bottom:3px;margin:0 0 8px}" +
    ".rs .rs-p{margin:0 0 4px;font-size:12.5px;white-space:normal}.rs .rs-row{display:flex;justify-content:space-between;gap:12px;align-items:baseline}.rs .rs-strong{font-weight:700;color:#111}.rs .rs-dates{font-size:12px;color:#444;white-space:nowrap}.rs .rs-sub{color:#444;font-style:italic;margin-bottom:2px}" +
    ".rs .rs-job{margin-bottom:9px}.rs ul{margin:3px 0 0 18px;padding:0}.rs li{font-size:12.5px;margin:1.5px 0;white-space:normal}.rs .rs-skills{columns:2;column-gap:28px;margin-left:18px}.rs .rs-skills li{break-inside:avoid}.rs .rs-personal{display:grid;grid-template-columns:1fr 1fr;gap:3px 24px}" +
    ".resume-page.rs.modern{border-top:10px solid #155eef}.resume-page.rs.modern .rs-name{color:#155eef}.resume-page.rs.minimal{font-family:Georgia,'Times New Roman',serif;box-shadow:none;border:1px solid #ddd}.resume-page.rs.minimal .rs-head{border-bottom:1px solid #222;text-align:center}.resume-page.rs.minimal .rs-title{color:#333;font-style:italic}.resume-page.rs.minimal .rs-h{border-bottom:0;letter-spacing:2.4px}" +
    "@media(max-width:700px){.resume-page.rs{padding:26px 20px;min-height:0}.rs .rs-skills{columns:1}.rs .rs-personal{grid-template-columns:1fr}.rs .rs-name{font-size:24px}}" +
    "@media print{.resume-page.rs{box-shadow:none;border:0;padding:0;min-height:0}}";

  /* ================== REAL-TEXT PDF (selectable text, readable by employer ATS) ================== */
  function pdfSafe(v) {
    return String(v == null ? "" : v).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x09\x0a\x20-\x7e\u00a0-\u00ff\u2013\u2014\u2022]/g, "");
  }
  function buildPdf(jsPDF, f0, order) {
    var f = {}; Object.keys(f0 || {}).forEach(function (k) { f[k] = typeof f0[k] === "string" ? pdfSafe(f0[k]) : f0[k]; });
    var doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
    var W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    var M = 46, TOP = 48, BOT = H - 46, CW = W - 2 * M, y = TOP;
    function need(h) { if (y + h > BOT) { doc.addPage(); y = TOP; } }
    function setf(style, size, color) { doc.setFont("helvetica", style); doc.setFontSize(size); doc.setTextColor(color[0], color[1], color[2]); }
    var INK = [17, 17, 17], NAVY = [11, 31, 58], BLUE = [21, 94, 239], GREY = [68, 68, 68];
    function wrap(txt, size, style, width) { setf(style, size, INK); return doc.splitTextToSize(String(txt), width); }
    function para(txt, size, style, color, gap, indent) {
      indent = indent || 0; var ls = wrap(txt, size, style, CW - indent), lh = size * 1.38;
      ls.forEach(function (l) { need(lh); setf(style, size, color || INK); doc.text(l, M + indent, y + size); y += lh; });
      y += gap || 0;
    }
    function bullet(txt, size) {
      var ls = wrap(txt, size, "normal", CW - 16), lh = size * 1.38;
      ls.forEach(function (l, i) { need(lh); setf("normal", size, INK); if (i === 0) doc.text("\u2022", M + 3, y + size); doc.text(l, M + 14, y + size); y += lh; });
      y += 1.5;
    }
    function heading(label) {
      need(34); y += 8; setf("bold", 11, NAVY); doc.setCharSpace && doc.setCharSpace(1);
      doc.text(label.toUpperCase(), M, y + 11); doc.setCharSpace && doc.setCharSpace(0);
      y += 15; doc.setDrawColor(201, 211, 224); doc.setLineWidth(0.8); doc.line(M, y, W - M, y); y += 7;
    }
    // header
    setf("bold", 25, NAVY); doc.text(String(f.name || "Your Full Name"), M, y + 24); y += 30;
    if (f.title) { setf("bold", 13, BLUE); doc.text(String(f.title), M, y + 12); y += 18; }
    var items = contactItems(f);
    if (items.length) { var ls = wrap(items.join("  |  "), 10.5, "normal", CW); ls.forEach(function (l) { setf("normal", 10.5, GREY); doc.text(l, M, y + 10); y += 14; }); }
    y += 2; doc.setDrawColor(21, 94, 239); doc.setLineWidth(2); doc.line(M, y, W - M, y); y += 6;

    effectiveOrder(order, f).forEach(function (k) {
      var html = sectionHtml(k, f); if (!html) return;
      heading(LABELS_SEC[k]);
      if (k === "summary") para(String(f.summary).replace(/\s+/g, " ").trim(), 11, "normal", INK, 2);
      else if (k === "skills") {
        var sk = String(f.skills || "").split(/[,;\n]+/).map(cleanBullet).filter(Boolean).map(sentenceCase), colW = (CW - 20) / 2;
        for (var i = 0; i < sk.length; i += 2) {
          var a = wrap(sk[i], 11, "normal", colW - 14), bb = sk[i + 1] ? wrap(sk[i + 1], 11, "normal", colW - 14) : [], rows = Math.max(a.length, bb.length), lh = 11 * 1.38;
          need(rows * lh);
          a.forEach(function (l, r) { setf("normal", 11, INK); if (r === 0) doc.text("\u2022", M + 3, y + 11 + r * lh); doc.text(l, M + 14, y + 11 + r * lh); });
          bb.forEach(function (l, r) { setf("normal", 11, INK); if (r === 0) doc.text("\u2022", M + colW + 20 + 3, y + 11 + r * lh); doc.text(l, M + colW + 20 + 14, y + 11 + r * lh); });
          y += rows * lh + 1.5;
        }
      } else if (k === "experience" || k === "education") {
        parseEntries(f[k]).forEach(function (e) {
          var p = entryParts(e); need(40);
          setf("bold", 11.5, INK); doc.text(p.title, M, y + 11.5);
          if (p.dates) { setf("normal", 10.5, GREY); doc.text(p.dates, W - M, y + 11.5, { align: "right" }); }
          y += 15;
          if (p.sub) { setf("italic", 11, GREY); doc.text(doc.splitTextToSize(p.sub, CW)[0], M, y + 11); y += 14; }
          if (e.notes.length) para(e.notes.join(" "), 11, "normal", INK, 1);
          e.bullets.forEach(function (bt) { bullet(k === "experience" ? sentenceCase(bt) : bt, 11); });
          y += 5;
        });
      } else if (k === "projects" || k === "certifications") {
        String(f[k] || "").split(/\n+/).map(cleanBullet).filter(Boolean).forEach(function (x) { bullet(x, 11); });
      } else if (k === "personal") {
        personalRows(f).forEach(function (r) { need(15); setf("bold", 11, INK); doc.text(r[0] + ":", M, y + 11); setf("normal", 11, INK); doc.text(String(r[1]), M + 105, y + 11); y += 15; });
      } else if (k === "references") para(String(f.references || "").trim() || "Available on request.", 11, "normal", INK, 0);
    });
    doc.setProperties && doc.setProperties({ title: (f.name || "CV") + " - CV", author: f.name || "", subject: "Curriculum Vitae" });
    return doc;
  }

  /* ================== Word-friendly HTML ================== */
  function wordHtml(f, order) {
    var body = renderResume(f, order, "classic");
    var css = "body{font-family:Calibri,Arial,sans-serif;color:#111;font-size:11pt}.rs-name{font-size:24pt;font-weight:bold;color:#0b1f3a}.rs-title{font-size:13pt;color:#155eef;font-weight:bold}.rs-contact{font-size:10pt;color:#333}.rs-h{font-size:11pt;letter-spacing:1px;text-transform:uppercase;border-bottom:1px solid #999;color:#0b1f3a;margin:14pt 0 5pt}.rs-strong{font-weight:bold}.rs-dates{float:right;font-size:10pt}.rs-sub{font-style:italic;color:#444}ul{margin:2pt 0 4pt 16pt}li{margin:1pt 0}";
    return "<!doctype html><html><head><meta charset=\"utf-8\"><title>" + esc(f.name || "CV") + "</title><style>" + css + "</style></head><body>" + body + "</body></html>";
  }

  var api = {
    parseCV: parseCV, mergeWithOcr: mergeWithOcr, nameFromFilename: nameFromFilename, isGarbageLine: isGarbageLine, looksLikeName: looksLikeName,
    findTitles: findTitles, fixCommon: fixCommon, titleCase: titleCase, effectiveVacancy: effectiveVacancy, packFor: packFor, dutySuggestions: dutySuggestions,
    parseEntries: parseEntries, renderResume: renderResume, RS_CSS: RS_CSS, buildPdf: buildPdf, wordHtml: wordHtml,
    effectiveOrder: effectiveOrder, LABELS_SEC: LABELS_SEC, normPhone: normPhone, stripPlaceholders: stripPlaceholders
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.JobSeekCVPro = api;
})(typeof window !== "undefined" ? window : globalThis);
