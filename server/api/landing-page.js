"use strict";
const { render } = require("../../js/landing-page-template.js");
module.exports = async function(req,res) {
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Content-Type","text/html; charset=utf-8");
  if (!["GET","HEAD"].includes(req.method)) { res.setHeader("Allow","GET, HEAD"); res.statusCode=405; return res.end(); }
  const slug=req.query?.slug;
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length>80) { res.statusCode=404; return res.end("Page unavailable"); }
  try {
    const key=process.env.PUBLIC_SUPABASE_ANON_KEY;
    const base=String(process.env.PUBLIC_SUPABASE_URL || "").replace(/\/$/,"");
    const response=await fetch(base+"/rest/v1/rpc/read_landing_page",{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},body:JSON.stringify({p_slug:slug}),signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error("Page lookup unavailable");
    const page=await response.json();
    if (!page) { res.statusCode=404; return res.end(req.method==="HEAD" ? "" : 'Page unavailable. <a href="/">Return to 318 Food Co.</a>'); }
    res.statusCode=200;
    return res.end(req.method==="HEAD" ? "" : render(page,slug,true));
  } catch { res.statusCode=503; return res.end("Page temporarily unavailable."); }
};
