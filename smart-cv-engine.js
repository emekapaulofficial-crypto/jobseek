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
    const found = unique([...roleTerms,...COMMON].filter(k=>lower.includes(k)));
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
    const role=input.targetRole||input.title||"Professional";
    const job=extractJobRequirements(input.jobDescription||"",role);
    const location=input.location||"[City, State]";
    const skills=(Array.isArray(input.skills)?input.skills:String(input.skills||"").split(/[,;\n]+/)).map(x=>x.trim()).filter(Boolean);
    const matchedJobSkills=job.keywords.filter(k=>skills.some(s=>norm(s).includes(k)||k.includes(norm(s))));
    const finalSkills=unique([...matchedJobSkills,...skills,...gapSkills(role),...job.keywords.map(titleCase)]).slice(0,18);
    const summary=input.summary && !VAGUE.some(v=>norm(input.summary).includes(v))
      ? input.summary
      : titleCase(role)+" professional with experience and skills aligned to the employer vacancy. Relevant areas include "+finalSkills.slice(0,6).join(", ")+". Add only verified achievements, qualifications and responsibilities from your real background.";
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
    return {cv,summary,skills:finalSkills,experience,education,guessedFields:guessed,jobRequirements:job};
  }

  function coverLetter(data={}) {
    const req=(data.jobRequirements||[]).slice(0,4).join(", ");
    return "Dear "+(data.hiringManager||"[Hiring Manager]")+",\n\n"+
      "I am applying for the "+(data.role||"[Role]")+" position at "+(data.company||"[Company Name]")+". I reviewed the vacancy and tailored this application around the stated requirements, including "+(req||"the responsibilities described in the vacancy")+".\n\n"+
      "My relevant background includes "+(data.experience||"[verified relevant experience]")+". My skills include "+((data.skills||[]).slice(0,6).join(", ")||"[verified relevant skills]")+". I would welcome the opportunity to discuss how my actual experience can support the team.\n\n"+
      "Kind regards,\n"+(data.name||"[Full Name]");
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

  window.JobSeekSmartCV={version:"smart-cv-v3-TAILORED-LOCKED",scoreCV,smartFill,coverLetter,applicationEmail,linkedin,titleCase,roleKeywords,extractJobRequirements};
})();