"use strict";
const {publicConfigFromEnvironment} = require("../../api/runtime-config");
const mediaPath = require("../../js/website-media-path.js");
const versionFile = /^[1-9]\d*\.(?:jpg|png|webp|pdf|mp4|webm)$/;

module.exports = async function websiteMedia(req,res) {
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Referrer-Policy","no-referrer");
  if (!["GET","HEAD"].includes(req.method)) {
    res.statusCode=405;
    res.setHeader("Allow","GET, HEAD");
    return res.end();
  }
  const id=req.query?.id;
  if (!mediaPath.path(id)) {res.statusCode=404;return res.end();}
  try {
    const config=publicConfigFromEnvironment();
    if (!config) throw new Error("Missing public configuration");
    const {supabaseUrl:base,supabaseAnonKey:key}=config;
    async function post(path,body) {
      const result=await fetch(base+path,{
        method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json"},
        body:JSON.stringify(body),signal:AbortSignal.timeout(6000),redirect:"error"
      });
      if (!result.ok) throw new Error("Media service unavailable");
      return result.json();
    }
    const path=await post("/rest/v1/rpc/published_website_media",{p_id:id});
    if (!path) {res.statusCode=404;return res.end();}
    const [asset,file,...rest]=String(path).split("/");
    if (asset!==id || rest.length || !versionFile.test(file)) throw new Error("Invalid published path");
    const endpoint="/object/sign/website-media/"+path;
    const signed=await post("/storage/v1"+endpoint,{expiresIn:300});
    const url=new URL(signed.signedURL,base);
    if (url.origin!==base || url.pathname!==endpoint || !url.searchParams.has("token")) throw new Error("Invalid media response");
    res.statusCode=307;
    res.setHeader("Location",base+"/storage/v1"+url.pathname+url.search);
    return res.end();
  } catch {res.statusCode=503;return res.end();}
};
