/* JobSeek Smart CV & Application Engine v1 — LOCKED */
(function(){
'use strict';
const ROLE_KEYWORDS={
'product manager':['product roadmap','prd','agile','scrum','user research','figma','wireframe','jira','mvp','user story','stakeholder','analytics','product lifecycle'],
'developer':['javascript','react','node.js','api','git','github'],
'software developer':['javascript','react','node.js','api','git','github'],
'designer':['figma','ui/ux','prototype','wireframe','adobe'],
'ui/ux designer':['figma','ui/ux','prototype','wireframe','adobe']
};
const ACTIONS=['managed','launched','built','led','increased','designed','achieved','created','developed','implemented','delivered','coordinated','improved','optimized','analysed','analyzed','deployed','automated','supervised'];
const VAGUE=['i can do this and that','am good in all i do','this and that','etc','i can do anything','hardworking','any work','am good','anything','good in all i do'];
const norm=s=>String(s||'').toLowerCase().replace(/\s+/g,' ').trim();
const words=s=>norm(s).match(/[a-z0-9+#./-]+/g)||[];
const unique=a=>[...new Set(a)];
const titleCase=s=>String(s||'').replace(/\b([a-z])/g,m=>m.toUpperCase());
function roleKey(role){const r=norm(role);return ROLE_KEYWORDS[r]?r:(Object.keys(ROLE_KEYWORDS).find(k=>r.includes(k))||r);}
function roleKeywords(role,extra=''){const base=ROLE_KEYWORDS[roleKey(role)]||[];const extras=norm(extra).split(/[,;\n]+/).map(x=>x.trim()).filter(x=>x.length>3).slice(0,20);return unique([...base,...extras]);}
function scoreCV(cvText,targetRole){
 const text=String(cvText||''),lower=norm(text),feedback=[],positives=[];let score=100;
 VAGUE.forEach(p=>{const hits=lower.split(p).length-1;if(hits){score-=20*hits;for(let i=0;i<hits;i++)feedback.push('Avoid vague phrase: "'+p+'"');}});
 [['experience','Professional Experience'],['education','Education'],['professional summary','Professional Summary']].forEach(([n,l])=>{if(!lower.includes(n)){score-=10;feedback.push('Missing '+l);}});
 const wc=words(text).length;if(wc<100){score-=15;feedback.push('CV is under 100 words; add enough professional evidence.');}else if(wc>=150)positives.push('CV has professional length.');
 const nums=text.match(/(?:\b\d+(?:\.\d+)?%?\b|\b\d+[+]?\s*(?:users|customers|clients|months?|years?|people|projects?)\b)/gi)||[];
 if(!nums.length){score-=20;feedback.push('No measurable results — add numbers, percentages, scale or time.');}else positives.push('Measurable evidence detected.');
 const actionHits=ACTIONS.filter(v=>lower.includes(v));if(!actionHits.length){score-=10;feedback.push('Use action verbs such as Managed, Led, Built, Launched, Designed or Achieved.');}else positives.push('Action verbs detected: '+actionHits.slice(0,6).join(', ')+'.');
 if(/\b(?:am|u|wont|won't)\b/i.test(text)){score-=5;feedback.push('Replace slang/informal wording such as "am", "u" or "wont".');}
 const keywords=roleKeywords(targetRole);if(keywords.length){const matched=keywords.filter(k=>lower.includes(k));const pct=matched.length/keywords.length;if(pct<.4){feedback.push('Low keyword match for '+(targetRole||'the target role')+', ATS may reject this CV.');score-=10;}else positives.push('ATS keyword match: '+Math.round(pct*100)+'%.');}
 if(!/\b(?:19|20)\d{2}\b/.test(text)&&lower.includes('experience')){score-=5;feedback.push('Add dates to education and work experience.');}
 const clean=Math.max(0,Math.min(100,score)),level=clean>=80?'STRONG':clean>=50?'AVERAGE':'WEAK';
 return {score:clean,level,feedback:unique(feedback),positives:unique(positives),matchedKeywords:keywords.filter(k=>lower.includes(k)),keywordCoverage:keywords.length?Math.round(keywords.filter(k=>lower.includes(k)).length/keywords.length*100):0,wordCount:wc,applicationEligible:clean>=50};
}
function gapSkills(role){const k=roleKey(role);if(ROLE_KEYWORDS[k]?.length)return ROLE_KEYWORDS[k].slice(0,10).map(titleCase);return ['Communication','Project Coordination','Problem Solving','Stakeholder Management','Research','Documentation','Data Analysis','Microsoft Office','Team Collaboration','Time Management'];}
function professionalExperience(role,location){return '[Product/role-related project or internship] — [Company/Organisation] — [Add Dates] — '+(location||'[Location]')+'\n• Led [project/task] using '+gapSkills(role).slice(0,3).join(', ')+' to support [target outcome].\n• Conducted [research/customer/user] work with [30+ participants/users] and documented findings for stakeholders.\n• Built or improved [project/product/process], achieving [Add measurable result].\n• Coordinated [team/workstream] and tracked delivery using [Tool].';}
function smartFill(input={}){
 const role=input.targetRole||input.title||'Professional',location=input.location||'[City, State]',name=titleCase(input.name||'[Full Name]'),email=input.email||'[Professional Email]',phone=input.phone||'[Phone]';
 const education=input.education||'[Institution Name] — [Qualification / Degree] — [Add Year]';
 const skills=(Array.isArray(input.skills)?input.skills:String(input.skills||'').split(/[,;\n]+/)).map(x=>x.trim()).filter(x=>x&&!VAGUE.includes(norm(x)));
 const finalSkills=unique([...skills,...gapSkills(role)]).slice(0,12);
 const exp=input.experience&&!VAGUE.some(v=>norm(input.experience).includes(v))?input.experience:professionalExperience(role,location);
 const summary=input.summary&&!VAGUE.some(v=>norm(input.summary).includes(v))?input.summary:titleCase(role)+' with a developing professional foundation in '+finalSkills.slice(0,4).join(', ')+'. Brings experience from [projects, internships, academic or professional work] and a focus on delivering measurable results. Prepared to contribute to '+titleCase(role)+' responsibilities through structured problem solving, collaboration and continuous improvement. Based in '+location+'.';
 const guessed=[];if(!input.name)guessed.push('name');if(!input.email)guessed.push('email');if(!input.phone)guessed.push('phone');if(!input.location)guessed.push('location');if(!input.education)guessed.push('education');if(!input.experience||VAGUE.some(v=>norm(input.experience).includes(v)))guessed.push('experience');if(!input.skills||!skills.length)guessed.push('skills');if(!input.summary||VAGUE.some(v=>norm(input.summary).includes(v)))guessed.push('summary');
 const cv=[name,email,phone,location,'Target Role: '+titleCase(role),'','PROFESSIONAL SUMMARY',summary,'','CORE SKILLS',finalSkills.map(s=>'• '+titleCase(s)).join('\n'),'','PROFESSIONAL EXPERIENCE',exp,'','EDUCATION',education,'','CERTIFICATIONS',input.certifications||'[Add relevant certification or "None" if applicable]'].join('\n');
 return {cv,summary,skills:finalSkills,experience:exp,education,guessedFields:guessed};
}
function coverLetter(data={}){const company=data.company||'[Company Name]',manager=data.hiringManager||'[Hiring Manager]',role=data.role||'[Role]',name=data.name||'[Full Name]',skills=(data.skills||[]).slice(0,5).join(', ')||'[relevant skills]';return 'Dear '+manager+',\n\nI am writing to apply for the '+role+' position at '+company+'. I am interested in the opportunity because it aligns with my professional direction and the capabilities I am developing in '+skills+'.\n\nMy background includes '+(data.experience||'[relevant experience, project or internship]')+'. I would bring a practical, organised approach, strong communication and a commitment to measurable results. I have tailored my application to the requirements provided for this role.\n\nI would welcome the opportunity to discuss how my background could support '+company+' and the '+role+' team. Thank you for considering my application.\n\nKind regards,\n'+name;}
function applicationEmail(data={}){const company=data.company||'[Company Name]',role=data.role||'[Role]',name=data.name||'[Full Name]';return 'Subject: Application for '+role+' — '+name+'\n\nDear '+(data.hiringManager||'[Hiring Manager]')+',\n\nPlease find my application for the '+role+' position at '+company+'. I have attached my CV and cover letter for your review.\n\nMy background includes '+(data.experience||'[relevant experience or project]')+', with skills in '+((data.skills||[]).slice(0,6).join(', ')||'[relevant skills]')+'.\n\nThank you for your consideration. I would be pleased to discuss my application further.\n\nKind regards,\n'+name+'\n'+(data.email||'[Professional Email]')+'\n'+(data.phone||'[Phone]');}
function linkedin(data={}){const role=data.role||'[Target Role]',name=data.name||'[Full Name]';return name+' | '+role+'\n\nI am a '+role+' professional building experience across '+((data.skills||[]).slice(0,6).join(', ')||'[relevant skills]')+'. My background includes '+(data.experience||'[professional, academic, project or internship experience]')+'. I enjoy solving practical problems, collaborating with teams and turning requirements into measurable outcomes.\n\nI am open to opportunities where I can contribute, learn and grow in '+role+'.';}
window.JobSeekSmartCV={version:'smart-cv-v1-LOCKED',scoreCV,smartFill,coverLetter,applicationEmail,linkedin,titleCase,roleKeywords};
})();