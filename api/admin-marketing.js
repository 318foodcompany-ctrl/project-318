"use strict";

const handlers = Object.freeze({
  assistant: require("../server/api/admin-marketing-assistant.js"),
  "autopilot-action": require("../server/api/admin-marketing-autopilot-action.js"),
  "autopilot-bulk": require("../server/api/admin-marketing-autopilot-bulk.js"),
  "autopilot-executive": require("../server/api/admin-marketing-autopilot-executive.js"),
  "autopilot-learning": require("../server/api/admin-marketing-autopilot-learning.js"),
  "autopilot-publish": require("../server/api/admin-marketing-autopilot-publish.js"),
  "autopilot-queue": require("../server/api/admin-marketing-autopilot-queue.js"),
  "autopilot-run-now": require("../server/api/admin-marketing-autopilot-run-now.js"),
  content: require("../server/api/admin-marketing-content.js"),
  "test-email": require("../server/api/admin-marketing-test-email.js")
});

module.exports = async function adminMarketingRouter(req, res) {
  const route = typeof req.query?.route === "string" ? req.query.route : "";
  const handler = handlers[route];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    return res.end(JSON.stringify({ error: "Unknown marketing API route." }));
  }
  return handler(req, res);
};

module.exports.handlers = handlers;

