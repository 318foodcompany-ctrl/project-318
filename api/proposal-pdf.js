"use strict";

function sendJson(res, status, payload) {
  res.statusCode=status; res.setHeader("Content-Type","application/json; charset=utf-8");
  res.setHeader("Cache-Control","no-store"); res.end(JSON.stringify(payload));
}
async function request(url, options={}) {
  const response=await fetch(url,options);const text=await response.text();let body;
  try{body=text?JSON.parse(text):null;}catch(_error){body=text;}
  if(!response.ok)throw new Error(body?.message||body?.error||`Database request failed (${response.status}).`);
  return body;
}
function clean(value) { return String(value??"").replace(/[^\x20-\x7E]/g," ").replace(/[()\\]/g,"\\$&").slice(0,180); }
function pdf(lines) {
  const content=["BT","/F1 20 Tf","54 742 Td",`(${clean(lines.shift())}) Tj`,"/F1 10 Tf"];
  lines.forEach(line=>content.push("0 -18 Td",`(${clean(line)}) Tj`));content.push("ET");
  const stream=content.join("\n");const objects=[
    "<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];let output="%PDF-1.4\n",offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(output));output+=`${i+1} 0 obj\n${obj}\nendobj\n`;});
  const xref=Buffer.byteLength(output);output+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`;offsets.slice(1).forEach(o=>output+=`${String(o).padStart(10,"0")} 00000 n \n`);
  output+=`trailer << /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;return Buffer.from(output);
}
async function handler(req,res) {
  if(req.method!=="GET"){res.setHeader("Allow","GET");return sendJson(res,405,{error:"Method not allowed."});}
  const base=String(process.env.PUBLIC_SUPABASE_URL||"").replace(/\/$/,""),anon=String(process.env.PUBLIC_SUPABASE_ANON_KEY||""),service=String(process.env.SUPABASE_SERVICE_ROLE_KEY||"");
  const id=String(req.query?.id||"");if(!base||!anon||!service)return sendJson(res,503,{error:"Proposal PDF service is not configured."});
  try {
    let authorized=false;
    const bearer=String(req.headers.authorization||"").replace(/^Bearer\s+/,"");
    if(bearer){const admin=await request(`${base}/rest/v1/rpc/crm_is_admin`,{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${bearer}`,"Content-Type":"application/json"},body:"{}"});authorized=admin===true;}
    const portalToken=String(req.headers["x-portal-token"]||"");
    if(portalToken){const snap=await request(`${base}/rest/v1/rpc/sales_portal_snapshot`,{method:"POST",headers:{apikey:anon,Authorization:`Bearer ${anon}`,"Content-Type":"application/json"},body:JSON.stringify({p_token:portalToken})});authorized=(snap.proposals||[]).some(p=>p.id===id);}
    if(!authorized)return sendJson(res,403,{error:"Access denied."});
    const headers={apikey:service,Authorization:`Bearer ${service}`};
    const proposals=await request(`${base}/rest/v1/proposals?id=eq.${encodeURIComponent(id)}&select=*,customers(first_name,last_name,company)`,{headers});
    if(proposals.length!==1)return sendJson(res,404,{error:"Proposal not found."});const p=proposals[0];
    const versions=await request(`${base}/rest/v1/proposal_versions?proposal_id=eq.${id}&order=version_number.desc&limit=1`,{headers});const v=versions[0];
    const items=await request(`${base}/rest/v1/proposal_line_items?version_id=eq.${v.id}&order=position`,{headers});
    const customer=p.customers.company||`${p.customers.first_name} ${p.customers.last_name}`.trim();
    const lines=["318 FOOD CO. CATERING PROPOSAL",p.title,`Prepared for: ${customer}`,`Expires: ${p.expiration_date||"When confirmed"}`,"",...items.map(i=>`${i.description}  ${i.quantity} x $${Number(i.unit_price).toFixed(2)}  $${Number(i.line_total).toFixed(2)}`),"",`Subtotal: $${Number(v.subtotal).toFixed(2)}`,`Discount: $${Number(v.discount_amount).toFixed(2)}`,`Tax: $${Number(v.tax_amount).toFixed(2)}`,`TOTAL: $${Number(v.total_amount).toFixed(2)}`];
    const output=pdf(lines);res.statusCode=200;res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",`attachment; filename="318-proposal-${id.slice(0,8)}.pdf"`);res.setHeader("Cache-Control","private, no-store");res.end(output);
  } catch(error){sendJson(res,500,{error:"Could not generate proposal PDF."});}
}
module.exports=handler;module.exports.pdf=pdf;
