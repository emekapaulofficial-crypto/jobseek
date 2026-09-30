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
    t=t.replace(/\b(PROFILE SUMMARY|PROFESSIONAL SUMMARY|SUMMARY|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT|EXPERIENCE|EDUCATION|ACADEMIC BACKGROUND|SKILLS|CORE SKILLS|TECHNICAL SKILLS|COMPETENCIES|CERTIFICATIONS|PROFESSIONAL CERTIFICATIONS|PROJECTS|SELECTED PROJECTS)\b/g,'\n$1\n').replace(/\n{2,}/g,'\n');
    // PDF text extraction often returns the whole page as one long line.
    // Insert section boundaries before parsing so fields never swallow the entire CV.
    // IMPORTANT: this must be case-sensitive (ALL CAPS only). A case-insensitive match
    // used to fire on ordinary words like "experience" or "summary" inside a sentence
    // (e.g. "...4 years of experience creating...") and cut the CV apart mid-sentence,
    // scattering the rest of that sentence into the wrong field.
    const headings=/\b(PROFILE SUMMARY|PROFESSIONAL SUMMARY|SUMMARY|WORK EXPERIENCE|PROFESSIONAL EXPERIENCE|EMPLOYMENT|EDUCATION|ACADEMIC BACKGROUND|SKILLS|CORE SKILLS|TECHNICAL SKILLS|COMPETENCIES|CERTIFICATIONS|PROFESSIONAL CERTIFICATIONS|PROJECTS|SELECTED PROJECTS|INTERESTS & MOTIVATION|ADDITIONAL INFORMATION)\b/g;
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
    const header=lines.find(x=>/@/.test(x)&&/\d/.test(x)&&x.length<180)||lines[0]||'';
    // The header line usually packs "Name  City, Country | phone | email" onto one row
    // with no clean delimiter between name and city, only extra spaces. Split on both
    // pipes/bullets AND 2+ spaces so the name doesn't swallow the location.
    const headerParts=header.split(/\s*[|•·]\s*|\s{2,}/).map(x=>x.trim()).filter(Boolean);
    const headerName=headerParts[0]||'';
    // The dedicated "clean" line (no @, no leading phone digits, not a section heading,
    // not itself a place name) is the safest name candidate — CVs almost always put the
    // candidate's name on its own line before the contact/location row.
    const cleanNameLine=lines.find(x=>x.length>2&&x.length<60&&!/@/.test(x)&&!/^\+?\d/.test(x)&&!Object.values(hs).some(r=>r.test(x))&&!/^(phone|email|mobile|tel|location|address)\s*:/i.test(x)&&!/\b(nigeria|lagos|abuja|enugu|ibadan|ekiti|ado ekiti|akure|benin|kano|kaduna|port harcourt|warri|delta|ondo)\b/i.test(x));
    const headerNameLooksLikePlace=/\b(nigeria|lagos|abuja|enugu|ibadan|ekiti|ado ekiti|akure|benin|kano|kaduna|port harcourt|warri|delta|ondo)\b/i.test(headerName);
    o.name=(headerName&&headerName.length>2&&headerName.length<60&&!/@/.test(headerName)&&!/\d{5,}/.test(headerName)&&!headerNameLooksLikePlace?headerName:(cleanNameLine||headerName))||'';
    if(!o.location){const hp=headerParts.find(x=>x!==o.name&&/\b(nigeria|lagos|abuja|enugu|ibadan|ekiti|ado ekiti|akure|benin|kano|kaduna|port harcourt|warri|delta|ondo)\b/i.test(x)&&!/@/.test(x));if(hp)o.location=hp;}
    if(!o.location){const loc=lines.find(x=>x.length<80&&/\b(lagos|abuja|port harcourt|ibadan|enugu|benin|kano|kaduna|warri|delta|nigeria)\b/i.test(x)&&x!==o.name&&!/@/.test(x));if(loc)o.location=loc;}
    // Title: only look at the header row and the opening sentence of the summary, using a
    // job-title phrase match. Scanning the whole CV body (old behaviour) could latch onto
    // an unrelated word such as "projects" appearing deep in a bullet point.
    const titleScope=[...headerParts,...String(o.summary||'').split(/(?<=[.!?])\s+/).slice(0,2),...String(o.experience||'').split(/(?<=[.!?])\s+/).slice(0,1)];
    const titleRe=/\b((?:senior|junior|lead|chief)\s+)?(graphic designer|web developer|software (?:engineer|developer)|data (?:analyst|scientist)|product manager|project manager|marketing (?:manager|officer|specialist)|content writer|ui\/ux designer|ux designer|ui designer|agricultural (?:officer|technician)|farm manager|electrical engineer|electrician|mechanical engineer|customer service (?:representative|officer)|operations manager|account(?:ant|s? manager)?|finance (?:officer|manager)|human resources (?:officer|manager)|sales (?:executive|manager|representative)|business (?:analyst|developer)|teacher|geologist|technician|administrator|entrepreneur|designer|developer|engineer|manager|analyst|writer)\b/i;
    let foundTitle='';
    for(const s of titleScope){const m=s.match(titleRe);if(m){foundTitle=m[0].trim();break;}}
    o.title=foundTitle;
    return o;
  }
