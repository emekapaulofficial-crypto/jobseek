/* JobSeek global navigation + shared UI */
(function(){
const path=(location.pathname.split('/').pop()||'index.html').toLowerCase(),adminPages=['admin-candidates.html','admin-documents.html','admin-services.html'],isAdmin=adminPages.includes(path),isAuth=path==='auth.html';
function buildHeader(){
 if(path==='admin-dashboard.html')return;
 let h=document.querySelector('header');if(!h){h=document.createElement('header');document.body.prepend(h)}
 let w=h.querySelector('.nav');if(!w){w=document.createElement('div');w.className='container nav';h.innerHTML='';h.appendChild(w)}
 let b=w.querySelector('.brand');if(!b){b=document.createElement('a');b.className='brand';b.href='index.html';b.innerHTML='<span class="logo">J</span><b>Job<span>Seek</span></b>';w.prepend(b)}
 let m=w.querySelector('#menu');if(!m){m=document.createElement('button');m.id='menu';m.type='button';m.setAttribute('aria-label','Open navigation');m.setAttribute('aria-expanded','false');m.textContent='☰';w.appendChild(m)}
 let n=w.querySelector('#nav')||w.querySelector('nav');if(!n){n=document.createElement('nav');n.id='nav';w.appendChild(n)}
 const admin=[['admin-dashboard.html','Overview','🏠'],['admin-candidates.html','Candidates','👥'],['admin-documents.html','Documents','📄'],['admin-services.html','Revenue','💳'],['jobs.html','Public Jobs','🔎'],['index.html','Website','🌐']];
 const pub=[['index.html','Home','⌂'],['jobs.html','Jobs','⌕'],['ats-cv-builder.html','CV & Application Tools','✦'],['pricing.html','Pricing','◈'],['employer.html','For Employers','▣']];
 const auth=[['jobs.html','Browse Jobs','🔎'],['pricing.html','Plans','⭐'],['auth.html','Sign in','→']],links=isAdmin?admin:(isAuth?auth:pub);
 n.className='site-nav'+(isAdmin?' admin-site-nav':'');n.innerHTML=links.map(x=>'<a href="'+x[0]+'" data-nav-link="'+x[0].split('?')[0]+'"><span class="nav-icon" aria-hidden="true">'+x[2]+'</span><span>'+x[1]+'</span></a>').join('');
 if(!isAdmin){let a=w.querySelector('.nav-actions');if(!a){a=document.createElement('div');a.className='nav-actions';w.appendChild(a)}if(!isAuth)a.innerHTML='<a class="nav-login" href="auth.html">Log In</a><a class="nav-signup" href="auth.html?mode=signup">Sign Up</a>';
    else a.innerHTML=''}
 n.querySelectorAll('a[data-nav-link]').forEach(a=>{if((a.dataset.navLink||'').toLowerCase()===path)a.setAttribute('aria-current','page')});
 m.onclick=()=>{const o=n.classList.toggle('open');m.setAttribute('aria-expanded',o?'true':'false');m.textContent=o?'✕':'☰'};
 n.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{n.classList.remove('open');m.setAttribute('aria-expanded','false');m.textContent='☰'}));
}
function loadScript(src){return new Promise((resolve,reject)=>{const existing=[...document.scripts].find(s=>s.src&&s.src.includes(src));if(existing){if(src.includes('supabase-js')&&window.supabase)return resolve();if(src.includes('supabase-client')&&window.JobSeekSupabase)return resolve();existing.addEventListener('load',resolve,{once:true});existing.addEventListener('error',reject,{once:true});return}const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s)})}
async function ensureAuthClient(){
  if(window.supabase?.createClient&&window.JobSeekSupabase?.configured)return true;
  try{
    if(!window.supabase?.createClient)await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
    if(!window.JobSeekSupabase?.configured)await loadScript('supabase-client.js');
    return Boolean(window.supabase?.createClient&&window.JobSeekSupabase?.configured);
  }catch(_){return false}
}
function legacySearch(){const q=document.getElementById('q'),loc=document.getElementById('loc');document.getElementById('searchBtn')?.addEventListener('click',()=>{if(q&&loc)location.href='jobs.html?keyword='+encodeURIComponent(q.value.trim())+'&region='+encodeURIComponent(loc.value.trim())});[q,loc].forEach(x=>x?.addEventListener('keydown',e=>{if(e.key==='Enter')document.getElementById('searchBtn')?.click()}))}
async function syncAuthNavigation(){
  const actions=document.querySelector('.nav-actions');
  if(actions){actions.style.visibility='hidden';}
  const ready=await ensureAuthClient();
  if(!ready){if(actions)actions.style.visibility='visible';return;}
  try{
    const client=window.supabase.createClient(window.JobSeekSupabase.url,window.JobSeekSupabase.key);
    const session=await client.auth.getSession();
    const current=session?.data?.session?.user;
    if(!current){
      if(actions){actions.innerHTML='<a class="nav-login" href="auth.html">Log In</a><a class="nav-signup" href="auth.html?mode=signup">Sign Up</a>';actions.style.visibility='visible';}
      return;
    }
    let role='candidate',fullName=current.user_metadata?.full_name||current.email||'Account';
    try{
      const account=await client.from('jobseek_accounts').select('role,full_name').eq('id',current.id).maybeSingle();
      if(account?.data?.role)role=account.data.role;
      if(account?.data?.full_name)fullName=account.data.full_name;
    }catch(_){}
    const nav=document.getElementById('nav');
    if(nav){
      nav.querySelectorAll('a[data-nav-link="auth.html"]').forEach(a=>a.remove());
      const dashboard=role==='admin'||role==='agent'?'admin-dashboard.html':role==='employer'?'employer-portal.html':'candidate-dashboard.html';
      const label=role==='admin'||role==='agent'?'Admin Dashboard':role==='employer'?'Employer Dashboard':'My Dashboard';
      nav.innerHTML+='<a href="'+dashboard+'" data-auth-dashboard="true"><span class="nav-icon">◈</span><span>'+label+'</span></a>';
      nav.querySelectorAll('a[data-nav-link="auth.html"]').forEach(a=>a.remove());
    }
    const actionsBox=document.querySelector('.nav-actions');
    if(actionsBox){
      const actions=actionsBox;
      actions.querySelectorAll('.nav-login,.nav-signup').forEach(el=>el.remove());
      actions.innerHTML='<span class="nav-account" title="'+String(fullName).replace(/"/g,'&quot;')+'">Hi, '+String(fullName).split(' ')[0]+'</span><button type="button" class="nav-logout" id="globalLogout">Log out</button>';
      actions.style.visibility='visible';
      document.getElementById('globalLogout')?.addEventListener('click',async()=>{
        await client.auth.signOut();
        location.href='index.html';
      });
    }
    // Candidate dashboard has its own account header/logout control.
    if(isAuth){
      const target=role==='admin'||role==='agent'?'index.html':role==='employer'?'employer-portal.html':'candidate-dashboard.html';
      if(location.pathname.split('/').pop().toLowerCase()==='auth.html')location.replace(target);
      return;
    }
    const localLogout=document.getElementById('logout');
    if(localLogout){
      localLogout.style.display='inline-flex';
      localLogout.type='button';
      localLogout.textContent='Log out';
      localLogout.onclick=async()=>{await client.auth.signOut();location.href='index.html'};
    }
  }catch(err){if(actions)actions.style.visibility='visible';/* Keep public navigation usable if auth lookup fails. */}
}
function init(){buildHeader();legacySearch();initMobileJobsFilters();syncAuthNavigation()}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
function initMobileJobsFilters(){
 const filter=document.querySelector('.reference-filter');
 if(!filter||!document.querySelector('.jobs-page'))return;
 const toggle=document.createElement('button');
 toggle.type='button';
 toggle.className='mobile-filter-toggle';
 toggle.setAttribute('aria-expanded','false');
 toggle.setAttribute('aria-controls','jobseek-mobile-filters');
 toggle.innerHTML='<span>⚙ Filters</span><small>Open filters</small>';
 filter.id='jobseek-mobile-filters';
 filter.parentNode.insertBefore(toggle,filter);
 const setOpen=open=>{
   filter.classList.toggle('mobile-open',open);
   toggle.setAttribute('aria-expanded',String(open));
   toggle.innerHTML=open?'<span>✕ Filters</span><small>Close filters</small>':'<span>⚙ Filters</span><small>Open filters</small>';
 };
 toggle.addEventListener('click',()=>setOpen(!filter.classList.contains('mobile-open')));
 filter.querySelector('#filter')?.addEventListener('click',()=>setOpen(false),true);
 filter.querySelector('#clearFilters')?.addEventListener('click',()=>setOpen(false),true);
}
