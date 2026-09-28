/* JobSeek CV Import Engine - Single Importer
   Handles PDF, TXT and pasted CV text.
   Designed to work with smart-cv.html only.
*/

(function () {
"use strict";

let importing = false;

const $ = id => document.getElementById(id);

function setStatus(msg, good = false){
    const el = $("status");
    if(!el) return;
    el.textContent = msg;
    el.className = good ? "muted small success" : "muted small danger";
}

function cleanText(v){
    return String(v || "")
        .replace(/\r/g,"")
        .replace(/\*\*/g,"")
        .trim();
}


function parseCV(text){

    let t = cleanText(text);

    let data = {
        name:"",
        email:"",
        phone:"",
        location:"",
        title:"",
        summary:"",
        skills:"",
        experience:"",
        education:"",
        certifications:"",
        projects:""
    };


    data.email =
    (t.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)||[""])[0];


    data.phone =
    (t.match(/(?:\+?\d[\d\s().-]{7,}\d)/)||[""])[0];


    let lines=t.split("\n")
    .map(x=>x.trim())
    .filter(Boolean);


    let sections={
        summary:[],
        experience:[],
        education:[],
        skills:[],
        certifications:[],
        projects:[]
    };


    let current="";


    lines.forEach(line=>{

        let heading=line.toLowerCase();


        if(/professional summary|summary|profile/.test(heading)){
            current="summary";
            return;
        }

        if(/work experience|professional experience|employment|experience/.test(heading)){
            current="experience";
            return;
        }

        if(/education|academic/.test(heading)){
            current="education";
            return;
        }

        if(/skills|technical skills|core skills/.test(heading)){
            current="skills";
            return;
        }

        if(/certification|license/.test(heading)){
            current="certifications";
            return;
        }

        if(/project|portfolio/.test(heading)){
            current="projects";
            return;
        }


        if(current){
            sections[current].push(line);
        }

    });


    data.summary=sections.summary.join("\n");
    data.experience=sections.experience.join("\n");
    data.education=sections.education.join("\n");
    data.skills=sections.skills.join(", ");
    data.certifications=sections.certifications.join("\n");
    data.projects=sections.projects.join("\n");


    // Name detection
    for(let line of lines){

        if(
            line.length>2 &&
            line.length<50 &&
            !line.includes("@") &&
            !/\d/.test(line) &&
            !/summary|experience|education|skills|certification/i.test(line)
        ){
            data.name=line;
            break;
        }
    }


    // Location
    let loc=lines.find(x=>
        /nigeria|lagos|abuja|enugu|ado ekiti|akure|ibadan/i.test(x)
    );

    if(loc){
        data.location=loc;
    }


    // Title
    let title=lines.find(x=>
        /designer|developer|engineer|manager|writer|farmer|analyst|technician/i.test(x)
    );

    if(title){
        data.title=title;
    }


    return data;

}



function fillFields(data){

[
"name",
"email",
"phone",
"location",
"title",
"summary",
"skills",
"experience",
"education",
"projects",
"certifications"

].forEach(key=>{

let el=$(key);

if(el && data[key]){

el.value=data[key];

el.dispatchEvent(
new Event("input",{bubbles:true})
);

}

});


if(window.JobSeekPreview){
    window.JobSeekPreview();
}


}



async function readFile(file){

if(file.type==="text/plain" || file.name.endsWith(".txt")){
    return await file.text();
}


if(file.type==="application/pdf" || file.name.endsWith(".pdf")){

if(!window.pdfjsLib){

await new Promise((resolve,reject)=>{

let s=document.createElement("script");

s.src=
"https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";

s.onload=resolve;

s.onerror=reject;

document.head.appendChild(s);

});

}


let pdf=await pdfjsLib.getDocument({
data:new Uint8Array(await file.arrayBuffer())
}).promise;


let result="";


for(let i=1;i<=pdf.numPages;i++){

let page=await pdf.getPage(i);

let content=await page.getTextContent();

result += content.items
.map(x=>x.str)
.join(" ")
+"\n";

}


if(result.trim()) return result;


throw new Error(
"Scanned PDF detected. Please use a text PDF or paste the CV."
);


}


throw new Error("Only PDF and TXT files are supported.");

}



async function importCV(){

if(importing)return;

importing=true;


try{


let fileInput=$("file");
let textArea=$("cv");


let text="";


if(fileInput.files.length){

setStatus("Reading CV file...",true);

text=await readFile(fileInput.files[0]);


}else if(textArea.value.trim()){

text=textArea.value;


}else{

throw new Error(
"Choose a CV file or paste CV text first."
);

}


$("cv").value=text;


let data=parseCV(text);


fillFields(data);


setStatus(
"CV imported successfully. Fields and live preview updated.",
true
);


}catch(e){

setStatus(
"Import failed: "+e.message,
false
);


}


importing=false;

}



function start(){


let btn=$("parseCv");


if(btn){

btn.onclick=function(e){

e.preventDefault();

importCV();

};

}


let clear=$("clearImport");


if(clear){

clear.onclick=function(){

[
"cv",
"name",
"email",
"phone",
"location",
"title",
"summary",
"skills",
"experience",
"education",
"projects",
"certifications"

].forEach(id=>{

let el=$(id);

if(el) el.value="";

});


if(window.JobSeekPreview)
window.JobSeekPreview();


setStatus("CV cleared.",true);

};

}


}


if(document.readyState==="loading"){

document.addEventListener(
"DOMContentLoaded",
start
);

}else{

start();

}


})();
