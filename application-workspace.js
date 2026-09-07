(() => {
  'use strict';

  const q = new URLSearchParams(window.location.search);
  const $ = (id) => document.getElementById(id);
  const text = (key, fallback = '') => q.get(key) || fallback;

  const job = {
    id: text('id'),
    title: text('title', 'Selected job'),
    company: text('company', 'Employer not specified'),
    location: text('location', 'See original listing'),
    apply: text('apply'),
    posted: text('posted'),
    closing: text('closing'),
    description: text('description'),
    source: text('source'),
    visa: text('visa')
  };

  const fields = ['cv', 'cover', 'portfolio', 'linkedin', 'indeed'];
  const storageKey = 'jobseek_app_' + btoa(unescape(encodeURIComponent([job.id, job.title, job.company, job.location].join('|')))).slice(0, 80);

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  function getData() {
    return {
      ...job,
      cv: $('cv')?.value.trim() || '',
      cover: $('cover')?.value.trim() || '',
      portfolio: $('portfolio')?.value.trim() || '',
      linkedin: $('linkedin')?.value.trim() || '',
      indeed: $('indeed')?.value.trim() || '',
      score: $('score')?.textContent || '0%'
    };
  }

  function renderPack() {
    const d = getData();
    const pack = $('packContent');
    if (!pack) return;
    pack.innerHTML = `
      <h3>${esc(d.title)}</h3>
      <p>${esc(d.company)}${d.location ? ' · ' + esc(d.location) : ''}</p>
      <p><strong>Application Readiness:</strong> ${esc(d.score)}</p>
      <hr>
      <h3>CV</h3><div style="white-space:pre-wrap">${esc(d.cv) || 'Not provided'}</div>
      <h3>Cover Letter</h3><div style="white-space:pre-wrap">${esc(d.cover) || 'Not provided'}</div>
      <h3>Professional Links</h3>
      <p>Portfolio: ${d.portfolio ? `<a href="${esc(d.portfolio)}" target="_blank" rel="noopener noreferrer">${esc(d.portfolio)}</a>` : 'Not provided'}</p>
      <p>LinkedIn: ${d.linkedin ? `<a href="${esc(d.linkedin)}" target="_blank" rel="noopener noreferrer">${esc(d.linkedin)}</a>` : 'Not provided'}</p>
      <p>Indeed: ${d.indeed ? `<a href="${esc(d.indeed)}" target="_blank" rel="noopener noreferrer">${esc(d.indeed)}</a>` : 'Not provided'}</p>
      <h3>Vacancy</h3>
      <p>Posted: ${esc(d.posted) || 'Not specified'}<br>
      Closing: ${esc(d.closing) || 'Not specified'}<br>
      Visa sponsorship: ${esc(d.visa) || 'Not specified'}<br>
      Source: ${esc(d.source) || 'Not specified'}<br>
      Original/application link: ${d.apply ? `<a href="${esc(d.apply)}" target="_blank" rel="noopener noreferrer">Open original listing</a>` : 'Not provided'}</p>`;
  }

  function score() {
    let total = 10;
    const weights = { cv: 30, cover: 25, portfolio: 20, linkedin: 10, indeed: 5 };
    const checks = [];
    fields.forEach((id) => {
      const value = $(id)?.value.trim() || '';
      if (value) total += weights[id];
      checks.push(`<p>${value ? '✅' : '⚠️'} ${id === 'cv' ? 'CV' : id === 'cover' ? 'Cover letter' : id[0].toUpperCase() + id.slice(1) + ' link'} ${value ? 'ready' : 'needs attention'}</p>`);
    });
    if ($('score')) $('score').textContent = `${Math.min(total, 100)}%`;
    if ($('checks')) $('checks').innerHTML = checks.join('');
    renderPack();
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(getData()));
      score();
      alert('Application saved on this device.');
    } catch (error) {
      console.error(error);
      alert('Unable to save this application on this device.');
    }
  }

  function printPack() {
    window.print();
  }

  function downloadPDF() {
    const d = getData();
    const pdfLib = window.jspdf;
    if (!pdfLib || !pdfLib.jsPDF) {
      alert('PDF library is unavailable right now. Use Print / Save instead.');
      return;
    }
    try {
      const doc = new pdfLib.jsPDF({ unit: 'mm', format: 'a4' });
      let y = 18;
      const width = 180;
      const addText = (value, size = 10, gap = 5) => {
        doc.setFontSize(size);
        const lines = doc.splitTextToSize(String(value || 'Not provided'), width);
        lines.forEach((line) => {
          if (y > 275) { doc.addPage(); y = 18; }
          doc.text(line, 15, y); y += gap;
        });
      };
      addText('JOBSEEK PROFESSIONAL APPLICATION PACK', 17, 8);
      addText(d.title, 13, 6);
      addText([d.company, d.location].filter(Boolean).join(' | '), 10, 5);
      addText(`Posted: ${d.posted || 'Not specified'} | Closing: ${d.closing || 'Not specified'}`, 10, 5);
      addText(`Application Readiness: ${d.score}`, 10, 7);
      [['TAILORED CV', d.cv], ['COVER LETTER', d.cover], ['PROFESSIONAL LINKS', `Portfolio: ${d.portfolio || 'Not provided'}\nLinkedIn: ${d.linkedin || 'Not provided'}\nIndeed: ${d.indeed || 'Not provided'}`], ['DIRECT APPLICATION', d.apply || 'Not provided']].forEach(([heading, value]) => {
        if (y > 260) { doc.addPage(); y = 18; }
        addText(heading, 12, 6); addText(value, 10, 5); y += 4;
      });
      const safeName = d.title.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 50) || 'Application';
      doc.save(`JobSeek-Application-Pack-${safeName}.pdf`);
    } catch (error) {
      console.error(error);
      alert('PDF creation failed. Use Print / Save instead.');
    }
  }

  function wireNavigation() {
    const params = new URLSearchParams();
    Object.entries(job).forEach(([key, value]) => { if (value) params.set(key, value); });
    const assistant = $('assistant');
    const admin = $('admin');
    if (assistant) assistant.href = `application-assistant.html?${params.toString()}`;
    if (admin) admin.href = `application-admin.html?${new URLSearchParams({ title: job.title, company: job.company, jobId: job.id }).toString()}`;
    if ($('apply')) {
      $('apply').href = job.apply || '#';
      $('apply').setAttribute('aria-disabled', job.apply ? 'false' : 'true');
      if (!job.apply) $('apply').onclick = (e) => { e.preventDefault(); alert('The original application link is not available for this listing.'); };
    }
  }

  function loadSaved() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '{}');
      fields.forEach((id) => { if ($(id)) $(id).value = saved[id] || ''; });
    } catch (error) { console.warn('Saved application could not be loaded.', error); }
  }

  function init() {
    if (!$('jobTitle')) return;
    $('jobTitle').textContent = job.title;
    $('jobMeta').textContent = [job.company, job.location, job.posted ? `Posted ${job.posted}` : '', job.closing ? `Closes ${job.closing}` : '', job.source ? `Source ${job.source}` : ''].filter(Boolean).join(' · ');
    wireNavigation();
    loadSaved();
    fields.forEach((id) => $(id)?.addEventListener('input', score));
    $('save')?.addEventListener('click', save);
    $('pdf')?.addEventListener('click', downloadPDF);
    $('print')?.addEventListener('click', printPack);
    score();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', init) : init();
})();
