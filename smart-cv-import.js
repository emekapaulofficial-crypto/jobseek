(function(){

"use strict";

function $(id){
 return document.getElementById(id);
}


function msg(text,good){

let s=$("status");

if(s){
s.textContent=text;
s.className=good?"muted small success":"muted small danger";
}

}


function fill(data){

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

].forEach(function(k){

let el=$(k);

if(el && data[k]){

el.value=data[k];

el.dispatchEvent(
new Event("input",{bubbles:true})
);

}

});


if(window.JobSeekPreview){
window.JobSeekPreview();
}

}


function simpleParse(text){

let d={
name:"",
email:"",
phone:"",
location:"",
title:"",
summary:"",
skills:"",
experience:"",
education:"",
projects:"",
certifications:""
};


d.email=(text.match(/[^\s]+@[^\s]+/i)||[""])[0];

d.phone=(text.match(/\+?\d[\d\s-]{7,}/)||[""])[0];


let lines=text
.split("\n")
.map(x=>x.trim())
.filter(Boolean);


d.name=lines[0]||"";


let sections={
summary:[],
experience:[],
education:[],
skills:[]
};


let current="";


lines.forEach(function(x){

let l=x.toLowerCase();


if(l.includes("summary")){
current="summary";
return;
}

if(l.includes("experience")){
current="experience";
return;
}

if(l.includes("education")){
current="education";
return;
}

if(l.includes("skills")){
current="skills";
return;
}


if(current){
sections[current].push(x);
}

});


d.summary=sections.summary.join("\n");
d.experience=sections.experience.join("\n");
d.education=sections.education.join("\n");
d.skills=sections.skills.join(", ");


let title=lines.find(x=>
/designer|developer|engineer|manager|analyst|writer|farmer/i.test(x)
);

if(title)d.title=title;


let loc=lines.find(x=>
/nigeria|lagos|abuja|enugu|ekiti|ibadan/i.test(x)
);

if(loc)d.location=loc;


return d;

}



async function startImport(){

let file=$("file");

let cv=$("cv");

let text="";


try{


if(file.files.length){

let f=file.files[0];


if(f.type==="text/plain"){

text=await f.text();

}else{


let pdfjs=window.pdfjsLib;


if(!pdfjs){

await new Promise((resolve,reject)=>{

let s=document.createElement("script");

s.src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";

s.onload=resolve;

s.onerror=reject;

document.head.appendChild(s);

});


}


let pdf=await pdfjsLib.getDocument({

data:new Uint8Array(
await f.arrayBuffer()
)

}).promise;


for(let i=1;i<=pdf.numPages;i++){

let page=await pdf.getPage(i);

let c=await page.getTextContent();

text+=c.items.map(x=>x.str).join(" ")+"\n";

}

}


}else{

text=cv.value;

}



if(!text.trim()){

msg("Please select a CV first.",false);

return;

}


cv.value=text;


let data=simpleParse(text);


fill(data);


msg(
"CV imported successfully and preview updated.",
true
);



}catch(e){

msg(
"Import error: "+e.message,
false
);

}


}



function init(){

let button=$("parseCv");


if(button){

button.onclick=function(e){

e.preventDefault();

startImport();

};

}


}


if(document.readyState==="loading"){

document.addEventListener(
"DOMContentLoaded",
init
);

}else{

init();

}


})();
