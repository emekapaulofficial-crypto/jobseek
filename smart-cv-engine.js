/* JobSeek Smart CV & Application Engine v3 — vacancy tailored */
(function () {
  'use strict';

  const ROLE_KEYWORDS = {
    "product manager":["product roadmap","prd","agile","scrum","user research","figma","wireframe","jira","mvp","user story","stakeholder","analytics","product lifecycle"],
    "developer":["javascript","react","node.js","api","git","github"],
    "software developer":["javascript","react","node.js","api","git","github"],
    "designer":["figma","ui/ux","prototype","wireframe","adobe"],
    "ui/ux designer":["figma","ui/ux","prototype","wireframe","adobe"]
  };
  const COMMON = ["communication","leadership","management","analysis","research","customer","client","stakeholder","project","team","strategy","reporting","excel","microsoft office","sql","python","javascript","react","node.js","api","git","github","figma","jira","agile","scrum","sales","marketing","operations","finance","accounting","recruitment","compliance","documentation","presentation"];
  const ACTIONS = ["managed","launched","built","led","increased","designed","achieved","created","developed","implemented","delivered","coordinated","improved","optimized","analysed","analyzed","deployed","automated","supervised"];
  const VAGUE = ["i can do this and that","am good in all i do","this and that","etc","i can do anything","hardworking","any work","am good","anything","good in all i do"];

  const norm = s => String(s || "").toLowerCase().replace(/\s+/g," ").trim();
  const unique = a => [...new Set(a)];
  const titleCase = s => String(s || "").replace(/\b([a-z])/g,m=>m.toUpperCase());
  const words = s => norm(s).match(/[a-z0-9+#./-]+/g) || [];

  function roleKey(role) {
    const r = norm(role);
    return ROLE_KEYWORDS[r] ? r : (Object.keys(ROLE_KEYWORDS).find(k=>r.includes(k)) || r);
  }
  function roleKeywords(role, extra="") {
    const base = ROLE_KEYWORDS[roleKey(role)] || [];
    const extras = String(extra).split(/[,;\n]+/).map(x=>norm(x)).filter(x=>x.length>3);
    return unique([...base,...extras]);
  }

  function extractJobRequirements(jobDescription,targetRole) {
    const text = String(jobDescription || "");
    const lower = norm(text);
    const roleTerms = ROLE_KEYWORDS[roleKey(targetRole)] || [];
    const phrasePatterns=["statistical models","predictive models","scoring systems","segmentation methods","machine-learning solutions","machine learning","design and evaluate experiments","experiments","appropriate metrics","metrics","data quality","reproducible data-analysis workflows","production systems","model behaviour","rules-based methods","analytical or modelling problems","datasets","data analysis","data-analysis","operational data","product data","business questions","modelling","model performance"]; const found=unique([...phrasePatterns,...roleTerms,...COMMON].filter(k=>lower.includes(k)));
    const lines = text.split(/\n|•/).map(x=>x.trim()).filter(Boolean);
    const requirements = lines.filter(x=>x.length>25 && /(responsib|require|qualif|experience|skill|knowledge|ability|must|should|duties|role|preferred)/i.test(x)).slice(0,15);
    return { keywords:found, requirements, summary:text.slice(0,1200) };
  }

  function scoreCV(cvText,targetRole,jobDescription="") {
    const text=String(cvText||"");
    const lower=norm(text);
    const feedback=[],positives=[];
    let score=100;
    VAGUE.forEach(p=>{const hits=lower.split(p).length-1;if(hits){score-=15*hits;for(let i=0;i<hits;i++)feedback.push('Avoid vague phrase: "'+p+'"');}});
    [["experience","Professional Experience"],["education","Education"],["professional summary","Professional Summary"]].forEach(([n,l])=>{if(!lower.includes(n)){score-=10;feedback.push("Missing "+l);}});
    const wc=words(text).length;
    if(wc<100){score-=15;feedback.push("CV is under 100 words; add professional evidence.");}
    else if(wc>=150) positives.push("CV has professional length.");
    const nums=text.match(/\b\d+(?:\.\d+)?%?\b/g)||[];
    if(!nums.length){score-=15;feedback.push("Add measurable results such as numbers, percentages, scale or time.");}
    else positives.push("Measurable evidence detected.");
    const actionHits=ACTIONS.filter(v=>lower.includes(v));
    if(!actionHits.length){score-=10;feedback.push("Use strong action verbs such as Managed, Led, Built, Launched or Achieved.");}
    else positives.push("Action verbs detected: "+actionHits.slice(0,6).join(", ")+".");
    const jd=extractJobRequirements(jobDescription,targetRole);
    const keywords=unique([...roleKeywords(targetRole),...jd.keywords]);
    const matched=keywords.filter(k=>lower.includes(k));
    const coverage=keywords.length?Math.round(matched.length/keywords.length*100):0;
    if(keywords.length){
      if(coverage<40){score-=15;feedback.push("Low match to the exact employer vacancy requirements.");}
      else if(coverage<70){score-=5;feedback.push("Moderate match to the exact employer vacancy requirements.");}
      else positives.push("Strong vacancy keyword match: "+coverage+"%.");
    }
    const clean=Math.max(0,Math.min(100,score));
    return {score:clean,level:clean>=80?"STRONG":clean>=50?"AVERAGE":"WEAK",feedback:unique(feedback),positives:unique(positives),matchedKeywords:matched,keywordCoverage:coverage,wordCount:wc,applicationEligible:clean>=50,jobRequirements:jd};
  }

  function gapSkills(role) {
    const k=roleKey(role);
    return (ROLE_KEYWORDS[k]||["communication","project coordination","problem solving","stakeholder management","research","documentation","data analysis","team collaboration"]).slice(0,10).map(titleCase);
  }

  function professionalExperience(role,location,job) {
    const req=job.keywords.slice(0,5).map(titleCase).join(", ");
    return "[Add your real role/project] — [Company/Organisation] — [Dates] — "+location+"\n"+
      "• Describe your real work using evidence relevant to this vacancy: "+(req||gapSkills(role).slice(0,3).join(", "))+".\n"+
      "• Add a measurable result, scope, users/customers, budget, time or percentage where truthful.\n"+
      "• Add tools, responsibilities and outcomes that genuinely match the employer requirements.";
  }

  function smartFill(input={}) {
    const role=(input.targetRole&&input.targetRole.trim())?input.targetRole:(/machine[- ]learning|predictive model|statistical model|data scientist/i.test(input.jobDescription||"")?"Data Scientist":/data analys|analytics|dataset|data quality|experiments/i.test(input.jobDescription||"")?"Data Analyst":"Professional");
    const job=extractJobRequirements(input.jobDescription||"",role);
    const location=input.location||"[City, State]";
    const skills=(Array.isArray(input.skills)?input.skills:String(input.skills||"").split(/[,;\n]+/)).map(x=>x.trim()).filter(Boolean);
    const matchedJobSkills=job.keywords.filter(k=>skills.some(s=>norm(s).includes(k)||k.includes(norm(s))));
    // Keep employer requirements separate from candidate evidence; never claim a vacancy skill unless the candidate supplied it.
    const finalSkills=unique([...skills,...matchedJobSkills]).slice(0,18);
    const summary=input.summary && !VAGUE.some(v=>norm(input.summary).includes(v))
      ? input.summary
      : titleCase(role)+" focused on "+job.keywords.slice(0,6).map(titleCase).join(", ")+". Brings a structured, evidence-based approach to analysing data, solving business questions and communicating findings. Tailored to the specific employer requirements supplied for this vacancy.";
    const experience=input.experience && !VAGUE.some(v=>norm(input.experience).includes(v))
      ? input.experience
      : professionalExperience(role,location,job);
    const education=input.education||"[Institution] — [Qualification/Degree] — [Year]";
    const guessed=[];
    ["name","email","phone","location","education"].forEach(k=>{if(!input[k])guessed.push(k);});
    if(!input.experience||VAGUE.some(v=>norm(input.experience).includes(v)))guessed.push("experience");
    if(!input.skills)guessed.push("skills");
    if(!input.summary||VAGUE.some(v=>norm(input.summary).includes(v)))guessed.push("summary");
    const cv=[
      input.name||"[Full Name]",input.email||"[Professional Email]",input.phone||"[Phone]",location,
      "Target Role: "+titleCase(role),"","PROFESSIONAL SUMMARY",summary,
      "","CORE SKILLS",finalSkills.map(s=>"• "+titleCase(s)).join("\n"),
      "","PROFESSIONAL EXPERIENCE",experience,
      "","EDUCATION",education,
      "","CERTIFICATIONS",input.certifications||"[Add relevant certification or None]"
    ].join("\n");
    return {cv,summary,skills:finalSkills,experience,education,guessedFields:guessed,jobRequirements:job,targetRole:role};
  }

  function coverLetter(data={}) {
    const jdText=String(data.jobDescription||"");
    const job=extractJobRequirements(jdText,data.role||"");
    const req=(data.jobRequirements||job.keywords||[]).slice(0,6);
    const skills=Array.isArray(data.skills)?data.skills.filter(Boolean):[];
    const exp=String(data.experience||"").trim();
    const evidence=unique([...skills,...(data.matchedKeywords||[])]).slice(0,6);
    const role=data.role||"the position";
    const company=data.company||"[Company Name]";
    const opening=req.length
      ? "After reviewing the vacancy, I understand that this role focuses on "+req.slice(0,4).map(titleCase).join(", ")+". I have tailored my application to those specific requirements rather than using a general cover letter."
      : "After reviewing the vacancy, I have tailored my application to the responsibilities and requirements described for this specific role.";
    const evidenceLine=evidence.length
      ? "The relevant evidence I have provided includes "+evidence.map(titleCase).join(", ")+"."
      : "I have included only the skills and experience I can verify from the candidate information supplied, and I would be pleased to discuss the areas that match your requirements.";
    const experienceLine=exp && !/^\\[.*\\]$/.test(exp)
      ? "My stated experience is: "+exp+"."
      : "My experience section identifies the candidate's actual roles, responsibilities and measurable results so that the application can be reviewed against your requirements without inventing qualifications.";
    const roleFocus=req.length
      ? "In particular, I would be interested in contributing to the vacancy's requirements around "+req.slice(0,3).map(titleCase).join(", ")+"."
      : "I would welcome the opportunity to discuss how my verified background aligns with the role.";
    return "Dear "+(data.hiringManager||"[Hiring Manager]")+",\\n\\n"+
      "I am applying for the "+role+" position at "+company+". "+opening+"\\n\\n"+
      evidenceLine+" "+experienceLine+"\\n\\n"+
      roleFocus+" I understand the importance of meeting the employer's stated requirements while being accurate about my own experience and qualifications.\\n\\n"+
      "Thank you for considering my application. I would welcome the opportunity to discuss my fit for the role and provide any additional evidence required.\\n\\n"+
      "Kind regards,\\n"+(data.name||"[Full Name]");
  }

  function applicationEmail(data={}) {
    const req=(data.jobRequirements||[]).slice(0,5).join(", ");
    return "Subject: Application for "+(data.role||"[Role]")+" — "+(data.name||"[Full Name]")+"\n\n"+
      "Dear "+(data.hiringManager||"[Hiring Manager]")+",\n\n"+
      "Please find my application for the "+(data.role||"[Role]")+" position at "+(data.company||"[Company Name]")+". I reviewed the exact vacancy requirements, including "+(req||"the stated role requirements")+", and tailored my application to them.\n\n"+
      "Relevant verified skills: "+((data.skills||[]).slice(0,6).join(", ")||"[relevant skills]")+".\n\nThank you for your consideration.\n\nKind regards,\n"+(data.name||"[Full Name]")+"\n"+(data.email||"[Professional Email]")+"\n"+(data.phone||"[Phone]");
  }

  function linkedin(data={}) {
    return (data.name||"[Full Name]")+" | "+(data.role||"[Target Role]")+"\n\n"+
      "Professional profile focused on "+((data.skills||[]).slice(0,6).join(", ")||"[verified skills]")+
      ". I am interested in opportunities where I can apply verified experience to real employer requirements and deliver measurable results.";
  }

  function parseResumeText(text){
    const t=String(text||'').replace(/\r/g,'');
    const clean=x=>String(x||'').replace(/^\s*(?:#{1,6}\s*)/,'').replace(/\*\*/g,'').replace(/__+/g,'').trim();
    const o={name:'',email:'',phone:'',location:'',title:'',summary:'',skills:'',experience:'',education:'',certifications:'',projects:''};
    const rawLines=t.split(/\n/).map(clean).filter(Boolean);
    const lines=rawLines.map(x=>x.replace(/^[-•]\s*/,'').trim()).filter(Boolean);
    o.email=(t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[])[0]||'';
    o.phone=(t.match(/(?:\+?\d[\d\s().-]{7,}\d)/)||[])[0]||'';
    const hs={summary:/^(professional summary|summary|profile|objective)$/i,experience:/^(professional experience|work experience|employment|experience)$/i,education:/^(education|academic background)$/i,skills:/^(core skills|technical skills|skills|competencies|core competencies)$/i,certifications:/^(certifications?|licenses?|professional certifications)$/i,projects:/^(projects?|portfolio|selected projects)$/i,location:/^(location|address|city)$/i};
    const b={}; let cur='';
    lines.forEach(line=>{const h=Object.keys(hs).find(k=>hs[k].test(line));if(h){cur=h;b[cur]=[];return}if(cur)(b[cur]||(b[cur]=[])).push(line);});
    o.summary=(b.summary||[]).join('\n'); o.experience=(b.experience||[]).join('\n'); o.education=(b.education||[]).join('\n');
    o.skills=(b.skills||[]).join(', '); o.certifications=(b.certifications||[]).join('\n'); o.projects=(b.projects||[]).join('\n'); o.location=(b.location||[]).join(', ');
    o.name=lines.find(x=>x.length>2&&x.length<70&&!/@/.test(x)&&!Object.values(hs).some(r=>r.test(x))&&!/^(phone|email|mobile|tel)\s*:/i.test(x))||'';
    o.title=lines.find(x=>/senior geologist|geologist|data analyst|data scientist|software engineer|developer|product manager|designer|accountant|project manager|electrician|marketing/i.test(x))||'';
    if(!o.location){const loc=lines.find(x=>/\b(lagos|abuja|port harcourt|ibadan|enugu|benin|kano|kaduna|warri|delta|nigeria)\b/i.test(x)&&x!==o.name);if(loc)o.location=loc;}
    return o;
  }
function buildImprovementPlan(cvText,targetRole='',jobDescription=''){
  const text=String(cvText||'').trim();
  const analysis=scoreCVv6(text,targetRole,jobDescription);
  const missing=analysis.missingKeywords||[];
  const questions={
    strategy:'Have you planned, improved or evaluated a geological process, project or field-development activity? Give the real situation and your contribution.',
    reporting:'Have you prepared technical reports, geological maps, well reports, dashboards or management updates? What did you produce?',
    operations:'Have you supported drilling, workover, logging, completion, coring, perforation, fishing, sidetracking or other well operations? Describe what you actually did.',
    compliance:'Have you worked with HSSE, regulatory requirements, SPE-PRMS, NUPRC or another documented standard/control? State your actual experience.',
    documentation:'What technical documentation have you personally prepared or reviewed?',
    leadership:'Have you mentored people or led a technical workstream/project? State your actual responsibility and team/project size if known.',
    management:'Have you coordinated people, vendors, service companies, clients, budgets or competing technical priorities? Give the real example.',
    analysis:'What geological, geophysical, well or reservoir data have you analysed, and what decision or outcome did the analysis support?',
    project:'Describe one relevant subsurface, exploration, appraisal, development or operations project you personally contributed to and the result.',
    team:'How have you worked with reservoir engineers, petrophysicists, drilling engineers, production teams or other disciplines?',
    software:'Which industry software have you actually used, for how long, and at what level?'
  };
  const keywordMap={strategy:['field development planning','development planning'],reporting:['technical reports','technical report'],operations:['operations geology','drilling','workover','well operations'],compliance:['hsse','compliance','spe-prms','nuprc'],documentation:['documentation','reports'],leadership:['leadership','mentor','mentoring'],management:['management','managed','coordination'],analysis:['interpretation','analysis','data integration'],project:['project'],team:['multidisciplinary','cross-discipline'],software:['petrel','software']};
  const plan=[];
  Object.keys(keywordMap).forEach(key=>{
    const related=missing.filter(m=>keywordMap[key].some(k=>m.toLowerCase().includes(k)));
    if(related.length) plan.push({keyword:related.slice(0,3).join(', '),question:questions[key],answer:''});
  });
  missing.slice(0,8).forEach(k=>{
    if(!plan.some(x=>x.keyword.toLowerCase().includes(k.toLowerCase()))) plan.push({keyword:k,question:'Do you have genuine experience with '+k+'? If yes, describe exactly what you did and any real result. If not, leave this blank.',answer:''});
  });
  return {analysis,plan:plan.slice(0,12)};
}
function applyImprovementAnswers(input={},plan=[]){
  const data=Object.assign({},input);
  const answers=(plan||[]).filter(x=>String(x.answer||'').trim()).map(x=>({keyword:x.keyword,answer:String(x.answer).trim()}));
  const base=String(data.cv||'').trim();
  const additions=answers.map(x=>'- '+x.answer).join('\n');
  const cv=base+(additions?(base?'\n\nVerified CV improvements\n':'Verified CV improvements\n')+additions:'');
  return Object.assign(data,{cv,summary:data.summary||'',skills:data.skills||'',experience:data.experience||'',education:data.education||''});
}
function readability(text){const w=words(text).length,s=String(text).split(/[.!?]+/).filter(x=>x.trim()).length,a=s?w/s:w;return{wordCount:w,sentenceCount:s,avgWordsPerSentence:Math.round(a*10)/10,tooLong:a>28}}
function atsChecks(text){const l=norm(text),issues=[],positives=[];if(!/@/.test(text))issues.push('Add professional contact information.');if(/header|footer/i.test(l))issues.push('Keep critical contact details out of headers and footers when possible.');if(/\\b(photo|age|date of birth|marital status|religion)\\b/i.test(l))issues.push('Consider removing unnecessary personal details.');else positives.push('No obvious unnecessary personal-detail fields detected.');return{issues,positives}}
const _scoreCV=scoreCV;
function scoreCVv6(text,role,jd){const r=_scoreCV(text,role,jd),rd=readability(text),at=atsChecks(text),lower=norm(text),keys=unique([...(roleKeywords(role)||[]),...((r.jobRequirements&&r.jobRequirements.keywords)||[])]),matched=keys.filter(k=>lower.includes(k)),missing=keys.filter(k=>!lower.includes(k));return Object.assign({},r,{readability:rd,ats:at,matchedKeywords:matched,missingKeywords:missing,keywordCoverage:keys.length?Math.round(matched.length/keys.length*100):0})}
window.JobSeekSmartCV={version:"smart-cv-v8-coach",scoreCV:scoreCVv6,smartFill,buildImprovementPlan,applyImprovementAnswers,coverLetter,applicationEmail,linkedin,titleCase,roleKeywords,extractJobRequirements,parseResumeText};
})();