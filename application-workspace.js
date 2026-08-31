const q=new URLSearchParams(location.search);
const $=id=>document.getElementById(id);
const title=q.get('title')||'Selected job';
const company=q.get('company')||'';
const loc=q.get('location')||'';
const apply=q.get('apply')||'#';
const posted=q.get('posted')||'';
const closing=q.get('closing')||'';
$('jobTitle').textContent=title;
$('jobMeta').textContent=[company,loc,posted?`Posted ${posted}`:'',closing?`Closes ${closing}`:''].filter(Boolean).join(' · ');
$('apply').href=apply;
const key='jobseek_app_'+btoa(unescape(encodeURIComponent([title,company,loc].join('|')))).slice(0,80);
let old={};try{old=JSON.parse(localStorage.getItem(key)||'{}')}catch(e){}
['cv','cover','portfolio','linkedin','indeed'].forEach(id=>$(id).value=old[id]||'');
function score(){
 let s=0;
 if($('cv').value.trim())s+=30;
 if($('cover').value.trim())s+=25;
 if($('portfolio').value.trim())s+=20;
 if($('linkedin').value.trim())s+=10;
 if($('indeed').value.trim())s+=5;
 s+=10;
 $('score').textContent=s+'%';
 $('checks').innerHTML=[['cv','CV'],['cover','Cover letter'],['portfolio','Portfolio link'],['linkedin','LinkedIn'],['indeed','Indeed']].map(([id,label])=>`<p>${$(id).value.trim()?'✅':'⚠️'} ${label} ${$(id).value.trim()?'ready':'needs attention'}</p>`).join('');
 renderPack();
}
function data(){return {title,company,loc,posted,closing,apply,cv:$('cv').value.trim(),cover:$('cover').value.trim(),portfolio:$('portfolio').value.trim(),linkedin:$('linkedin').value.trim(),indeed:$('indeed').value.trim(),score:$('score').textContent};}
function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderPack(){const d=data();$('packContent').innerHTML=`<h3>${esc(d.title)}</h3><p>${esc(d.company)}${d.loc?' · '+esc(d.loc):''}</p><p><strong>Application Readiness:</strong> ${esc(d.score)}</p><hr><h3>CV</h3><div style="white-space:pre-wrap">${esc(d.cv)||'Not provided'}</div><h3>Cover Letter</h3><div style="white-space:pre-wrap">${esc(d.cover)||'Not provided'}</div><h3>Professional Links</h3><p>Portfolio: ${d.portfolio?`<a href="${esc(d.portfolio)}">${esc(d.portfolio)}</a>`:'Not provided'}</p><p>LinkedIn: ${d.linkedin?`<a href="${esc(d.linkedin)}">${esc(d.linkedin)}</a>`:'Not provided'}</p><p>Indeed: ${d.indeed?`<a href="${esc(d.indeed)}">${esc(d.indeed)}</a>`:'Not provided'}</p><h3>Vacancy</h3><p>Posted: ${esc(d.posted)||'Not specified'}<br>Closing: ${esc(d.closing)||'Not specified'}<br>Original/application link: <a href="${esc(d.apply)}">${esc(d.apply)}</a></p>`}
['cv','cover','portfolio','linkedin','indeed'].forEach(id=>$(id).addEventListener('input',score));
$('save').onclick=()=>{const d=data();localStorage.setItem(key,JSON.stringify(d));score();alert('Application saved.');};
$('print').onclick=()=>{renderPack();window.print();};
$('pdf').onclick=()=>downloadPDF(data());
function wrap(doc,text,x,y,maxWidth,lineHeight){const lines=doc.splitTextToSize(String(text||''),maxWidth);for(const line of lines){if(y>275){doc.addPage();y=18;}doc.text(line,x,y);y+=lineHeight;}return y;}
function downloadPDF(d){
 if(!window.jspdf){window.print();return;}
 const {jsPDF}=window.jspdf;const doc=new jsPDF({unit:'mm',format:'a4'});let y=18;
 doc.setFontSize(20);doc.text('JOBSEEK PROFESSIONAL APPLICATION PACK',15,y);y+=10;
 doc.setFontSize(14);doc.text(d.title,15,y);y+=7;doc.setFontSize(10);
 y=wrap(doc,`${d.company} | ${d.loc}`,15,y,180,5);y+=2;
 y=wrap(doc,`Application Readiness: ${d.score}`,15,y,180,5);y+=4;
 y=wrap(doc,`Posted: ${d.posted||'Not specified'} | Closing: ${d.closing||'Not specified'}`,15,y,180,5);y+=5;
 for(const [heading,value] of [['TAILORED CV',d.cv],['COVER LETTER',d.cover],['PROFESSIONAL LINKS',`Portfolio: ${d.portfolio||'Not provided'}\nLinkedIn: ${d.linkedin||'Not provided'}\nIndeed: ${d.indeed||'Not provided'}`],['DIRECT APPLICATION',d.apply||'Not provided']]){
  if(y>265){doc.addPage();y=18;}doc.setFontSize(13);doc.text(heading,15,y);y+=7;doc.setFontSize(10);y=wrap(doc,value||'Not provided',15,y,180,5);y+=6;
 }
 doc.save(`JobSeek-Application-Pack-${d.title.replace(/[^a-z0-9]+/gi,'-').slice(0,50)}.pdf`);
}
score();