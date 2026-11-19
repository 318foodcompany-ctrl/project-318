"use strict";

const { adminContext } = require("./admin-marketing-autopilot-action.js");
const analytics = require("../google-analytics.js");

function reply(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(payload));
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return reply(response, 405, { error: "Method not allowed." });
  }
  try {
    await adminContext(request);
    const report = await analytics.dashboard(process.env);
    return reply(response, 200, { ok: true, report });
  } catch (error) {
    console.error("Google Analytics dashboard failed.", { message: error.message });
    const status = [401, 403].includes(error.status) ? error.status : 502;
    return reply(response, status, { error: status < 500 ? error.message : "Google Analytics data could not be loaded." });
  }
};
