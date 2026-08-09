"use strict";

const handlers = Object.freeze({
  "blog-index": require("../server/api/blog-index.js"),
  "blog-post": require("../server/api/blog-post.js"),
  sitemap: require("../server/api/sitemap.js")
});

module.exports = async function publicContentRouter(req, res) {
  const route = typeof req.query?.route === "string" ? req.query.route : "";
  const handler = handlers[route];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Not found");
  }
  return handler(req, res);
};

module.exports.handlers = handlers;
