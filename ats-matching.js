/* JobSeek ATS Evidence Engine
   Extracts the vacancy's highest-value requirements and maps them to genuine candidate evidence.
   Loaded after application-assistant.html so it can enhance the existing generator without replacing its UI.
*/
(function(){
  const originalAnalyse = window.analyseData;
  const originalGenerate = window.generate;
  const originalUpdateScore = window.updateScore;

  const reqStop = new Set([
    'the','and','for','with','from','that','this','you','your','our','are','will','have','has','not','all','who','but','into','about','their','they','years','year','work','team','company','position','required','requirements','preferred','ability','able','using','use','must','may','can','should','what','where','which','while','its','as','an','to','of','in','on','at','be','is','was','were','been','being','a','or','by','we','he','she','it','these','those','them','provide','provides','including','includes','candidate','candidates','opportunity','employer','successful','applicants','application','responsibilities','responsibility'
  ]);

  const synonyms = {
    picking:['pick','harvest','harvesting','fruit','produce'],
    harvesting:['harvest','harvesting','picking','crop','fruit'],
    field:['farm','field','agriculture','agricultural'],
    agriculture:['agriculture','agricultural','farm','farming','crop'],
    cleaning:['clean','cleaning','housekeeping','janitorial'],
    maintenance:['maintain','maintenance','repair','repairs','servicing'],
    electrical:['electric','electrical','electrician','wiring','installation'],
    welding:['weld','welding','welder','fabrication','fabricator'],
    construction:['construction','site','building','civil'],
    driving:['driver','driving','delivery','transport'],
    safety:['safe','safety','ppe','hazard'],
    teamwork:['team','teamwork','collaborate','collaboration'],
    communication:['communicate','communication','customer','clients'],
    equipment:['equipment','machinery','machine','tools'],
    livestock:['livestock','cattle','poultry','animals','dairy'],
    packing:['pack','packing','packaging','warehouse']
  };

  function textTokens(text){
    return [...new Set(String(text||'').toLowerCase().replace(/[^a-z0-9+#.-]+/g,' ').split(/\s+/).filter(Boolean).filter(w=>w.length>2&&!reqStop.has(w)))];
  }
  function sentenceList(text){
    return String(text||'').replace(/\r/g,'').split(/(?<=[.!?])\s+|\n+/).map(s=>s.replace(/^[•*-]\s*/,'').trim()).filter(s=>s.length>18);
  }
  function overlap(a,b){
    const A=textTokens(a), B=new Set(textTokens(b));
    let score=0;
    A.forEach(w=>{ if(B.has(w)) score++; });
    Object.keys(synonyms).forEach(k=>{
      const group=synonyms[k];
      if(A.some(w=>group.includes(w)) && group.some(w=>B.has(w))) score+=1;
    });
    return score;
  }
  function classify(s){
    const x=s.toLowerCase();
    if(/degree|diploma|certificate|certification|licen[cs]e|qualification/.test(x)) return 'Qualification';
    if(/\byears?\b|experience|background|worked|employment/.test(x)) return 'Experience';
    if(/language|english|french|german|spanish/.test(x)) return 'Language';
    if(/safe|safety|ppe|osha|hazard/.test(x)) return 'Safety';
    if(/skill|knowledge|proficien|ability|able to/.test(x)) return 'Skill';
    if(/responsib|duties|assist|operate|maintain|install|repair|pick|harvest|clean|drive|pack|load|inspect|prepare|serve/.test(x)) return 'Responsibility';
    return 'Job priority';
  }
  function extractRequirements(){
    const description=String(window.job?.description||'');
    const title=String(window.job?.title||'');
    const sentences=sentenceList(description);
    const explicit=[];
    sentences.forEach(s=>{
      const x=s.toLowerCase();
      if(/required|must|essential|minimum|preferred|qualif|responsib|duties|experience|skills?|ability|knowledge|certif|license|licence|degree|diploma|language/.test(x)) explicit.push(s);
    });
    const pool=[...new Set([...explicit,...sentences])];
    const roleWords=textTokens(title);
    const scored=pool.map(s=>{
      let score=overlap(title,s)*2;
      const x=s.toLowerCase();
      if(/required|must|essential|minimum/.test(x)) score+=8;
      if(/preferred|desired/.test(x)) score+=4;
      if(/responsib|duties/.test(x)) score+=5;
      if(/skill|experience|qualif|certif|license|licence|degree|diploma/.test(x)) score+=5;
      if(textTokens(s).some(w=>roleWords.includes(w))) score+=3;
      return {text:s,score,type:classify(s)};
    }).sort((a,b)=>b.score-a.score);
    const unique=[]; const seen=new Set();
    scored.forEach(r=>{ const key=textTokens(r.text).slice(0,9).join(' '); if(!seen.has(key)){seen.add(key);unique.push(r);} });
    return unique.slice(0,18).map((r,i)=>({...r,rank:i+1}));
  }
  function candidateSources(){
    return [
      {name:'Skills',text:window.v('skills')},
      {name:'Experience',text:window.v('experience')},
      {name:'Education / Certifications',text:window.v('education')},
      {name:'Projects / Achievements',text:window.v('projects')},
      {name:'Summary',text:window.v('summary')},
      {name:'Languages',text:window.v('languages')}
    ].filter(x=>x.text);
  }
  function mapEvidence(requirements){
    const sources=candidateSources();
    return requirements.map(r=>{
      const ranked=sources.map(s=>({source:s.name,text:s.text,score:overlap(r.text,s.text)})).sort((a,b)=>b.score-a.score);
      const best=ranked[0];
      return {...r,evidence:best&&best.score>0?best:null,confidence:best&&best.score>0?Math.min(100,45+best.score*18):0};
    });
  }
  function enhancedAnalyse(){
    const base=originalAnalyse ? originalAnalyse() : {terms:[],matches:[],missing:[],required:[],roleTerms:[]};
    const requirements=mapEvidence(extractRequirements());
    const supported=requirements.filter(r=>r.evidence).length;
    const critical=requirements.filter(r=>/Qualification|Experience|Safety|Responsibility|Skill/.test(r.type)).length;
    return {...base,requirements,supportedRequirements:supported,criticalRequirements:critical};
  }
  window.jobseekRequirementMap = enhancedAnalyse;
  window.analyseData = enhancedAnalyse;

  function renderEvidenceMap(){
    const a=enhancedAnalyse();
    let box=document.getElementById('evidenceMap');
    if(!box){
      box=document.createElement('div'); box.id='evidenceMap'; box.className='notice';
      const analysis=document.getElementById('analysis');
      if(analysis) analysis.appendChild(box);
    }
    const rows=a.requirements.map(r=>{
      const status=r.evidence?'✓ Supported by your information':'⚠ Evidence not found';
      const detail=r.evidence ? (r.evidence.source+': '+r.evidence.text.replace(/\s+/g,' ').slice(0,180)) : 'Add genuine evidence only if you have it.';
      return '<div style="padding:10px 0;border-top:1px solid rgba(157,176,200,.18)"><b>#'+r.rank+' '+window.esc(r.type)+'</b> <span class="'+(r.evidence?'good':'warn')+'">'+status+'</span><br><span>'+window.esc(r.text.slice(0,260))+'</span><br><small class="muted">'+window.esc(detail)+'</small></div>';
    }).join('');
    box.innerHTML='<h3 style="margin-top:0">Top vacancy requirements → your evidence</h3><p class="small muted">JobSeek prioritises the requirements most likely to matter to the employer, then checks whether your own information supports each one. Unsupported requirements are never invented.</p>'+rows;
    return a;
  }

  const oldRenderAnalysis=window.renderAnalysis;
  window.renderAnalysis=function(){
    const result=oldRenderAnalysis ? oldRenderAnalysis() : null;
    renderEvidenceMap();
    return enhancedAnalyse();
  };

  function humanHook(a){
    const matched=a.requirements.filter(r=>r.evidence).slice(0,3);
    if(!matched.length) return 'This application is focused on the candidate’s genuine skills and readiness for the role.';
    const phrases=matched.map(r=>r.type.toLowerCase()+': '+r.text.replace(/^[^:]*:\s*/,'').replace(/[.!?]+$/,'').slice(0,95));
    return 'The strongest parts of this application are the candidate’s direct evidence for '+phrases.join('; ')+'.';
  }
  function improveOutput(){
    const a=renderEvidenceMap();
    const country=window.countryRules?.[window.detectCountry?.()||'OTHER'];
    const target=window.v('target')||window.titleCase(window.job.title);
    const matched=a.requirements.filter(r=>r.evidence).slice(0,4);
    const evidence=matched.map(r=>r.evidence.text.replace(/\s+/g,' ').trim()).filter(Boolean);
    const cv=document.getElementById('cv'), cover=document.getElementById('cover'), li=document.getElementById('linkedIn'), indeed=document.getElementById('indeedOut');
    if(cv && cv.textContent){
      const parts=cv.textContent.split(/\n\n/);
      const idx=parts.findIndex(p=>p.trim()==='PROFESSIONAL SUMMARY');
      const next=parts.findIndex((p,i)=>i>idx && p.trim()==='CORE SKILLS');
      if(idx>=0&&next>idx){
        const summary=window.v('summary') || ('Targeting the '+target+' role with practical strengths that directly match the vacancy. '+humanHook(a)+' The application focuses on clear, genuine evidence rather than generic claims.');
        parts.splice(idx+1,next-idx-1,summary);
        cv.textContent=parts.join('\n\n');
      }
      if(matched.length){
        const marker='SELECTED ROLE EVIDENCE';
        if(!cv.textContent.includes(marker)) cv.textContent += '\n\n'+marker+'\n'+matched.map(r=>'• '+r.text.replace(/\s+/g,' ').trim()+' — Evidence: '+r.evidence.source).join('\n');
      }
    }
    if(cover && cover.textContent){
      const body=cover.textContent.split('\n\n');
      if(body.length>1){
        const intro='I am applying for the '+window.job.title+(window.job.company?' with '+window.job.company:'')+' because my background includes skills that directly relate to what this position requires. '+(evidence.length?'In particular, my experience includes '+evidence.slice(0,2).join('; ')+'.':'I am ready to learn the employer’s procedures and demonstrate my ability through the work itself.');
        body[1]=intro; cover.textContent=body.join('\n\n');
      }
    }
    if(li && li.textContent){
      const chunks=li.textContent.split('\n\n');
      const about=chunks.findIndex(x=>x.trim()==='ABOUT');
      const exp=chunks.findIndex(x=>x.trim()==='EXPERIENCE');
      if(about>=0&&exp>about){chunks.splice(about+1,exp-about-1,(window.v('summary')||humanHook(a))+'\n\nKey vacancy strengths: '+(matched.length?matched.map(r=>r.evidence.source+' — '+r.text.slice(0,110)).join(' | '):'Add genuine evidence.'));li.textContent=chunks.join('\n\n');}
    }
    if(indeed && indeed.textContent){
      const chunks=indeed.textContent.split('\n\n');
      if(chunks[0].trim()==='PROFESSIONAL SUMMARY'&&chunks[1]) chunks[1]=(window.v('summary')||humanHook(a));
      indeed.textContent=chunks.join('\n\n');
    }
  }

  window.generate=function(){
    if(typeof originalGenerate==='function') originalGenerate();
    improveOutput();
    const a=enhancedAnalyse();
    if(typeof originalUpdateScore==='function') originalUpdateScore(a);
    improveOutput();
  };

  const oldUpdate=window.updateScore;
  window.updateScore=function(){
    const a=enhancedAnalyse();
    if(typeof oldUpdate==='function') oldUpdate(a);
    const score=document.getElementById('score');
    const text=document.getElementById('scoreText');
    if(score){
      const coverage=a.requirements.length?Math.round((a.supportedRequirements/a.requirements.length)*100):0;
      score.title='Requirement evidence coverage: '+coverage+'%';
    }
    if(text && a.requirements.length){
      const coverage=Math.round((a.supportedRequirements/a.requirements.length)*100);
      text.textContent+=' Requirement evidence coverage: '+coverage+'% across the top vacancy requirements. This is an optimisation/readiness measure, not a hiring probability.';
    }
  };

  document.addEventListener('DOMContentLoaded',function(){
    setTimeout(function(){
      const b=document.getElementById('analyzeBtn');
      if(b){b.addEventListener('click',renderEvidenceMap);}
    },0);
  });
})();
