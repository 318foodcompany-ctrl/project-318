"use strict";

const SUPABASE_HOST_PATTERN = /^https:\/\/[a-z0-9]+\.supabase\.co\/?$/i;
const GA4_MEASUREMENT_PATTERN = /^G-[A-Z0-9]{6,20}$/;

function publicConfigFromEnvironment(environment = process.env) {
  const supabaseUrl = String(environment.PUBLIC_SUPABASE_URL || "").trim();
  const supabaseAnonKey = String(environment.PUBLIC_SUPABASE_ANON_KEY || "").trim();
  const ga4MeasurementId = String(environment.PUBLIC_GA4_MEASUREMENT_ID || "").trim().toUpperCase();

  if (!SUPABASE_HOST_PATTERN.test(supabaseUrl) || !supabaseAnonKey) {
    return null;
  }

  const config = {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    supabaseAnonKey
  };

  if (GA4_MEASUREMENT_PATTERN.test(ga4MeasurementId)) {
    config.ga4MeasurementId = ga4MeasurementId;
  }

  return config;
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
module.exports.GA4_MEASUREMENT_PATTERN = GA4_MEASUREMENT_PATTERN;
