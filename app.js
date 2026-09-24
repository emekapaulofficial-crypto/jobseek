const menu=document.getElementById('menu'),nav=document.getElementById('nav');
function closeNav(){nav?.classList.remove('open');menu?.setAttribute('aria-expanded','false')}
menu?.addEventListener('click',()=>{const open=nav?.classList.toggle('open');menu?.setAttribute('aria-expanded',open?'true':'false')});
nav?.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeNav));
document.addEventListener('click',e=>{if(nav?.classList.contains('open')&&!nav.contains(e.target)&&e.target!==menu)closeNav()});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNav()});
if(nav){const current=(location.pathname.split('/').pop()||'index.html').toLowerCase();nav.querySelectorAll('a[href]').forEach(a=>{try{const target=new URL(a.href,location.href).pathname.split('/').pop().toLowerCase();if(target===current)a.setAttribute('aria-current','page')}catch{}})}
const q=document.getElementById('q'),loc=document.getElementById('loc'),grid=document.getElementById('jobGrid'),none=document.getElementById('none');
function filterJobs(){if(!grid)return;const a=(q?.value||'').toLowerCase().trim(),b=(loc?.value||'').toLowerCase().trim();let shown=0;grid.querySelectorAll('.job').forEach(card=>{const ok=(!a||card.dataset.title.includes(a))&&(!b||card.dataset.location.includes(b));card.style.display=ok?'block':'none';if(ok)shown++});none?.classList.toggle('hidden',shown!==0)}
document.getElementById('searchBtn')?.addEventListener('click',()=>{filterJobs();document.getElementById('jobs')?.scrollIntoView({behavior:'smooth'})});
[q,loc].forEach(x=>x?.addEventListener('keydown',e=>{if(e.key==='Enter')filterJobs()}));
