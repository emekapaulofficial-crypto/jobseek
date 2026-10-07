/* JobSeek CV Importer v2 — accurate PDF reading (text layer + OCR cross-check) */
(function(){
  "use strict";
  var busy=false;
  var PDFJS="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
  var PDFJS_WORKER="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
  var TESS="https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";
  var FIELDS=["name","email","phone","location","title","summary","skills","experience","education","projects","certifications","stateOfOrigin","nationality","languages","dob","maritalStatus","references"];
  function $(id){return document.getElementById(id);}
  function status(msg){var el=$("status");if(el){el.textContent=msg;el.className="muted small";}}
  function pro(){return window.JobSeekCVPro;}
  function normalizeText(text){
    return String(text||"").replace(/\r/g,"").replace(/\u00a0/g," ")
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"")
      .replace(/[ \t]+\n/g,"\n").replace(/\n[ \t]+/g,"\n").replace(/\n{3,}/g,"\n\n").trim();
  }
  function loadScript(src,test,label){
    if(test())return Promise.resolve();
    return new Promise(function(resolve,reject){
      var s=document.createElement("script");s.src=src;
      s.onload=function(){test()?resolve():reject(new Error(label+" did not start."));};
      s.onerror=function(){reject(new Error(label+" could not be loaded. Check your internet connection."));};
      document.head.appendChild(s);
    });
  }
  async function pdfDoc(file){
    await loadScript(PDFJS,function(){return !!window.pdfjsLib;},"PDF reader");
    window.pdfjsLib.GlobalWorkerOptions.workerSrc=PDFJS_WORKER;
    return window.pdfjsLib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
  }

  /* Rebuild real lines from positioned text pieces (not one long run of words). */
  function itemsToLines(items,pageWidth){
    var rows=[];
    items.forEach(function(it){
      if(!it||typeof it.str!=="string"||!it.str.length||!it.transform)return;
      var h=Math.abs(it.transform[3])||it.height||10,x=it.transform[4],y=it.transform[5],w=it.width||0;
      if(!it.str.trim())return;
      var row=null;
      for(var i=0;i<rows.length;i++){if(Math.abs(rows[i].y-y)<=Math.max(2.5,h*0.5)){row=rows[i];break;}}
      if(!row){row={y:y,h:h,items:[]};rows.push(row);}
      row.items.push({x:x,w:w,s:it.str,h:h});
    });
    rows.sort(function(a,b){return b.y-a.y;});
    var built=rows.map(function(r){
      r.items.sort(function(a,b){return a.x-b.x;});
      var segs=[],cur=null,prevEnd=null;
      r.items.forEach(function(it){
        var gap=prevEnd===null?0:it.x-prevEnd;
        if(!cur||gap>it.h*4){cur={x0:it.x,text:"",h:it.h};segs.push(cur);prevEnd=null;gap=0;}
        if(prevEnd!==null&&gap>it.h*0.22&&!/\s$/.test(cur.text)&&!/^\s/.test(it.s))cur.text+=" ";
        cur.text+=it.s;prevEnd=it.x+it.w;
      });
      segs.forEach(function(s){s.text=s.text.replace(/\s+/g," ").trim();});
      return {segs:segs.filter(function(s){return s.text;}),y:r.y};
    }).filter(function(r){return r.segs.length;});
    // two-column layout? (sidebar CVs) read left column fully, then right column
    var W=pageWidth||600,twoCol=built.filter(function(r){return r.segs.length>=2&&r.segs[0].x0<W*0.3&&r.segs[r.segs.length-1].x0>W*0.38;}).length;
    if(built.length>=8&&twoCol/built.length>=0.4){
      var split=W*0.36,left=[],right=[];
      built.forEach(function(r){
        var l=r.segs.filter(function(s){return s.x0<split;}).map(function(s){return s.text;}).join(" ");
        var rr=r.segs.filter(function(s){return s.x0>=split;}).map(function(s){return s.text;}).join(" ");
        if(l)left.push(l);if(rr)right.push(rr);
      });
      return left.concat(right);
    }
    return built.map(function(r){return r.segs.map(function(s){return s.text;}).join(" | ");});
  }
  async function pdfTextLines(file){
    var pdf=await pdfDoc(file),lines=[];
    for(var i=1;i<=pdf.numPages;i++){
      var page=await pdf.getPage(i),vp=page.getViewport({scale:1}),content=await page.getTextContent();
      lines=lines.concat(itemsToLines(content.items||[],vp.width));
    }
    return lines;
  }

  async function ocrPdf(file,maxPages){
    var pdf=await pdfDoc(file);
    await loadScript(TESS,function(){return !!window.Tesseract;},"OCR reader");
    var words=[],text=[],n=Math.min(pdf.numPages,maxPages||3);
    for(var i=1;i<=n;i++){
      status("Double-checking spelling with OCR (page "+i+" of "+n+")…");
      var page=await pdf.getPage(i),vp=page.getViewport({scale:2.2}),canvas=document.createElement("canvas");
      canvas.width=Math.ceil(vp.width);canvas.height=Math.ceil(vp.height);
      var ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);
      await page.render({canvasContext:ctx,viewport:vp}).promise;
      var res=await window.Tesseract.recognize(canvas,"eng",{logger:function(m){
        if(m&&m.status==="recognizing text"&&typeof m.progress==="number")status("Double-checking spelling with OCR (page "+i+" of "+n+") — "+Math.round(m.progress*100)+"%");
      }});
      var d=(res&&res.data)||{};
      text.push(d.text||"");
      if(d.words&&d.words.length)d.words.forEach(function(w){words.push({text:w.text,conf:w.confidence});});
      else String(d.text||"").split(/\s+/).filter(Boolean).forEach(function(w){words.push({text:w,conf:90});});
      canvas.width=1;canvas.height=1;
    }
    var all=text.join("\n");
    return {text:all,words:words,lines:all.split(/\n+/).map(function(x){return x.trim();}).filter(Boolean)};
  }

  /* returns {text, altHeaderLines, fixes, usedOcr} */
  async function readFile(file){
    if(!file)throw new Error("Choose a CV file first.");
    if(/\.txt$/i.test(file.name)||file.type==="text/plain")return {text:normalizeText(await file.text()),altHeaderLines:[],fixes:[],usedOcr:false};
    if(!(/\.pdf$/i.test(file.name)||file.type==="application/pdf"))throw new Error("Only PDF and TXT CV files are supported.");
    status("Reading your PDF…");
    var lines=await pdfTextLines(file),textOk=lines.join("").replace(/\s+/g,"").length>=60,ocr=null,fixes=[];
    try{ocr=await ocrPdf(file,3);}catch(e){console.warn("OCR skipped:",e);ocr=null;}
    if(!textOk){
      if(!ocr||ocr.lines.join("").replace(/\s+/g,"").length<20)throw new Error("This PDF could not be read clearly. Try a clearer file, or paste the CV text into the box.");
      lines=ocr.lines;
    }else if(ocr&&pro()){
      var merged=pro().mergeWithOcr(lines,ocr.words);lines=merged.lines;fixes=merged.fixes;
    }
    return {text:normalizeText(lines.join("\n")),altHeaderLines:ocr?ocr.lines.slice(0,14):[],fixes:fixes,usedOcr:!!ocr};
  }

  function setField(id,v){var el=$(id);if(!el)return;el.value=v||"";el.dispatchEvent(new Event("input",{bubbles:true}));}
  function fill(data,rawText){
    FIELDS.forEach(function(k){setField(k,data[k]);});
    var role=$("role");if(role&&!role.value.trim()&&data.role){role.value=data.role;role.dispatchEvent(new Event("input",{bubbles:true}));}
    var cv=$("cv");
    if(cv&&rawText){cv.value=pro()?pro().stripPlaceholders(rawText,[]).replace(/\n{3,}/g,"\n\n"):rawText;}
    if(window.JobSeekPreview)window.JobSeekPreview();
  }
  function showCheck(data,fixes){
    var box=$("importCheck");if(!box)return;
    var found=[];
    if(data.name)found.push("name");if(data.phone)found.push("phone");if(data.email)found.push("email");if(data.location)found.push("address");
    if(data.summary)found.push("summary");var sk=String(data.skills||"").split(", ").filter(Boolean).length;if(sk)found.push(sk+" skills");
    if(data.experience)found.push("work experience");if(data.education)found.push("education");if(data.languages)found.push("languages");if(data.stateOfOrigin)found.push("state of origin");
    var html="<b>Import check</b><div class=\"ic-ok\">✅ Found: "+found.join(", ")+"</div>";
    if(fixes&&fixes.length){
      var ex=fixes.slice(0,3).map(function(f){return f[0]+" → "+f[1];}).join(", ");
      html+="<div class=\"ic-ok\">✅ Corrected "+fixes.length+" spelling error(s) the PDF reader had missed ("+ex+(fixes.length>3?", …":"")+").</div>";
    }
    (data.warnings||[]).forEach(function(w){html+="<div class=\"ic-warn\">⚠️ "+w.replace(/</g,"&lt;")+"</div>";});
    html+="<div class=\"ic-note\">Please read the fields below once before you download. You are the only one who can confirm every line is true.</div>";
    box.innerHTML=html;box.classList.remove("hidden");
    if(!data.experience){var xb=$("expBuilder");if(xb)xb.open=true;}
  }

  async function importNow(event){
    if(event){event.preventDefault();event.stopPropagation();}
    if(busy)return false;busy=true;
    var button=$("parseCv");
    try{
      if(!pro())throw new Error("CV reader did not load. Refresh the page and try again.");
      if(button){button.disabled=true;button.textContent="Importing CV…";}
      var fileEl=$("file"),cvEl=$("cv"),file=fileEl&&fileEl.files&&fileEl.files.length?fileEl.files[0]:null;
      var read=file?await readFile(file):{text:normalizeText(cvEl?cvEl.value:""),altHeaderLines:[],fixes:[],usedOcr:false};
      if(!read.text)throw new Error("Choose a PDF/TXT CV or paste your CV text first.");
      status("Sorting your CV into sections…");
      var data=pro().parseCV(read.text,{filename:file?file.name:"",altHeaderLines:read.altHeaderLines});
      fill(data,read.text);
      showCheck(data,read.fixes);
      var calc=$("calculateCvStrength");
      if(calc&&typeof calc.click==="function"){calc.click();}
      status("CV imported. Read the Import check below and fix anything marked ⚠️.");
      return true;
    }catch(err){
      console.error("JobSeek CV import:",err);
      status("CV import failed: "+(err&&err.message?err.message:"Please try again."));
      return false;
    }finally{
      busy=false;if(button){button.disabled=false;button.textContent="Import CV & Fill Fields";}
    }
  }
  function clearImportedCV(event){
    if(event){event.preventDefault();event.stopPropagation();}
    ["cv"].concat(FIELDS).forEach(function(id){var el=$(id);if(el)el.value="";});
    var file=$("file");if(file)file.value="";
    var box=$("importCheck");if(box){box.innerHTML="";box.classList.add("hidden");}
    if(window.JobSeekPreview)window.JobSeekPreview();
    status("Imported CV cleared.");
  }
  function bind(){
    var button=$("parseCv"),file=$("file");
    if(!button||!file)return false;
    if(button.dataset.jobseekImportBound==="1")return true;
    button.dataset.jobseekImportBound="1";button.type="button";button.onclick=importNow;
    var clear=$("clearImport");
    if(clear&&clear.dataset.jobseekClearBound!=="1"){clear.dataset.jobseekClearBound="1";clear.type="button";clear.onclick=clearImportedCV;}
    status("Import system ready. Choose a PDF/TXT CV or paste your CV, then press Import CV & Fill Fields.");
    return true;
  }
  window.JobSeekParseStandalone=function(text){return pro()?pro().parseCV(text):{};};
  window.JobSeekImportNow=importNow;
  window.JobSeekImport={importNow:importNow,clear:clearImportedCV,parse:window.JobSeekParseStandalone,itemsToLines:itemsToLines};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",bind);else bind();
})();
