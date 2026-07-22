"use strict";

function json(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}

function bearerToken(request) {
  const header = String(request.headers.authorization || "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function supabaseRequest(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try { body = text ? JSON.parse(text) : null; }
  catch (_error) { body = text; }
  if (!response.ok) {
    const message = body?.message || body?.error_description || body?.error || `Supabase request failed (${response.status}).`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return body;
}

async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    json(response, 405, { error: "Method not allowed." });
    return;
  }

  const supabaseUrl = String(process.env.PUBLIC_SUPABASE_URL || "").trim().replace(/\/$/, "");
  const anonKey = String(process.env.PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const token = bearerToken(request);

  if (!supabaseUrl || !anonKey) {
    json(response, 503, {
      error: "Server-side quote recovery is not configured.",
      code: "QUOTE_RECOVERY_NOT_CONFIGURED"
    });
    return;
  }
  if (!token) {
    json(response, 401, { error: "Authentication required." });
    return;
  }

  try {
    const user = await supabaseRequest(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` }
    });
    if (!user?.id) {
      json(response, 401, { error: "Invalid administrator session." });
      return;
    }

    const isAdmin = await supabaseRequest(`${supabaseUrl}/rest/v1/rpc/crm_is_admin`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: "{}"
    });
    if (isAdmin !== true) {
      json(response, 403, { error: "Administrator access required." });
      return;
    }

    const rows = await supabaseRequest(
      `${supabaseUrl}/rest/v1/leads?select=*&order=created_at.desc&limit=500`,
      {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          Accept: "application/json"
        }
      }
    );

    json(response, 200, {
      quotes: Array.isArray(rows) ? rows : [],
      recovered_at: new Date().toISOString()
    });
  } catch (error) {
    console.error("Server-side quote recovery failed:", error);
    const status = error.status === 401 ? 401 : error.status === 403 ? 403 : 502;
    json(response, status, {
      error: status === 502 ? "Quote recovery failed." : error.message,
      code: "QUOTE_RECOVERY_FAILED"
    });
  }
}

module.exports = handler;
module.exports.bearerToken = bearerToken;
