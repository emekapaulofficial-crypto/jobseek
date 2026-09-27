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
    // If the user uploaded/pasted a CV, use it as the source of truth before repairing.
    // Never replace real candidate information with generic placeholders when it can be extracted.
    let source=Object.assign({},input);
    if(String(input.cv||'').trim()){
      const parsed=parseResumeText(input.cv);
      ['name','email','phone','location','title','summary','skills','experience','education','certifications','projects'].forEach(k=>{
        if(!String(source[k]||'').trim() && String(parsed[k]||'').trim()) source[k]=parsed[k];
      });
    }
    const jd=String(source.jobDescription||'');
    const roleFromJD=(jd.match(/(?:title|position)\s*:\s*([^\n\r]+)/i)||[])[1]?.trim()||'';
    const role=(source.targetRole&&source.targetRole.trim())?source.targetRole.trim():(roleFromJD||source.title||'Professional');
    const job=extractJobRequirements(jd,role);
    const skills=(Array.isArray(source.skills)?source.skills:String(source.skills||"").split(/[,;\n]+/)).map(x=>x.trim()).filter(Boolean);
    // Only retain skills supplied by the candidate. Employer keywords are used for analysis,
    // not silently added as candidate skills.
    const finalSkills=unique(skills).slice(0,24);
    const existingSummary=String(source.summary||'').trim();
    const existingExperience=String(source.experience||'').trim();
    const summary=existingSummary && !VAGUE.some(v=>norm(existingSummary).includes(v))
      ? existingSummary
      : existingExperience
        ? "Professional with verified experience in "+(source.title||role)+". "+existingExperience.split(/\n+/)[0]
        : "";
    const experience=existingExperience || "";
    const education=String(source.education||'').trim();
    const certifications=String(source.certifications||'').trim();
    const projects=String(source.projects||'').trim();
    const guessed=[];
    ["name","email","phone","location","education"].forEach(k=>{if(!String(source[k]||'').trim())guessed.push(k);});
    if(!experience)guessed.push("experience");
    if(!skills.length)guessed.push("skills");
    if(!summary)guessed.push("summary");
    if(!certifications)guessed.push("certifications");
    const cv=[
      source.name||"[Full Name]",source.email||"[Professional Email]",source.phone||"[Phone]",source.location||"",
      "Target Role: "+role,"","PROFESSIONAL SUMMARY",summary||"[Add a professional summary based on your verified experience]",
      "","CORE SKILLS",finalSkills.length?finalSkills.map(x=>"• "+x).join("\n"):"[Add verified skills]",
      "","PROFESSIONAL EXPERIENCE",experience||"[Add your verified work experience]",
      "","EDUCATION",education||"[Add your verified education]",
      "","CERTIFICATIONS",certifications||"[Add verified certifications or state None]"
    ];
    if(projects)cv.push("","PROJECTS",projects);
    return {cv:cv.join("\n"),summary,skills:finalSkills,experience,education,certifications,projects,guessedFields:guessed,jobRequirements:job,targetRole:role};
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
    let t=String(text||'').replace(/\r/g,'');
    // PDF text extraction often returns the whole page as one long line.
    // Insert section boundaries before parsing so fields never swallow the entire CV.
    const headings=/\b(PROFILE SUMMARY|PROFESSIONAL SUMMARY|SUMMARY|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT|EDUCATION|ACADEMIC BACKGROUND|SKILLS|CORE SKILLS|TECHNICAL SKILLS|COMPETENCIES|CERTIFICATIONS|PROFESSIONAL CERTIFICATIONS|PROJECTS|SELECTED PROJECTS|INTERESTS & MOTIVATION|ADDITIONAL INFORMATION)\b/gi;
    t=t.replace(headings,(m)=>'\n'+m+'\n');
    t=t.replace(/(Email\s*:|Phone\s*:|WhatsApp\s*:|Location\s*:|Address\s*:|Nationality\s*:)/gi,'\n$1 ');
    t=t.replace(/\n{2,}/g,'\n');
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
function atsChecks(text){const l=norm(text),issues=[],positives=[];if(!/@/.test(text))issues.push('Add professional contact information.');if(/header|footer/i.test(l))issues.push('Keep critical contact details out of headers and footers when possible.');if(/\b(photo|age|date of birth|marital status|religion)\b/i.test(l))issues.push('Consider removing unnecessary personal details.');else positives.push('No obvious unnecessary personal-detail fields detected.');return{issues,positives}}
const _scoreCV=scoreCV;
function scoreCVv6(text,role,jd){
  const r=_scoreCV(text,role,jd),rd=readability(text),at=atsChecks(text),lower=norm(text);
  const job=extractJobRequirements(jd,role);
  const keys=unique([...(roleKeywords(role)||[]),...(job.keywords||[])]);
  const matched=keys.filter(k=>lower.includes(norm(k)));
  const missing=keys.filter(k=>!lower.includes(norm(k)));

  // Requirement-level matching: keyword presence alone is not enough.
  // We identify explicit employer requirements, mandatory language, qualifications,
  // experience thresholds and concrete skills, then compare them with the candidate CV.
  const stop=new Set("the a an and or of to in for with from on at as is are be being this that their they you your our we will can should must have has had it its by into about over under within using use used work working role position candidate candidates required requirements preferred qualification qualifications experience years year".split(" "));
  const cleanWords=s=>unique(norm(s).match(/[a-z0-9+#./-]{3,}/g)||[]).filter(w=>!stop.has(w));
  const lines=String(jd||"").split(/\n|•|(?<=[.!?])\s+/).map(x=>x.trim()).filter(x=>x.length>18);
  const reqLines=lines.filter(x=>/(required|must|minimum|essential|qualif|experience|degree|bachelor|master|diploma|certif|years|proficien|knowledge|skills?|ability|responsib|preferred|desirable)/i.test(x)).slice(0,30);

  function requirementTerms(line){
    const phraseHits=keys.filter(k=>norm(line).includes(norm(k))).map(norm);
    const terms=cleanWords(line);
    return unique([...phraseHits,...terms.filter(t=>t.length>=4)]).slice(0,12);
  }
  function lineMatch(line){
    const terms=requirementTerms(line);
    if(!terms.length)return {matched:false,ratio:0,terms:[]};
    let hits=terms.filter(t=>lower.includes(t));
    // Normalize common degree wording so BSc/BS/BA/BEng can satisfy
    // equivalent "bachelor's/bachelor degree" requirements.
    if(/\b(bachelor|bachelors|undergraduate|degree)\b/i.test(line) && /\b(bsc|b\.sc\.?|bs|b\.s\.?|ba|b\.a\.?|beng|b\.eng\.?|btech|b\.tech\.?)\b/i.test(text)){
      hits=unique([...hits,'degree']);
    }
    const reqYears=(line.match(/(?:at least|minimum of|min\.?|over|more than)?\s*(\d+)\+?\s*years?/i)||[])[1];
    const candidateYears=(text.match(/(?:over|more than|at least|minimum of)?\s*(\d+)\+?\s*years?/gi)||[]).map(x=>parseInt(x.match(/\d+/)[0],10));
    if(reqYears && candidateYears.some(y=>y>=Number(reqYears))) hits=unique([...hits,'years']);
    return {matched:hits.length>=Math.max(1,Math.ceil(Math.min(terms.length,4)*0.5)),ratio:hits.length/terms.length,terms,hits};
  }

  const requirementResults=reqLines.map(line=>{
    const m=lineMatch(line);
    const mandatory=/(required|must|minimum|essential|mandatory)/i.test(line);
    const degree=/(bachelor|master|mba|phd|degree|diploma)/i.test(line);
    const yearsReq=(line.match(/(?:at least|minimum of|min\.?|over|more than)?\s*(\d+)\+?\s*years?/i)||[])[1];
    let candidateYears=null;
    const yearMatches=lower.match(/(?:over|more than|at least|minimum of)?\s*(\d+)\+?\s*years?/g)||[];
    if(yearMatches.length) candidateYears=Math.max(...yearMatches.map(x=>parseInt(x.match(/\d+/)[0],10)));
    const yearsMismatch=!!yearsReq && (!candidateYears || candidateYears<Number(yearsReq));
    const failed=(!m.matched || m.ratio<0.35 || yearsMismatch);
    return {requirement:line,mandatory,degree,yearsRequired:yearsReq?Number(yearsReq):null,candidateYears,matched:m.matched&&!yearsMismatch,ratio:m.ratio,matchedTerms:m.hits,missingTerms:m.terms.filter(t=>!m.hits.includes(t)),failed};
  });

  // Stronger matching for concrete vacancy keywords.
  const keywordCoverage=keys.length?Math.round(matched.length/keys.length*100):0;
  const applicable=requirementResults.length;
  const reqMatched=requirementResults.filter(x=>x.matched).length;
  const reqCoverage=applicable?Math.round(reqMatched/applicable*100):keywordCoverage;
  const hardGaps=requirementResults.filter(x=>x.failed && (x.mandatory||x.degree||x.yearsRequired)).map(x=>x.requirement);
  const otherGaps=requirementResults.filter(x=>x.failed && !hardGaps.includes(x.requirement)).map(x=>x.requirement);
  let compatibilityStatus="NO_VACANCY_DATA",compatibilityLabel="Vacancy requirements not analysed",compatibilityMessage="Paste the exact employer vacancy so JobSeek can compare the CV against the real requirements.";
  if(String(jd||"").trim()){
    if(hardGaps.length || reqCoverage<35){
      compatibilityStatus="NOT_COMPATIBLE";
      compatibilityLabel="CV does not currently match this vacancy";
      compatibilityMessage="The CV is missing or does not demonstrate one or more important vacancy requirements. Review the gaps before applying.";
    }else if(reqCoverage<60){
      compatibilityStatus="WEAK_MATCH";
      compatibilityLabel="CV is not well tailored to this vacancy";
      compatibilityMessage="The CV matches some requirements, but important parts of the vacancy are not clearly demonstrated.";
    }else if(reqCoverage<80){
      compatibilityStatus="PARTIAL_MATCH";
      compatibilityLabel="CV is partially tailored to this vacancy";
      compatibilityMessage="The CV demonstrates a reasonable portion of the requirements, but some relevant requirements should be addressed.";
    }else{
      compatibilityStatus="STRONG_MATCH";
      compatibilityLabel="CV is strongly tailored to this vacancy";
      compatibilityMessage="The CV demonstrates most of the requirements identified from this vacancy.";
    }
  }

  const enhancedFeedback=[...r.feedback];
  if(compatibilityStatus==="NOT_COMPATIBLE") enhancedFeedback.push("CV does not currently match the vacancy requirements. Do not treat missing requirements as satisfied.");
  else if(compatibilityStatus==="WEAK_MATCH") enhancedFeedback.push("CV is not well tailored to the exact vacancy requirements.");
  else if(compatibilityStatus==="PARTIAL_MATCH") enhancedFeedback.push("CV is partially tailored to the exact vacancy requirements.");
  if(hardGaps.length) enhancedFeedback.push("Important requirement gaps detected: "+hardGaps.slice(0,3).join(" | "));
  if(otherGaps.length) enhancedFeedback.push("Requirements needing evidence: "+otherGaps.slice(0,3).join(" | "));

  const clean=Math.max(0,Math.min(100,r.score));
  const applicationEligible=clean>=50 && !["NOT_COMPATIBLE","WEAK_MATCH"].includes(compatibilityStatus);
  return Object.assign({},r,{
    score:clean,
    level:clean>=80?"STRONG":clean>=50?"AVERAGE":"WEAK",
    feedback:unique(enhancedFeedback),
    readability:rd,ats:at,
    matchedKeywords:matched,
    missingKeywords:missing,
    keywordCoverage,
    requirementCoverage:reqCoverage,
    vacancyCompatibility:compatibilityStatus,
    vacancyCompatibilityLabel:compatibilityLabel,
    vacancyCompatibilityMessage:compatibilityMessage,
    hardRequirementGaps:hardGaps,
    requirementGaps:otherGaps,
    requirementResults,
    applicationEligible
  });
}
window.JobSeekSmartCV={version:"smart-cv-v11-import-core-fix",scoreCV:scoreCVv6,smartFill,buildImprovementPlan,applyImprovementAnswers,coverLetter,applicationEmail,linkedin,titleCase,roleKeywords,extractJobRequirements,parseResumeText};
})();