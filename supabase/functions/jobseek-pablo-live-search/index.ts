import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SOURCES = [
  {name:"RemoteOK", url:"https://remoteok.com/api", type:"json"},
  {name:"Remotive", url:"https://remotive.com/api/remote-jobs?limit=200", type:"json"}
];

const clean=(v)=>String(v??"").replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
const scam=/\b(pay\s+to\s+apply|registration\s+fee|processing\s+fee|buy\s+equipment|crypto\s+payment|gift\s+card|western\s+union|telegram\s+only|whatsapp\s+only|guaranteed\s+income)\b/i;
const parseDate=(v)=>{
  if(!v) return null;
  const d=new Date(v);
  return Number.isNaN(d.getTime())?null:d;
};

async function get(url){
  const r=await fetch(url,{headers:{"User-Agent":"JobSeek-Pablo-Live-Research/1.0","Accept":"application/json,text/plain,*/*"}});
  if(!r.ok) throw new Error("HTTP "+r.status);
  return {data:await r.json(),finalUrl:r.url};
}

function matches(j,q){
  const hay=[j.title,j.company,j.location,j.description,j.category,j.country].map(clean).join(" ").toLowerCase();
  return !q || hay.includes(q.toLowerCase());
}

function normalizeRemoteOK(x){
  return {title:clean(x.position),company:clean(x.company),location:clean(x.location)||"Remote",
    description:clean(x.description),url:clean(x.url)||("https://remoteok.com/"+clean(x.slug)),
    posted_at:x.date,source:"RemoteOK"};
}
function normalizeRemotive(x){
  return {title:clean(x.title),company:clean(x.company_name),location:clean(x.candidate_required_location)||"Remote",
    description:clean(x.description),url:clean(x.url),posted_at:x.publication_date,source:"Remotive"};
}

Deno.serve(async (req)=>{
  if(req.method!=="POST") return new Response(JSON.stringify({error:"POST required"}),{status:405,headers:{"content-type":"application/json"}});
  try{
    const body=await req.json();
    const country=clean(body.country), query=clean(body.job_type||body.keyword);
    const now=Date.now(), maxAge=3*86400000;
    const all=[];
    for(const s of SOURCES){
      try{
        const {data}=await get(s.url);
        const rows=s.name==="RemoteOK"
          ? (Array.isArray(data)?data.filter(x=>x&&x.position).map(normalizeRemoteOK):[])
          : ((data.jobs||[]).map(normalizeRemotive));
        all.push(...rows);
      }catch(_){}
    }
    let results=all.filter(j=>{
      const d=parseDate(j.posted_at);
      if(!d || now-d.getTime()>maxAge || d.getTime()>now) return false;
      if(scam.test([j.title,j.company,j.description,j.url].join(" "))) return false;
      return matches(j,query) && (!country || [j.location,j.description].join(" ").toLowerCase().includes(country.toLowerCase()));
    });
    const requestedFound=results.length>0;
    let fallbackCountry=null;
    if(!results.length && country){
      results=all.filter(j=>{
        const d=parseDate(j.posted_at);
        if(!d || now-d.getTime()>maxAge || d.getTime()>now) return false;
        if(scam.test([j.title,j.company,j.description,j.url].join(" "))) return false;
        return matches(j,query);
      });
      if(results.length) fallbackCountry="Other countries with fresh matches";
    }
    const checked=[];
    for(const j of results.slice(0,30)){
      try{
        const r=await fetch(j.url,{method:"HEAD",redirect:"follow",headers:{"User-Agent":"JobSeek-Pablo-Live-Research/1.0"}});
        if(r.ok && r.status<400) checked.push({...j,apply_url:r.url,apply_url_status:r.status,verified_by_pablo:true});
      }catch(_){}
    }
    return new Response(JSON.stringify({
      agent:"Pablo",visibility:"ADMIN_ONLY",freshness_days:3,
      requested_country:country||null,requested_found:requestedFound,fallback_country:fallbackCountry,
      researched_at:new Date().toISOString(),count:checked.length,jobs:checked
    }),{headers:{"content-type":"application/json","cache-control":"no-store"}});
  }catch(e){
    return new Response(JSON.stringify({error:String(e)}),{status:500,headers:{"content-type":"application/json"}});
  }
});
