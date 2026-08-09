Exit code: 0
Wall time: 1.2 seconds
Output:
"use strict";
const { adminContext }=require("./admin-marketing-autopilot-action.js");
const runAutopilot=require("../../api/marketing-autopilot-run.js");

function reply(res,status,payload){res.statusCode=status;res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("Cache-Control","no-store");res.end(JSON.stringify(payload));}

module.exports=async function handler(req,res){
  if(req.method!=="POST"){res.setHeader("Allow","POST");return reply(res,405,{error:"Method not allowed."});}
  try{
    await adminContext(req);
    const secret=String(process.env.AI_AUTOPILOT_CRON_SECRET||process.env.CRON_SECRET||process.env.FOLLOW_UP_CRON_SECRET||"");
    if(secret.length<32)return reply(res,503,{error:"AI Autopilot scheduler is not configured."});
    return runAutopilot({...req,method:"POST",headers:{...req.headers,authorization:`Bearer ${secret}`}},res);
  }catch(error){
    const status=[400,401,403].includes(error.status)?error.status:500;
    return reply(res,status,{error:status<500?error.message:"AI drafts could not be generated."});
  }
};