function buildImprovementPlan(cvText,targetRole='',jobDescription=''){
  const text=String(cvText||'').trim();
  const analysis=scoreCVv6(text,targetRole,jobDescription);
  const missing=analysis.missingKeywords||[];
  const plan=[];
  const add=(keyword,question)=>{if(!keyword)return;if(plan.some(x=>norm(x.keyword)===norm(keyword)))return;plan.push({keyword,question,answer:''})};
  missing.slice(0,10).forEach(k=>{
    const pretty=titleCase(k);
    add(k,'Do you have genuine experience with '+pretty+'? If yes, describe exactly what you did, the context, tools used and any real result. If not, leave this blank.');
  });
  (analysis.requirementResults||[]).filter(x=>x.failed).slice(0,6).forEach(x=>{
    const key=(x.missingTerms||[]).slice(0,3).join(', ')||x.requirement.slice(0,70);
    add(key,'This vacancy asks for: '+x.requirement+' Do you have real evidence for this requirement? Describe your actual responsibility, result or qualification. Do not add it if you do not have it.');
  });
  if(!plan.length && text) add('evidence','What is one measurable result from your real experience that would make this CV stronger for the target role?');
  return {analysis,plan:plan.slice(0,12)};
}
function applyImprovementAnswers(input={},plan=[]){
  // Safe improvement mode: preserve the candidate's original CV content and
  // only append information the candidate explicitly verified.
  const data=Object.assign({},input);
  const answers=(plan||[]).filter(x=>String(x.answer||'').trim()).map(x=>({
    keyword:String(x.keyword||'').trim(),
    answer:String(x.answer||'').trim()
  }));

  const cleanAnswer=a=>String(a)
    .replace(/^(answer|response)\s*:\s*/i,'')
    .replace(/^[-•]+\s*/,'')
    .trim();

  let summary=String(data.summary||'').trim();
  let experience=String(data.experience||'').trim();
  let education=String(data.education||'').trim();
  let projects=String(data.projects||'').trim();
  let certifications=String(data.certifications||'').trim();
  const skills=(Array.isArray(data.skills)
    ? data.skills.map(String)
    : String(data.skills||'').split(/[,;\n]+/))
    .map(x=>x.trim()).filter(Boolean);

  const appendUnique=(current,text)=>{
    const n=norm(text);
    if(!n)return current;
    if(norm(current).includes(n))return current;
    return current ? current+'\n• '+text : '• '+text;
  };

  answers.forEach(item=>{
    const a=cleanAnswer(item.answer);
    if(!a)return;
    const k=norm(item.keyword);

    // Never turn a negative answer into a CV claim.
    if(/^(no|none|not yet|no experience|i do not|i don't|not applicable)\b/i.test(a)) return;

    if(/skill|software|tool|technical/i.test(k)){
      a.split(/[,;\n]+/)
        .map(v=>v.trim())
        .filter(v=>v.length>2 && v.length<80)
        .forEach(v=>{
          if(!skills.some(s=>norm(s)===norm(v))) skills.push(v);
        });
    }else if(/project/i.test(k)){
      projects=appendUnique(projects,a);
    }else if(/certif|license|qualification/i.test(k)){
      certifications=appendUnique(certifications,a);
    }else{
      // Evidence, responsibilities, results and verified vacancy-related
      // experience belong in Experience. Existing text is never replaced.
      experience=appendUnique(experience,a);
    }
  });

  const finalSkills=unique(skills).slice(0,30);

  // Keep the original summary intact. Only create one when it was genuinely
  // missing; never replace a user's stronger existing summary.
  if(!summary && (experience||finalSkills.length)){
    summary='Professional with verified experience in '+(data.title||data.targetRole||'the target role')+
      (finalSkills.length ? '. Core strengths include '+finalSkills.slice(0,5).join(', ')+'.' : '');
  }

  const target=data.targetRole||data.title||'Professional';
  const cv=[
    data.name||'[Full Name]',
    data.email||'[Professional Email]',
    data.phone||'[Phone]',
    data.location||'',
    'Target Role: '+target,
    '',
    'PROFESSIONAL SUMMARY',
    summary||'[Add a professional summary based on your verified experience]',
    '',
    'CORE SKILLS',
    finalSkills.length?finalSkills.map(x=>'• '+x).join('\n'):'[Add verified skills]',
    '',
    'PROFESSIONAL EXPERIENCE',
    experience||'[Add your verified work experience]',
    '',
    'EDUCATION',
    education||'[Add your verified education]'
  ];
  if(certifications)cv.push('','CERTIFICATIONS',certifications);
  if(projects)cv.push('','PROJECTS',projects);

  return Object.assign(data,{
    cv:cv.join('\n'),
    summary,
    skills:finalSkills,
    experience,
    education,
    projects,
    certifications
  });
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
  /* =========================================================
   PAUL AI — JobSeek Career Recruiter Assistant
   Safe Extension Module
   ========================================================= */

const PaulAI = {

  name: "Paul",

  version: "1.0",

  analyse(cv, jobDescription, userRole="candidate") {

    const analysis = scoreCVv6(
      cv,
      userRole,
      jobDescription
    );

    const missing = analysis.missingKeywords || [];

    const gaps = analysis.requirementGaps || [];

    let message = "";

    if (!jobDescription.trim()) {

      message =
      "Hi, I am Paul. Please paste the employer's job description first. I need the exact vacancy requirements before I can review how your CV matches the role.";

      return {
        message,
        score: analysis.score
      };
    }


    message +=
    "Hi, I reviewed your CV against this vacancy.\n\n";


    if (analysis.vacancyCompatibility === "STRONG_MATCH") {

      message +=
      "Your CV shows strong alignment with this role. The next step is making sure your achievements and results are clearly written.\n\n";

    }

    else if (
      analysis.vacancyCompatibility === "PARTIAL_MATCH"
    ) {

      message +=
      "Your CV matches some important parts of this job, but some requirements are not clearly demonstrated yet.\n\n";

    }

    else {

      message +=
      "Your CV is not currently showing enough evidence for this vacancy. Do not worry — we can improve the structure and highlight your real experience better.\n\n";

    }


    if(missing.length){

      message +=
      "The employer is looking for these areas that are missing or unclear:\n";

      missing
      .slice(0,8)
      .forEach(skill=>{

        message +=
        "• "+titleCase(skill)+"\n";

      });


      message +=
      "\nIf you have real experience with any of these, add the project, tools used, responsibility and result. Do not add skills you have never used.\n\n";

    }


    if(gaps.length){

      message +=
      "Important vacancy points to review:\n";

      gaps
      .slice(0,5)
      .forEach(item=>{

        message +=
        "• "+item+"\n";

      });

      message += "\n";

    }


    if(analysis.score < 80){

      message +=
      "My recommendation: improve your professional summary, add measurable achievements, include relevant tools, and rewrite experience using action results.";

    }

    else {

      message +=
      "Your CV structure is already strong. Focus on tailoring small details for this specific employer.";

    }


    return {

      assistant:"Paul AI",

      score:analysis.score,

      compatibility:
      analysis.vacancyCompatibilityLabel,

      message,

      missingSkills:missing,

      recommendations:analysis.feedback

    };

  },


  /* Human style CV improvement request */

  coach(cv,job){

    const result=this.analyse(cv,job);


    return {

      reply:
      "I have reviewed your application. I will help you improve it step by step while keeping everything truthful.",

      analysis:result

    };

  },


  /* Subscription placeholder
     Connected later to Supabase */

  usageStatus(){

    return {

      freeLimit:2,

      message:
      "Paul AI free users can use the assistant 2 times every month. Subscription users have full access."

    };

  },


  adminAccess(){

    return true;

  }

};/* =========================================================
   PAUL AI ADVANCED JOB SKILL RECOGNITION
   ========================================================= */

const ADVANCED_SKILLS = {

  "excel":[
    "microsoft excel",
    "advanced excel",
    "excel formulas",
    "pivot tables",
    "power query",
    "excel dashboard",
    "data analysis excel",
    "vlookup",
    "xlookup",
    "macros"
  ],

  "data":[
    "data analysis",
    "data reporting",
    "data visualization",
    "statistics",
    "analytics"
  ],

  "office":[
    "microsoft office",
    "word",
    "powerpoint",
    "outlook"
  ]

};



function detectAdvancedSkills(text){

  const lower = norm(text);

  let found=[];


  Object.keys(ADVANCED_SKILLS)
  .forEach(category=>{

    ADVANCED_SKILLS[category]
    .forEach(skill=>{

      if(lower.includes(skill)){

        found.push(skill);

      }

    });

  });


  return unique(found);

}



/* Enhanced vacancy comparison */

function paulVacancyAnalysis(cv,job,role=""){

  const base =
  scoreCVv6(
    cv,
    role,
    job
  );


  const detectedSkills =
  detectAdvancedSkills(cv);



  const requiredSkills =
  detectAdvancedSkills(job);



  const missingAdvanced =
  requiredSkills.filter(
    skill =>
    !detectedSkills.includes(skill)
  );



  let advice=[];



  if(missingAdvanced.length){

    advice.push(
      "The employer requested these technical skills but your CV does not clearly prove them: "
      +
      missingAdvanced.join(", ")
    );

  }



  if(!detectedSkills.length){

    advice.push(
      "Your CV should show specific tools, software and technical abilities instead of only general statements."
    );

  }



  return {

    score:base.score,

    compatibility:
    base.vacancyCompatibilityLabel,


    matched:
    base.matchedKeywords,


    missing:
    base.missingKeywords,


    advancedSkills:
    detectedSkills,


    recommendations:
    [
      ...base.feedback,
      ...advice
    ]

  };

}



/* Attach extra ability to Paul */

PaulAI.jobReview=function(cv,job,role){

  return paulVacancyAnalysis(
    cv,
    job,
    role
  );

};/* =========================================================
   PAUL AI SUBSCRIPTION & ACCESS CONTROL
   Supabase Ready Structure
   ========================================================= */


const PaulAccess = {


  user:{
    id:null,
    email:null,
    role:"user"
  },


  limit:2,


  async checkAccess(){

    /*
      Later connect this function to Supabase:

      Table example:

      paul_usage

      id
      user_id
      month
      usage_count
      subscription_status
      role

    */


    if(this.user.role==="admin"){

      return {
        allowed:true,
        reason:"Admin unlimited access"
      };

    }



    if(this.user.subscription==="active"){

      return {
        allowed:true,
        reason:"Active Paul AI subscriber"
      };

    }



    return {

      allowed:true,

      remaining:this.limit,

      reason:
      "Free Paul AI access"

    };

  },


  async recordUsage(){

    /*
      Supabase update will go here.

      Example:

      increase usage_count by 1

    */

    return true;

  },


  subscriptionMessage(){

    return {

      title:
      "Paul AI Subscription",

      price:
      "₦3,000 per month",

      message:
      "Your free Paul AI reviews have finished. Subscribe to continue unlimited CV reviews."

    };

  }


};



/* Connect Paul AI with access control */


PaulAI.request = async function(
cv,
job,
role
){

  const access =
  await PaulAccess.checkAccess();



  if(!access.allowed){

    return {

      assistant:"Paul AI",

      message:
      "Your Paul AI access has reached its limit. Please subscribe to continue."

    };

  }



  await PaulAccess.recordUsage();



  return this.analyse(
    cv,
    job,
    role
  );

};

/* Paul AI — active CV improvement engine. Uses only evidence already present in the candidate CV. */
function paulImprove(input={}, jobDescription=""){
  const data=Object.assign({},input);
  const clean=s=>String(s||"").replace(/\s+/g," ").trim();
  const splitLines=s=>String(s||"").replace(/\r/g,"").split(/\n+/).map(x=>x.replace(/^\s*[-•▪◦]\s*/,"").trim()).filter(Boolean);
  const existing=String(data.cv||"").trim();
  const experience=splitLines(data.experience);
  const skills=unique((Array.isArray(data.skills)?data.skills:String(data.skills||"").split(/[,;\n]+/)).map(clean).filter(Boolean)).slice(0,30);
  const actionWords=/^(managed|led|developed|created|designed|built|implemented|supported|coordinated|organized|analysed|analyzed|prepared|maintained|trained|supervised|delivered|improved|handled|operated|assisted|produced|installed|repaired|marketed|sold|served|planned|monitored|conducted|provided|worked|responsible)/i;
  const improvedExperience=experience.map(line=>{
    const x=clean(line);
    if(!x || actionWords.test(x) || /^\[/.test(x)) return x;
    if(/^responsible for\b/i.test(x)) return x.replace(/^responsible for\b/i,"Managed");
    if(/^duties include\b/i.test(x)) return x.replace(/^duties include\b/i,"Handled");
    if(/^worked on\b/i.test(x)) return x.replace(/^worked on\b/i,"Worked on");
    return x.charAt(0).toUpperCase()+x.slice(1);
  });
  const role=clean(data.targetRole||data.title||"the target role");
  let summary=clean(data.summary);
  if(!summary || /^\[/.test(summary)){
    summary="Professional with verified experience relevant to "+role+"."+(skills.length?" Key skills include "+skills.slice(0,6).join(", ")+".":"");
  }else{
    summary=summary.replace(/\s+/g," ").trim();
    if(summary.length>420) summary=summary.slice(0,417).replace(/\s+\S*$/,"")+".";
  }
  const cvParts=[data.name||"[Full Name]",data.email||"[Professional Email]",data.phone||"[Phone]",data.location||"", "Target Role: "+role,"","PROFESSIONAL SUMMARY",summary,"","CORE SKILLS",skills.length?skills.map(x=>"• "+x).join("\n"):"[Add verified skills]","","PROFESSIONAL EXPERIENCE",improvedExperience.join("\n")||data.experience||"[Add your verified work experience]","","EDUCATION",data.education||"[Add your verified education]"];
  if(clean(data.certifications))cvParts.push("","CERTIFICATIONS",data.certifications);
  if(clean(data.projects))cvParts.push("","PROJECTS",data.projects);
  const cv=cvParts.join("\n");
  const analysis=scoreCVv6(cv,role,jobDescription||"");
  return Object.assign(data,{cv,summary,skills,experience:improvedExperience.join("\n"),analysis,paulMessage:"Paul improved the CV using only information already present in your CV. No new qualification, employer, job, skill or result was invented."});
}

window.JobSeekPaulImprove=paulImprove;
window.JobSeekSmartCV={version:"smart-cv-v14-stable-import",scoreCV:scoreCVv6,smartFill,buildImprovementPlan,applyImprovementAnswers,coverLetter,applicationEmail,linkedin,titleCase,roleKeywords,extractJobRequirements,parseResumeText,parseResumeText,
PaulAI,
PaulAccess,
paulImprove
};
})();
