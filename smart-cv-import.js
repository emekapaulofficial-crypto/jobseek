/* JobSeek CV Importer — single source of truth */
(function(){
  "use strict";

  var busy=false;
  function $(id){return document.getElementById(id);}
  function clean(v){return String(v||"").replace(/\r/g,"").replace(/\u00a0/g," ").trim();}
  function status(msg,ok){
    var el=$("status");
    if(el){el.textContent=msg;el.className=ok?"muted small":"muted small";}
  }

  function normalizeText(text){
    return clean(text)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"")
      .replace(/[ \t]+\n/g,"\n")
      .replace(/\n[ \t]+/g,"\n")
      .replace(/\n{3,}/g,"\n\n")
      .trim();
  }

  function parse(text){
    var t=normalizeText(text);
    var lines=t.split(/\n+/).map(function(x){return x.replace(/^\s*[-•▪◦*]\s*/,"").trim();}).filter(Boolean);
    var out={name:"",email:"",phone:"",location:"",title:"",summary:"",skills:"",experience:"",education:"",projects:"",certifications:""};
    out.email=(t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[""])[0];

    var phoneMatches=t.match(/(?:\+?\d[\d\s().-]{7,}\d)/g)||[];
    out.phone=(phoneMatches.map(function(x){return x.trim();}).find(function(x){
      var n=x.replace(/\D/g,""); return n.length>=9&&n.length<=15;
    })||"");

    var headings={
      summary:/^(profile summary|professional summary|summary|profile|objective)$/i,
      experience:/^(work experience|professional experience|employment|experience|employment history)$/i,
      education:/^(education|academic background|academic history)$/i,
      skills:/^(skills|core skills|technical skills|competencies|core competencies)$/i,
      certifications:/^(certifications?|professional certifications?|licenses?)$/i,
      projects:/^(projects?|selected projects|portfolio)$/i,
      interests:/^(interests?|interests & motivation)$/i,
      additional:/^(additional information|additional details)$/i
    };
    var buckets={summary:[],experience:[],education:[],skills:[],certifications:[],projects:[]};
    var section="";
    lines.forEach(function(line){
      var h=Object.keys(headings).find(function(k){return headings[k].test(line);});
      if(h){section=h;return;}
      var label=line.match(/^(Location|Address|City|Email|Phone|WhatsApp|Mobile)\s*:\s*(.*)$/i);
      if(label){
        var key=label[1].toLowerCase();
        if(/location|address|city/.test(key)) out.location=label[2].trim();
        if(/email/.test(key)&&!out.email) out.email=label[2].trim();
        if(/phone|whatsapp|mobile/.test(key)&&!out.phone) out.phone=label[2].trim();
        return;
      }
      if(section==="summary"||section==="experience"||section==="education"||section==="skills"||section==="certifications"||section==="projects"){
        buckets[section].push(line);
      }
    });

    out.summary=buckets.summary.join("\n");
    out.experience=buckets.experience.join("\n");
    out.education=buckets.education.join("\n");
    out.skills=buckets.skills.join(", ");
    out.projects=buckets.projects.join("\n");
    out.certifications=buckets.certifications.join("\n");

    var headerCandidates=lines.slice(0,8);
    out.name=headerCandidates.find(function(line){
      return line.length>=3&&line.length<=60&&!/@/.test(line)&&!/^\+?\d/.test(line)&&
        !/^(curriculum vitae|resume|cv|profile|professional summary|summary|work experience|professional experience|employment|education|skills|core skills|certifications|projects)$/i.test(line)&&
        !/^(email|phone|mobile|whatsapp|location|address|city)\s*:/i.test(line);
    })||"";

    out.title=headerCandidates.find(function(line){
      return line!==out.name&&line.length<=100&&
        /\b(graphic designer|designer|developer|engineer|manager|analyst|writer|farmer|geologist|accountant|technician|electrician|project manager|product manager|team lead|skilled tradesman|entrepreneur|teacher|administrator|marketing)\b/i.test(line);
    })||"";

    if(!out.location){
      var loc=lines.find(function(line){
        return line!==out.name&&!/@/.test(line)&&
          /\b(nigeria|lagos|abuja|enugu|ekiti|ado ekiti|ibadan|akure|benin|kano|kaduna|port harcourt|warri|delta|ondo)\b/i.test(line);
      });
      if(loc)out.location=loc.replace(/^(location|address|city)\s*:\s*/i,"").trim();
    }

    return out;
  }

  window.JobSeekParseStandalone=parse;

  function fill(data,rawText){
    var fields=["name","email","phone","location","title","summary","skills","experience","education","projects","certifications"];
    fields.forEach(function(k){
      var el=$(k);
      if(el && data[k]){
        el.value=Array.isArray(data[k])?data[k].join(", "):data[k];
        el.dispatchEvent(new Event("input",{bubbles:true}));
      }
    });
    var cv=$("cv");
    if(cv && rawText)cv.value=rawText;
    if(window.JobSeekPreview)window.JobSeekPreview();
  }

  async function loadPdfJs(){
    if(window.pdfjsLib)return window.pdfjsLib;
    await new Promise(function(resolve,reject){
      var s=document.createElement("script");
      s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
      s.onload=resolve;s.onerror=function(){reject(new Error("PDF reader could not be loaded."));};
      document.head.appendChild(s);
    });
    if(!window.pdfjsLib)throw new Error("PDF reader did not initialize.");
    return window.pdfjsLib;
  }

  async function extractPdf(file){
    var pdfjs=await loadPdfJs();
    pdfjs.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    var pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
    var pages=[];
    for(var i=1;i<=pdf.numPages;i++){
      var page=await pdf.getPage(i);
      var content=await page.getTextContent();
      pages.push(content.items.map(function(x){return x.str||"";}).join(" "));
    }
    return normalizeText(pages.join("\n"));
  }

  async function extractFile(file){
    if(!file)throw new Error("Choose a CV file first.");
    if(/\.txt$/i.test(file.name)||file.type==="text/plain")return normalizeText(await file.text());
    if(/\.pdf$/i.test(file.name)||file.type==="application/pdf"){
      var text=await extractPdf(file);
      if(text)return text;
      throw new Error("This PDF appears to be scanned/image-only. Please use a text PDF or paste the CV text.");
    }
    throw new Error("Only PDF and TXT CV files are supported.");
  }

  async function importNow(event){
    if(event){event.preventDefault();event.stopPropagation();}
    if(busy)return false;
    busy=true;
    var button=$("parseCv");
    try{
      if(button){button.disabled=true;button.textContent="Importing CV…";}
      var file=$("file");
      var cv=$("cv");
      status("Reading your CV…",true);
      var text=file&&file.files&&file.files.length?await extractFile(file.files[0]):(cv?normalizeText(cv.value):"");
      if(!text)throw new Error("Choose a PDF/TXT CV or paste your CV text first.");
      if(cv)cv.value=text;
      status("Analysing the CV structure and filling fields…",true);
      var data=(window.JobSeekSmartCV&&typeof window.JobSeekSmartCV.parseResumeText==="function")
        ?window.JobSeekSmartCV.parseResumeText(text)
        :parse(text);
      fill(data,text);
      if(window.JobSeekSmartCV&&typeof window.JobSeekSmartCV.scoreCV==="function"&&document.getElementById("jobDescription")&&document.getElementById("jobDescription").value.trim()){
        var role=$("role")?$("role").value:"";
        window.JobSeekATSResult=window.JobSeekSmartCV.scoreCV(text,role,$("jobDescription").value);
        var calc=document.getElementById("calculateCvStrength");
        if(calc&&typeof calc.click==="function")calc.click();
      }
      status("CV imported successfully. Your candidate fields and live preview have been updated.",true);
      return true;
    }catch(err){
      console.error("JobSeek CV import:",err);
      status("CV import failed: "+(err&&err.message?err.message:"Please try again."),false);
      return false;
    }finally{
      busy=false;
      if(button){button.disabled=false;button.textContent="Import CV & Fill Fields";}
    }
  }

  function clearImportedCV(event){
    if(event){event.preventDefault();event.stopPropagation();}
    ["cv","name","email","phone","location","title","summary","skills","experience","education","projects","certifications"].forEach(function(id){
      var el=$(id);if(el)el.value="";
    });
    var file=$("file");if(file)file.value="";
    if(window.JobSeekPreview)window.JobSeekPreview();
    status("Imported CV cleared.",true);
  }

  function bind(){
    var button=$("parseCv");
    var file=$("file");
    if(!button||!file)return false;
    if(button.dataset.jobseekImportBound==="1")return true;
    button.dataset.jobseekImportBound="1";
    button.type="button";
    button.onclick=importNow;
    var clear=$("clearImport");
    if(clear&&clear.dataset.jobseekClearBound!=="1"){
      clear.dataset.jobseekClearBound="1";
      clear.type="button";
      clear.onclick=clearImportedCV;
    }
    status("Import system ready — choose a PDF/TXT CV or paste your CV, then press Import CV & Fill Fields.",true);
    return true;
  }

  window.JobSeekImportNow=importNow;
  window.JobSeekImport={importNow:importNow,clear:clearImportedCV,parse:parse};

  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);
  else bind();
})();