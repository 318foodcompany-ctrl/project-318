"use strict";

const handlers = Object.freeze({
  "website-media": require("../server/api/website-media.js"),
  "landing-page": require("../server/api/landing-page.js"),
  "blog-index": require("../server/api/blog-index.js"),
  "blog-post": require("../server/api/blog-post.js"),
  sitemap: require("../server/api/sitemap.js")
});

module.exports = async function publicContentRouter(req, res) {
  const route = typeof req.query?.route === "string" ? req.query.route : "";
  const handler = Object.hasOwn(handlers,route) && handlers[route];
  if (!handler) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return res.end("Not found");
  }
  return handler(req, res);
};

module.exports.handlers = handlers;
