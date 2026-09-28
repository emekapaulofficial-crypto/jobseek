/* JobSeek CV Import — single, private browser-side importer
   PDF/TXT/paste -> text extraction -> OCR fallback -> one parser -> fields -> preview.
   Nothing is uploaded to a public page or stored on a server by this importer. */
(function () {
  'use strict';

  var PDF_SOURCES = [
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    'https://unpkg.com/pdfjs-dist@3.11.174/build/pdf.min.js'
  ];
  var TESSERACT_SRC = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  var PDF_WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  var bound = false;
  var busy = false;

  function id(x) { return document.getElementById(x); }

  function status(message, good) {
    var el = id('status');
    if (!el) return;
    el.textContent = message;
    el.className = good ? 'muted small success' : 'muted small danger';
  }

  function setDownloadStatus(message, good) {
    var el = id('downloadStatus');
    if (!el) return;
    el.textContent = message || '';
    el.className = good ? 'muted small success' : 'muted small danger';
  }

  function fireInput(el) {
    try { el.dispatchEvent(new Event('input', { bubbles: true })); } catch (_) {}
  }

  function fallbackParse(text) {
    var t = String(text || '').replace(/\r/g, '');
    var lines = t.split(/\n+/).map(function (x) {
      return x.replace(/^\s*[-•▪◦]\s*/, '').replace(/\*\*/g, '').trim();
    }).filter(Boolean);

    var out = {
      name:'', email:'', phone:'', location:'', title:'',
      summary:'', skills:'', experience:'', education:'',
      projects:'', certifications:''
    };

    out.email = (t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [''])[0];

    // Prefer phone-shaped values and avoid accidentally treating years/date ranges
    // from employment history as a phone number.
    var phoneMatches = t.match(/(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{3,4}\)?[\s.-]?)\d{3,4}[\s.-]?\d{3,5}/g) || [];
    out.phone = phoneMatches.map(function(x){ return x.trim(); }).find(function(x){
      var digits = x.replace(/\D/g,'');
      return digits.length >= 9 && digits.length <= 15;
    }) || '';

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
        !/^(email|phone|mobile|tel|whatsapp|location|address|city|nationality)\s*:/i.test(x) &&
        !heads.summary.test(x) && !heads.experience.test(x) &&
        !heads.education.test(x) && !heads.skills.test(x) &&
        !heads.projects.test(x) && !heads.certifications.test(x);
    }) || '';

    out.title = lines.find(function(x) {
      return /engineer|developer|designer|manager|analyst|accountant|marketing|farmer|electrician|technician|writer|tradesman|team lead/i.test(x) && x !== out.name;
    }) || '';

    if (!out.location) {
      var loc = lines.find(function(x) {
        return /\b(nigeria|lagos|abuja|ado ekiti|akure|ibadan|port harcourt|enugu|benin|warri|ondo)\b/i.test(x);
      });
      if (loc) out.location = loc.replace(/^(location|address|city)\s*:\s*/i,'').trim();
    }

    return out;
  }

  function parseWithSingleParser(text) {
    // Use the importer parser as the deterministic base, then fill only fields
    // that it could not confidently identify from the existing engine parser.
    // This prevents a weak parser result from overwriting good imported fields.
    var fallback = {};
    var engine = {};

    try { fallback = fallbackParse(text) || {}; } catch (_) { fallback = {}; }

    try {
      if (window.JobSeekSmartCV && typeof window.JobSeekSmartCV.parseResumeText === 'function') {
        engine = window.JobSeekSmartCV.parseResumeText(text) || {};
      }
    } catch (_) { engine = {}; }

    var merged = {};
    [
      'name','email','phone','location','title','summary','skills',
      'experience','education','projects','certifications'
    ].forEach(function(k) {
      var primary = fallback[k];
      var secondary = engine[k];
      if (Array.isArray(primary)) primary = primary.join(', ');
      if (Array.isArray(secondary)) secondary = secondary.join(', ');
      merged[k] = String(primary == null ? '' : primary).trim() ||
                  String(secondary == null ? '' : secondary).trim() || '';
    });

    return merged;
  }

  function apply(text) {
    text = String(text || '').trim();
    if (!text) {
      status('No readable CV text was found. Please paste your CV text.', false);
      return false;
    }

    var cv = id('cv');
    if (cv) {
      cv.value = text;
      fireInput(cv);
    }

    var parsed = parseWithSingleParser(text);
    var filled = 0;

    ['name','email','phone','location','title','summary','skills','experience','education','projects','certifications']
      .forEach(function(k) {
        var el = id(k);
        if (!el || parsed[k] == null || String(parsed[k]).trim() === '') return;
        el.value = Array.isArray(parsed[k]) ? parsed[k].join(', ') : String(parsed[k]);
        fireInput(el);
        filled++;
      });

    if (typeof window.JobSeekPreview === 'function') {
      try { window.JobSeekPreview(); } catch (_) {}
    } else if (typeof window.preview === 'function') {
      try { window.preview(); } catch (_) {}
    }

    status(
      filled
        ? 'CV imported successfully. ' + filled + ' candidate fields were filled and the live preview was updated.'
        : 'CV text was imported, but the field parser could not confidently identify the sections. Please review or paste the text into the CV field.',
      !!filled
    );
    return true;
  }

  function loadScript(src, test, label) {
    if (test()) return Promise.resolve();
    return new Promise(function(resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = function() {
        if (test()) resolve();
        else reject(new Error(label + ' did not initialize.'));
      };
      script.onerror = function() {
        reject(new Error('Could not load ' + label + '. Check your internet connection and try again.'));
      };
      document.head.appendChild(script);
    });
  }

  async function loadPdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    var lastError = null;

    for (var i = 0; i < PDF_SOURCES.length; i++) {
      try {
        await loadScript(PDF_SOURCES[i], function(){ return !!window.pdfjsLib; }, 'PDF reader');
        if (window.pdfjsLib) return window.pdfjsLib;
      } catch (err) {
        lastError = err;
      }
    }

    throw lastError || new Error('PDF reader could not be loaded.');
  }

  async function loadTesseract() {
    if (window.Tesseract) return window.Tesseract;
    await loadScript(TESSERACT_SRC, function(){ return !!window.Tesseract; }, 'OCR engine');
    return window.Tesseract;
  }

  async function readPdfText(pdfjs, buffer) {
    if (pdfjs.GlobalWorkerOptions) {
      pdfjs.GlobalWorkerOptions.workerSrc = PDF_WORKER;
    }

    var pdf = await pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useWorkerFetch: false,
      isEvalSupported: true
    }).promise;

    var pages = [];
    for (var n = 1; n <= pdf.numPages; n++) {
      status('Reading PDF page ' + n + ' of ' + pdf.numPages + '…', true);
      var page = await pdf.getPage(n);
      var content = await page.getTextContent();
      var pageText = (content.items || []).map(function(item){ return item.str || ''; }).join(' ').trim();
      if (pageText) pages.push(pageText);
    }

    return { pdf: pdf, text: pages.join('\n\n').trim() };
  }

  async function readScannedPdf(pdf, Tesseract) {
    var ocrPages = [];

    for (var p = 1; p <= pdf.numPages; p++) {
      status('Scanned CV detected. OCR page ' + p + ' of ' + pdf.numPages + '…', true);

      var page = await pdf.getPage(p);
      var base = page.getViewport({scale:1});
      var scale = Math.min(2, Math.max(1.35, 1800 / Math.max(1, base.width)));
      var viewport = page.getViewport({scale:scale});
      var canvas = document.createElement('canvas');

      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      var ctx = canvas.getContext('2d', {willReadFrequently:true});
      await page.render({canvasContext:ctx, viewport:viewport}).promise;

      var ocr = await Tesseract.recognize(canvas, 'eng', {
        logger:function(m) {
          if (m && m.status === 'recognizing text' && typeof m.progress === 'number') {
            status('OCR page ' + p + ' of ' + pdf.numPages + ' — ' + Math.round(m.progress * 100) + '%…', true);
          }
        }
      });

      var pageText = String((ocr && ocr.data && ocr.data.text) || '').trim();
      if (pageText) ocrPages.push(pageText);

      canvas.width = 1;
      canvas.height = 1;
    }

    return ocrPages.join('\n\n').trim();
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
    var result = await readPdfText(pdfjs, await file.arrayBuffer());

    // A text layer can exist but still be too small to be useful.
    // Use OCR for image/scanned PDFs rather than failing the import.
    if (result.text.replace(/\s+/g, '').length >= 80) {
      return result.text;
    }

    status('This appears to be a scanned/image-only CV. Loading free OCR…', true);
    var Tesseract = await loadTesseract();
    var ocrText = await readScannedPdf(result.pdf, Tesseract);

    if (!ocrText) {
      throw new Error('OCR could not read this scanned CV. Please use a clearer scan or paste the CV text.');
    }

    return ocrText;
  }

  async function importNow(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }

    if (busy) return;
    busy = true;

    var button = id('parseCv');
    if (button) {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
    }

    try {
      var file = id('file');
      var cv = id('cv');

      if (!file || !cv) {
        throw new Error('Import controls are unavailable. Please refresh the page.');
      }

      var selected = file.files && file.files[0];

      if (!selected) {
        if (cv.value.trim()) {
          status('Reading pasted CV…', true);
          apply(cv.value);
        } else {
          status('Please choose a PDF/TXT CV or paste your CV text first.', false);
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
      if (button) {
        button.disabled = false;
        button.removeAttribute('aria-busy');
      }
    }
  }

  function clearImportedCV(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      if (event.stopImmediatePropagation) event.stopImmediatePropagation();
    }

    var file = id('file');
    var cv = id('cv');

    if (file) file.value = '';
    if (cv) {
      cv.value = '';
      fireInput(cv);
    }

    ['name','email','phone','location','title','summary','skills','experience','education','projects','certifications']
      .forEach(function(k) {
        var el = id(k);
        if (el) {
          el.value = '';
          fireInput(el);
        }
      });

    if (typeof window.JobSeekPreview === 'function') {
      try { window.JobSeekPreview(); } catch (_) {}
    }

    setDownloadStatus('');
    status('Imported CV cleared.', true);
  }

  function bind() {
    if (bound) return;

    var btn = id('parseCv');
    var file = id('file');
    if (!btn || !file) return;

    bound = true;
    window.JobSeekImportNow = importNow;

    // One explicit import action. Selecting a file alone never changes the CV.
    // Capture phase also neutralises any older duplicate click handlers.
    document.addEventListener('click', function(e) {
      if (e.target && (e.target.id === 'parseCv' ||
          (e.target.closest && e.target.closest('#parseCv')))) {
        importNow(e);
      }
    }, true);

    var clearBtn = id('clearImport');
    if (clearBtn) {
      clearBtn.addEventListener('click', clearImportedCV);
    }

    status('Import system ready — choose a PDF/TXT CV or paste your CV text, then press Import CV & Fill Fields.', true);
  }

  window.JobSeekImport = {
    importNow: importNow,
    clear: clearImportedCV,
    parse: parseWithSingleParser
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bind);
  } else {
    bind();
  }
})();