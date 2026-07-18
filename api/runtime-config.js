"use strict";

const SUPABASE_HOST_PATTERN = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i;

function publicConfigFromEnvironment(environment = process.env) {
  const supabaseUrl = String(environment.PUBLIC_SUPABASE_URL || "").trim();
  const supabaseAnonKey = String(environment.PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!SUPABASE_HOST_PATTERN.test(supabaseUrl) || !supabaseAnonKey) {
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    supabaseAnonKey
  };
}

function handler(request, response) {
  const config = publicConfigFromEnvironment();

  response.setHeader("Content-Type", "application/javascript; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");

  if (!config) {
    response.statusCode = 503;
    response.end(
      "window.__APP_CONFIG_ERROR__ = " +
        JSON.stringify("Website configuration is unavailable.") +
        ";"
    );
    return;
  }

  response.statusCode = 200;
  response.end(`window.__APP_CONFIG__ = ${JSON.stringify(config)};`);
}

module.exports = handler;
module.exports.publicConfigFromEnvironment = publicConfigFromEnvironment;
