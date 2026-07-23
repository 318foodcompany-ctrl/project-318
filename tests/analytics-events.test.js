"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const analytics = require("../js/analytics-events.js");

test("normalizes event names safely", () => {
  assert.equal(analytics.eventName("Quote Submitted"), "quote_submitted");
  assert.equal(analytics.eventName("  CTA--CLICK  "), "cta_click");
  assert.equal(analytics.eventName("!"), "site_interaction");
});

test("cleans event properties and removes unsupported values", () => {
  assert.deepEqual(analytics.cleanProperties({
    "link text": "  Request a Quote  ",
    count: 3,
    enabled: true,
    missing: null,
    nested: { unsafe: true }
  }), {
    link_text: "Request a Quote",
    count: 3,
    enabled: true,
    nested: "[object Object]"
  });
});

test("limits text length", () => {
  assert.equal(analytics.safeText(" abc ", 3), "abc");
  assert.equal(analytics.safeText("abcdef", 4), "abcd");
});

test("classifies phone, email, download, directions and CTA links", () => {
  function anchor(href) {
    return { getAttribute(name) { return name === "href" ? href : null; } };
  }
  assert.equal(analytics.linkKind(anchor("tel:3185720137")), "phone_click");
  assert.equal(analytics.linkKind(anchor("mailto:318FoodCompany@gmail.com")), "email_click");
  assert.equal(analytics.linkKind(anchor("/menu.pdf")), "file_download");
  assert.equal(analytics.linkKind(anchor("https://www.google.com/maps/place/example")), "directions_click");
  assert.equal(analytics.linkKind(anchor("quote.html")), "cta_click");
});

test("deduplicates conversion events by stable once key", () => {
  const dispatched = [];
  const document = {
    title: "Quote",
    readyState: "complete",
    documentElement: { scrollHeight: 1000 },
    addEventListener() {},
    querySelectorAll() { return []; }
  };
  const win = {
    document,
    location: { pathname: "/quote-builder.html" },
    innerHeight: 500,
    scrollY: 0,
    crypto: { randomUUID: () => "event-123" },
    Project318Consent: { permits: () => true },
    CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
    addEventListener() {},
    dispatchEvent(event) { dispatched.push(event); }
  };
  const tracker = analytics.createTracker(win);
  assert.equal(tracker.track("quote_submitted", {}, { onceKey: "quote:abc", eventId: "quote-abc" }), true);
  assert.equal(tracker.track("quote_submitted", {}, { onceKey: "quote:abc", eventId: "quote-abc" }), false);
  assert.equal(dispatched.filter(event => event.detail.event === "quote_submitted").length, 1);
  assert.equal(win.dataLayer.filter(event => event.event === "quote_submitted").length, 1);
});
