/* JobSeek global navigation + small shared UI helpers */
(function(){
  const path=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const adminPages=['admin-candidates.html','admin-documents.html','admin-services.html','employer-portal.html'];
  const isAdmin=adminPages.includes(path);
  const isAuth=path==='auth.html';

  function esc(s){return String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  function buildHeader(){
    if(path==='admin-dashboard.html') return; // dashboard has its own protected shell

    let header=document.querySelector('header');
    if(!header){
      header=document.createElement('header');
      document.body.insertBefore(header,document.body.firstChild);
    }
    let wrap=header.querySelector('.nav');
    if(!wrap){
      wrap=document.createElement('div');
      wrap.className='container nav';
      header.innerHTML='';
      header.appendChild(wrap);
    }

    let brand=wrap.querySelector('.brand');
    if(!brand){
      brand=document.createElement('a');
      brand.className='brand';
      brand.href='index.html';
      brand.innerHTML='<span class="logo">J</span><b>Job<span>Seek</span></b>';
      wrap.prepend(brand);
    }

    let menu=wrap.querySelector('#menu');
    if(!menu){
      menu=document.createElement('button');
      menu.id='menu';
      menu.type='button';
      menu.setAttribute('aria-label','Open navigation');
      menu.setAttribute('aria-expanded','false');
      menu.textContent='☰';
      wrap.appendChild(menu);
    }

    let nav=wrap.querySelector('#nav');
    if(!nav){
      nav=document.createElement('nav');
      nav.id='nav';
      wrap.appendChild(nav);
    }

    const adminLinks=[
      ['admin-dashboard.html','Overview','🏠'],
      ['admin-candidates.html','Candidates','👥'],
      ['admin-documents.html','Documents','📄'],
      ['admin-services.html','Revenue','💳'],
      ['jobs.html','Public Jobs','🔎'],
      ['index.html','Website','🌐']
    ];
    const publicLinks=[
      ['jobs.html','Find Jobs','🔎'],
      ['candidate-dashboard.html','Dashboard','📊'],
      ['jobs.html?category=Construction','Construction','🏗️'],
      ['job-matches.html','My Matches','🎯'],
      ['ats-cv-builder.html','CV Builder','📄'],
      ['application-assistant.html','Application Assistant','📝'],
      ['job-alerts.html','Job Alerts','🔔'],
      ['employer.html','For Employers','🏢'],
      ['pricing.html','Plans','⭐']
    ];
    const authLinks=[['jobs.html','Browse Jobs','🔎'],['pricing.html','Plans','⭐'],['auth.html','Sign in','→']];
    const links=isAdmin?adminLinks:(isAuth?authLinks:publicLinks);

    nav.className='site-nav'+(isAdmin?' admin-site-nav':'');
    nav.innerHTML=links.map(([href,label,icon])=>'<a href="'+href+'" data-nav-link="'+href.split('?')[0]+'"><span class="nav-icon" aria-hidden="true">'+icon+'</span><span>'+label+'</span></a>').join('');

    const current=path;
    nav.querySelectorAll('a[data-nav-link]').forEach(a=>{
      const target=(a.dataset.navLink||'').toLowerCase();
      if(target===current || (current==='index.html' && target==='index.html')) a.setAttribute('aria-current','page');
    });

    if(isAdmin){
      const dash=nav.querySelector('a[href="admin-dashboard.html"]');
      if(dash && path==='admin-dashboard.html') dash.setAttribute('aria-current','page');
    }

    menu.setAttribute('aria-controls','nav');
    menu.onclick=()=>toggleNav();
    nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeNav));
    document.addEventListener('click',outsideNav,{once:true});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNav()},{once:true});
  }

  function toggleNav(){
    const nav=document.getElementById('nav'),menu=document.getElementById('menu');
    if(!nav||!menu)return;
    const open=nav.classList.toggle('open');
    menu.setAttribute('aria-expanded',open?'true':'false');
    menu.textContent=open?'✕':'☰';
  }
  function closeNav(){
    const nav=document.getElementById('nav'),menu=document.getElementById('menu');
    nav?.classList.remove('open');
    menu?.setAttribute('aria-expanded','false');
    if(menu)menu.textContent='☰';
  }
  function outsideNav(e){
    const nav=document.getElementById('nav'),menu=document.getElementById('menu');
    if(nav?.classList.contains('open')&&!nav.contains(e.target)&&e.target!==menu)closeNav();
    if(nav?.classList.contains('open'))document.addEventListener('click',outsideNav,{once:true});
  }

  function legacySearch(){
    const q=document.getElementById('q'),loc=document.getElementById('loc'),grid=document.getElementById('jobGrid'),none=document.getElementById('none');
    function filterJobs(){
      if(!grid)return;
      const a=(q?.value||'').toLowerCase().trim(),b=(loc?.value||'').toLowerCase().trim();
      let shown=0;
      grid.querySelectorAll('.job').forEach(card=>{
        const ok=(!a||String(card.dataset.title||'').includes(a))&&(!b||String(card.dataset.location||'').includes(b));
        card.style.display=ok?'block':'none'; if(ok)shown++;
      });
      none?.classList.toggle('hidden',shown!==0);
    }
    document.getElementById('searchBtn')?.addEventListener('click',()=>{
      if(document.getElementById('q')&&document.getElementById('loc')&&location.pathname.endsWith('index.html')){
        const keyword=document.getElementById('q').value.trim(),region=document.getElementById('loc').value.trim();
        if(document.getElementById('latestJobs')) location.href='jobs.html?keyword='+encodeURIComponent(keyword)+'&region='+encodeURIComponent(region);
        else {filterJobs();document.getElementById('jobs')?.scrollIntoView({behavior:'smooth'});}
      }
    });
    [q,loc].forEach(x=>x?.addEventListener('keydown',e=>{if(e.key==='Enter')filterJobs()}));
  }

  function init(){
    buildHeader();
    legacySearch();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();