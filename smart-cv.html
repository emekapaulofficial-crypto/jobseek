<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>JobSeek | Smart CV</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#f8fafc;color:#0f172a;font-family:Arial,system-ui,sans-serif}
header{background:#fff;border-bottom:1px solid #e2e8f0;padding:18px 24px;position:sticky;top:0;z-index:5}
.brand{font-size:24px;font-weight:900}.blue{color:#2563eb}.wrap{max-width:1150px;margin:auto;padding:28px 18px}
h1{font-size:38px;margin:8px 0}.muted{color:#64748b}.grid{display:grid;grid-template-columns:2fr 1fr;gap:20px}.card{background:#fff;border:1px solid #e2e8f0;border-radius:20px;padding:20px;margin-bottom:20px;box-shadow:0 4px 15px #00000008}
.row{display:grid;grid-template-columns:1fr 1fr;gap:14px}.field{margin-bottom:14px}label{display:block;font-weight:700;font-size:14px;margin-bottom:6px}
input,textarea{width:100%;padding:13px;border:1px solid #cbd5e1;border-radius:12px;font:inherit}textarea{min-height:110px;resize:vertical}
button{border:0;border-radius:12px;padding:13px 17px;font-weight:800;cursor:pointer;margin:4px}button.primary{background:#2563eb;color:#fff}button.dark{background:#0f172a;color:#fff}button.outline{background:#fff;border:1px solid #cbd5e1}
.score{font-size:64px;font-weight:900;text-align:center;margin:15px}.gate{padding:14px;border-radius:12px;font-weight:800}.open{background:#dcfce7;color:#166534}.closed{background:#fee2e2;color:#991b1b}
pre{white-space:pre-wrap;background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:15px;min-height:250px}
.tabs button{border-radius:20px;background:#e2e8f0}.tabs button.active{background:#2563eb;color:#fff}
.small{font-size:13px}.error{background:#fee2e2;color:#991b1b;padding:14px;border-radius:12px}
@media(max-width:800px){.grid,.row{grid-template-columns:1fr}h1{font-size:30px}}
</style></head>
<body><header><div class="brand">Job<span class="blue">Seek</span> <span class="muted small">SMART CV ENGINE</span></div></header>
<div id="fatal" class="wrap" style="display:none"></div><main id="app" class="wrap">
<p class="blue"><b>JOBSEEK — FIND • APPLY • GROW</b></p><h1>Smart CV & Application Engine</h1>
<p class="muted">Score your CV, repair missing sections and generate your professional application pack. Information generated as a placeholder is marked with [brackets].</p>
<div class="grid"><section>
<div class="card"><div class="row"><div class="field"><label>Target Role</label><input id="role" placeholder="e.g. Product Manager"></div><div class="field"><label>Company</label><input id="company" placeholder="Employer name"></div></div>
<div class="field"><label>Employer Job Description / Vacancy Requirements <span style="color:#dc2626">*</span></label><textarea id="jobDescription" style="min-height:180px" placeholder="Paste the EXACT employer vacancy here. The engine will extract responsibilities, skills and keywords and tailor this application to THIS job."></textarea><p class="muted small">Each vacancy must have its own job description. The engine will not reuse the previous application's requirements.</p></div>
<div class="field"><label>Upload CV (PDF or TXT)</label><input id="file" type="file" accept=".pdf,.txt,application/pdf,text/plain"></div>
<div class="field"><label>CV Text</label><textarea id="cv" placeholder="Paste your CV here, or use the form below."></textarea></div>
<button class="primary" id="score">Score My CV</button><button class="dark" id="fix">Fix My CV — 1 Click</button><button class="outline" id="generate">Generate Application Pack</button>
<p id="status" class="muted small"></p></div>
<div class="card"><h2>Candidate details & gap filling</h2><div class="row">
<div class="field"><label>Full Name</label><input id="name"></div><div class="field"><label>Professional Email</label><input id="email"></div>
<div class="field"><label>Phone</label><input id="phone"></div><div class="field"><label>City, State</label><input id="location"></div>
<div class="field"><label>Professional Title</label><input id="title"></div><div class="field"><label>Certifications</label><input id="certifications"></div>
</div>
<div class="field"><label>Professional Summary</label><textarea id="summary"></textarea></div>
<div class="field"><label>Core Skills</label><textarea id="skills"></textarea></div>
<div class="field"><label>Work Experience</label><textarea id="experience"></textarea></div>
<div class="field"><label>Education</label><textarea id="education"></textarea></div></div>
<div class="card"><h2>Generated documents</h2><div class="tabs"><button data-tab="cv">CV</button><button data-tab="cover">Cover Letter</button><button data-tab="email">Application Email</button><button data-tab="linkedin">LinkedIn Summary</button></div><pre id="document">Generate the application pack after your CV reaches Average or Strong.</pre></div>
</section>
<aside><div class="card"><h3>ATS SCORE</h3><div id="scoreValue" class="score">—</div><div id="gate" class="gate closed">CV not scored yet</div><h3>Feedback</h3><div id="feedback" class="small"></div></div>
<div class="card"><h3>Engine rules locked</h3><p class="muted small">JobSeek Smart CV Engine v3 is the vacancy-tailoring and scoring engine. Guessed information is marked with [brackets].</p><ul class="small"><li>80–100 Strong</li><li>50–79 Average</li><li>0–49 Weak / application blocked</li></ul></div></aside></div></main>
<script src="smart-cv-engine.js"></script>
<script>
(function(){
'use strict';
function $(id){return document.getElementById(id)}
function val(id){return $(id).value||''}
var result=null,docs=null,tab='cv';
function form(){return {jobDescription:val('jobDescription'),name:val('name'),email:val('email'),phone:val('phone'),location:val('location'),title:val('title'),summary:val('summary'),skills:val('skills'),experience:val('experience'),education:val('education'),certifications:val('certifications')}}
function setForm(x){['name','email','phone','location','title','summary','experience','education','certifications'].forEach(function(k){if(x[k]!==undefined)$(k).value=x[k]||''});if(x.skills)$( 'skills').value=Array.isArray(x.skills)?x.skills.join(', '):x.skills}
function fullText(){var f=form();return [f.name,f.email,f.phone,f.location,'Target Role: '+val('role'),'Professional Summary',f.summary,'Core Skills',f.skills,'Professional Experience',f.experience,'Education',f.education,'Certifications',f.certifications].filter(Boolean).join('\n')}
function render(){if(!result)return; $('scoreValue').textContent=result.score+' '+result.level;$('gate').textContent=result.applicationEligible?'✓ APPLICATION GATE: OPEN':'✕ CV GATE: REJECTED — FIX CV FIRST';$('gate').className='gate '+(result.applicationEligible?'open':'closed');$('feedback').innerHTML=result.feedback.map(function(x){return '<p>❌ '+esc(x)+'</p>'}).join('')+result.positives.map(function(x){return '<p style="color:#15803d">✅ '+esc(x)+'</p>'}).join('');if(docs) $('document').textContent=docs[tab]||''}
function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
$('score').onclick=function(){try{var text=val('cv').trim()||fullText();if(!val('jobDescription').trim()){ $('status').textContent='Paste the exact employer job description before scoring.';return }var base=JobSeekSmartCV.scoreCV(text,val('role'),val('jobDescription'));var f=form(),fb=base.feedback.slice(),score=base.score;[['name','Full Name'],['email','Professional Email'],['phone','Phone'],['location','Location'],['role','Target Role'],['summary','Professional Summary'],['skills','Core Skills'],['experience','Professional Experience'],['education','Education']].forEach(function(a){if(!val(a[0])){score-=3;fb.push('Missing '+a[1]+'.')}});score=Math.max(0,Math.min(100,score));result=Object.assign({},base,{score:score,level:score>=80?'STRONG':score>=50?'AVERAGE':'WEAK',feedback:Array.from(new Set(fb)),applicationEligible:score>=50});$('status').textContent='CV scored successfully.';render()}catch(e){$('status').textContent='CV scoring error: '+e.message}}
$('fix').onclick=function(){try{if(!val('jobDescription').trim()){$('status').textContent='Paste the exact employer job description before tailoring the CV.';return}var filled=JobSeekSmartCV.smartFill(Object.assign(form(),{targetRole:val('role'),jobDescription:val('jobDescription')}));setForm({summary:filled.summary,skills:filled.skills,experience:filled.experience,education:filled.education});$('cv').value=filled.cv;result=JobSeekSmartCV.scoreCV(filled.cv,val('role'),val('jobDescription'));$('status').textContent='Missing sections filled. Review all [bracketed] placeholders before applying.';render()}catch(e){$('status').textContent='CV repair error: '+e.message}}
$('generate').onclick=function(){try{if(!result||!result.applicationEligible){$('status').textContent='Fix and score the CV until the application gate is open.';return}var f=form();if(!val('jobDescription').trim()){$('status').textContent='Paste the exact employer job description before generating an application.';return}var filled=JobSeekSmartCV.smartFill(Object.assign(f,{targetRole:val('role'),jobDescription:val('jobDescription')})),data=Object.assign({},f,{role:filled.targetRole||val('role')||f.title,company:val('company'),hiringManager:'[Hiring Manager]',skills:filled.skills,experience:filled.experience,jobDescription:val('jobDescription'),jobRequirements:filled.jobRequirements.keywords,matchedKeywords:(result&&result.matchedKeywords)||[]});docs={cv:filled.cv,cover:JobSeekSmartCV.coverLetter(data),email:JobSeekSmartCV.applicationEmail(data),linkedin:JobSeekSmartCV.linkedin(data)};setForm({summary:filled.summary,skills:filled.skills,experience:filled.experience,education:filled.education});$('cv').value=filled.cv;$('status').textContent='Application pack generated.';render()}catch(e){$('status').textContent='Generation error: '+e.message}}
Array.prototype.forEach.call(document.querySelectorAll('[data-tab]'),function(b){b.onclick=function(){tab=b.getAttribute('data-tab');document.querySelectorAll('[data-tab]').forEach(function(x){x.classList.remove('active')});b.classList.add('active');render()}})
$('file').onchange=async function(e){var file=e.target.files&&e.target.files[0];if(!file)return;try{if(file.name.toLowerCase().endsWith('.txt')){$('cv').value=await file.text();$('status').textContent='TXT CV loaded. Click Score My CV.'}else if(file.type==='application/pdf'||file.name.toLowerCase().endsWith('.pdf')){$('status').textContent='Reading PDF…';var p=await import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.5.136/pdf.min.mjs'),pdf=await p.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise,out='';for(var i=1;i<=pdf.numPages;i++){var page=await pdf.getPage(i),ct=await page.getTextContent();out+=ct.items.map(function(x){return x.str}).join(' ')+'\n'}$('cv').value=out;$('status').textContent='PDF CV loaded. Click Score My CV.'}else $('status').textContent='Please use PDF or TXT.'}catch(e){$('status').textContent='Could not read CV: '+e.message}}
})();
</script></body></html>