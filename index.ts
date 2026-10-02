// JobSeek Paul AI - real AI CV improver (Supabase Edge Function)
// Deploy:  supabase functions deploy paul-ai
// Secret:  supabase secrets set ANTHROPIC_API_KEY=your_key_here
// Optional: supabase secrets set PAUL_MODEL=claude-haiku-4-5-20251001   (fast and cheap, default)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "content-type": "application/json" } });

const SYSTEM = `You are Paul, a warm, sharp, human-sounding recruiter who improves CVs.
Work in this order: (1) read the vacancy, (2) read the CV, (3) list what the vacancy wants that the CV does not show, (4) rewrite the CV.
HARD RULES:
- NEVER invent employers, job titles, dates, qualifications, tools, skills, numbers or results.
- You MAY reword the candidate's real experience using the vacancy's own words when the meaning is the same (example: "looked after a team of 12" can become "supervised a team of 12").
- You MAY move the most relevant evidence to the top and tighten weak sentences.
- If the vacancy asks for something the CV does not show, do NOT add it. Put it in "gaps" so the candidate can confirm it.
- Items in "confirmed" were confirmed true by the candidate: add them to skills and use them naturally.
- Keep the CV plain text, ATS friendly, no tables.
Reply with ONE JSON object only, no markdown, no backticks:
{"cv": string (full improved CV as plain text with sections SUMMARY, SKILLS, EXPERIENCE, EDUCATION, plus others if present),
 "summary": string, "skills": string[], "experience": string (bullets separated by newlines),
 "added": string[] (keywords/phrases from the vacancy you made visible because the CV truly supports them),
 "gaps": string[] (max 8 vacancy requirements the CV does not show),
 "message": string (2 friendly sentences to the candidate)}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST required" }, 405);
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) return json({ error: "ANTHROPIC_API_KEY is not set" }, 500);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Bad JSON" }, 400); }
  const cv = String(body.cv || "").slice(0, 20000);
  const vacancy = String(body.vacancy || "").slice(0, 12000);
  if (cv.length < 40 || vacancy.length < 40) return json({ error: "CV and vacancy are required" }, 400);
  const confirmed = Array.isArray(body.confirmed) ? body.confirmed.map(String).slice(0, 30) : [];

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: Deno.env.get("PAUL_MODEL") || "claude-haiku-4-5-20251001",
      max_tokens: 3000,
      system: SYSTEM,
      messages: [{ role: "user", content: `TARGET ROLE: ${body.role || ""}\n\nVACANCY:\n${vacancy}\n\nCV:\n${cv}\n\nCONFIRMED TRUE BY CANDIDATE: ${JSON.stringify(confirmed)}` }],
    }),
  });
  if (!r.ok) return json({ error: "AI error " + r.status }, 502);
  const data = await r.json();
  const text = (data.content || []).map((c: any) => c.text || "").join("").replace(/```json|```/g, "").trim();
  try {
    const out = JSON.parse(text);
    if (!out.cv) throw new Error("no cv");
    return json(out);
  } catch {
    return json({ error: "AI returned an unreadable answer" }, 502);
  }
});
