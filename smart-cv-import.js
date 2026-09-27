/* JobSeek CV Import — independent loader
   Handles PDF/TXT uploads and pasted CV text without depending on the CV analysis engine. */
(function () {
  'use strict';

  var PDF_SOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'
  ];
  var bound = false;
  var busy = false;

  function id(x) { return document.getElementById(x); }
  function status(message, good) {
    var el = id('status');
    if (!el) return;
    el.textContent = message;
    el.className = good ? 'muted small success' : 'muted small danger';
  }

  function fallbackParse(text) {
    var t = String(text || '').replace(/\r/g, '');
    var lines = t.split(/\n+/).map(function (x) {
      return x.replace(/^\s*[-•▪◦]\s*/, '').replace(/\*\*/g, '').trim();
    }).filter(Boolean);
    var out = {name:'',email:'',phone:'',location:'',title:'',summary:'',skills:'',experience:'',education:'',projects:'',certifications:''};
    out.email = (t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [''])[0];
    out.phone = (t.match(/(?:\+?\d[\d\s().-]{7,}\d)/) || [''])[0];

    var section = '';
    var buckets = {summary:[],experience:[],education:[],skills:[],projects:[],certifications:[]};
    var heads = {
      summary:/^(profile|profile summary|professional summary|summary|objective)$/i,
      experience:/^(work experience|professional experience|employment|experience)$/i,
      education:/^(education|academic background)$/i,
      skills:/^(skills|core skills|technical skills|competencies|core competencies)$/i,
      projects:/^(projects|selected projects|portfolio)$/i,
      certifications:/^(certifications?|professional certifications?|licenses?)$/i
    };

    lines.forEach(function(line) {
      var key = Object.keys(heads).find(function(k){ return heads[k].test(line); });
      if (key) { section = key; return; }
      var m = line.match(/^(Location|Address|City)\s*:\s*(.+)$/i);
      if (m) { out.location = m[2].trim(); return; }
      if (/^(Email|Phone|WhatsApp)\s*:/i.test(line)) return;
      if (section) buckets[section].push(line);
    });

    out.summary = buckets.summary.join('\n');
    out.experience = buckets.experience.join('\n');
    out.education = buckets.education.join('\n');
    out.skills = buckets.skills.join(', ');
    out.projects = buckets.projects.join('\n');
    out.certifications = buckets.certifications.join('\n');

    out.name = lines.find(function(x) {
      return x.length > 2 && x.length < 70 && !/@/.test(x) &&
        !/^\+?\d/.test(x) &&
        !heads.summary.test(x) && !heads.experience.test(x) &&
        !heads.education.test(x) && !heads.skills.test(x) &&
        !heads.projects.test(x) && !heads.certifications.test(x);
    }) || '';

    out.title = lines.find(function(x) {
      return /engineer|developer|designer|manager|analyst|accountant|marketing|farmer|electrician|technician|writer|tradesman|team lead/i.test(x) && x !== out.name;
    }) || '';

    if (!out.location) {
      var loc = lines.find(function(x) {
        return /\b(nigeria|lagos|abuja|ado ekiti|akure|ibadan|port harcourt|enugu|benin)\b/i.test(x);
      });
      if (loc) out.location = loc.replace(/^(location|address|city)\s*:\s*/i,'').trim();
    }
    return out;
  }

  function apply(text) {
    text = String(text || '').trim();
    if (!text) {
      status('No readable CV text was found. Please paste your CV text.', false);
      return;
    }

    var cv = id('cv');
    if (cv) cv.value = text;

    var parsed = {};
    try {
      if (window.JobSeekSmartCV && typeof window.JobSeekSmartCV.parseResumeText === 'function') {
        parsed = window.JobSeekSmartCV.parseResumeText(text) || {};
      }
    } catch (_) {}
    if (!parsed.name && !parsed.email && !parsed.summary && !parsed.experience && !parsed.education && !parsed.skills) {
      try { parsed = fallbackParse(text); } catch (_) {}
    }

    ['name','email','phone','location','title','summary','skills','experience','education','projects','certifications']
      .forEach(function(k) {
        var el = id(k);
        if (!el || parsed[k] == null || parsed[k] === '') return;
        el.value = Array.isArray(parsed[k]) ? parsed[k].join(', ') : String(parsed[k]);
        el.dispatchEvent(new Event('input', {bubbles:true}));
      });

    if (cv) cv.dispatchEvent(new Event('input', {bubbles:true}));
    status('CV imported successfully. Your candidate fields have been filled.', true);
    var preview = window.preview;
    if (typeof preview === 'function') { try { preview(); } catch (_) {} }
  }

  function loadPdfJs() {
    if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
    return new Promise(function(resolve, reject) {
      var i = 0, last;
      function next() {
        if (window.pdfjsLib) return resolve(window.pdfjsLib);
        if (i >= PDF_SOURCES.length) return reject(last || new Error('PDF reader could not be loaded.'));
        var script = document.createElement('script');
        script.src = PDF_SOURCES[i++];
        script.async = true;
        script.onload = function() {
          if (window.pdfjsLib) resolve(window.pdfjsLib);
          else { last = new Error('PDF reader API unavailable.'); next(); }
        };
        script.onerror = function() {
          last = new Error('Could not load PDF reader.');
          next();
        };
        document.head.appendChild(script);
      }
      next();
    });
  }

  async function readFile(file) {
    if (/\.txt$/i.test(file.name) || file.type === 'text/plain') {
      return await file.text();
    }
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') {
      throw new Error('Please select a PDF or TXT CV.');
    }

    status('Loading PDF reader…', true);
    var pdfjs = await loadPdfJs();
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    var buffer = await file.arrayBuffer();
    var pdf = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: true
    }).promise;

    var pages = [];
    for (var n = 1; n <= pdf.numPages; n++) {
      var page = await pdf.getPage(n);
      var content = await page.getTextContent();
      var pageText = content.items.map(function(item){ return item.str || ''; }).join(' ').trim();
      if (pageText) pages.push(pageText);
    }

    var result = pages.join('\n\n').trim();
    if (result.replace(/\\s+/g,'').length >= 80) return result;

    // Scanned/image-only PDF fallback: render each page and OCR it locally in the browser.
    status('Scanned CV detected. Loading free OCR engine…', true);
    var Tesseract = window.Tesseract;
    if (!Tesseract) {
      Tesseract = await new Promise(function(resolve, reject) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
        s.async = true;
        s.onload = function(){ window.Tesseract ? resolve(window.Tesseract) : reject(new Error('OCR engine did not start.')); };
        s.onerror = function(){ reject(new Error('Could not load the OCR engine. Check your internet connection.')); };
        document.head.appendChild(s);
      });
    }
    var ocrPages = [];
    for (var p = 1; p <= pdf.numPages; p++) {
      status('Reading scanned CV page ' + p + ' of ' + pdf.numPages + ' with OCR…', true);
      var scanPage = await pdf.getPage(p);
      var base = scanPage.getViewport({scale:1});
      var scale = Math.min(2, Math.max(1.35, 1800 / base.width));
      var viewport = scanPage.getViewport({scale:scale});
      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      var ctx = canvas.getContext('2d', {willReadFrequently:true});
      await scanPage.render({canvasContext:ctx, viewport:viewport}).promise;
      var ocr = await Tesseract.recognize(canvas, 'eng', {
        logger:function(m){
          if(m && m.status === 'recognizing text' && typeof m.progress === 'number') {
            status('OCR page ' + p + ' of ' + pdf.numPages + ' — ' + Math.round(m.progress*100) + '%…', true);
          }
        }
      });
      var pageText = String((ocr && ocr.data && ocr.data.text) || '').trim();
      if(pageText) ocrPages.push(pageText);
      canvas.width = 1; canvas.height = 1;
    }
    result = ocrPages.join('\n\n').trim();
    if (!result) throw new Error('OCR could not read this scanned CV. Please use a clearer scan or paste the CV text.');
    return result;
  }

  async function importNow(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }
    if (busy) return;
    busy = true;
    try {
      var file = id('file');
      var cv = id('cv');
      if (!file || !cv) throw new Error('Import controls are unavailable. Please refresh the page.');

      var selected = file.files && file.files[0];
      if (!selected) {
        if (cv.value.trim()) {
          status('Reading pasted CV…', true);
          apply(cv.value);
        } else {
          status('Please choose your CV file first, or paste your CV text.', false);
        }
        return;
      }

      status('Importing ' + selected.name + '…', true);
      var text = await readFile(selected);
      apply(text);
    } catch (err) {
      status('CV import failed: ' + (err && err.message ? err.message : String(err)), false);
    } finally {
      busy = false;
    }
  }

  function bind() {
    if (bound) return;
    var btn = id('parseCv'), file = id('file');
    if (!btn || !file) return;
    bound = true;

    window.JobSeekImportNow = importNow;

    /* Capture phase prevents any older inline import handler from running too. */
    document.addEventListener('click', function(e) {
      if (e.target && (e.target.id === 'parseCv' || e.target.closest && e.target.closest('#parseCv'))) {
        importNow(e);
      }
    }, true);

    document.addEventListener('change', function(e) {
      if (e.target && e.target.id === 'file') {
        importNow(e);
      }
    }, true);

    status('Import system ready — choose a PDF/TXT CV or paste your CV text.', true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind);
  else bind();
})();
