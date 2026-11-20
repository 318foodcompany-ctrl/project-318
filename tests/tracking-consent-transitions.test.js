"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { linkDestination } = require("../js/analytics-events.js");

for (const [name, field, id, command] of [
  ["ga4", "ga4MeasurementId", "G-ABC12345", "gtag"],
  ["meta-pixel", "metaPixelId", "123456789", "fbq"]
]) {
  test(name + " discards pending events on withdrawal and resumes after a new grant", async () => {
    let allowed = true;
    let script;
    const calls = [];
    const listeners = {};
    const win = {
      location: { pathname: "/" },
      document: { getElementById: () => script, createElement: () => ({ dataset: {} }), head: { appendChild(node) { script = node; } } },
      __APP_CONFIG__: { [field]: id },
      Project318Consent: { permits: () => allowed },
      addEventListener(type, fn) { listeners[type] = fn; },
      [command](...args) { calls.push(args); }
    };
    const provider = require("../js/" + name + "-provider.js").createProvider(win);
    const send = provider.send({ event: "quote_started", event_id: "before" });
    allowed = false;
    listeners["318:consent-changed"]({});
    script.onload();
    assert.equal(await send, false);
    assert.equal(calls.some(([type]) => ["config", "init", "track", "event"].includes(type)), false);
    allowed = true;
    listeners["318:consent-changed"]({});
    assert.equal(await provider.send({ event: "quote_started", event_id: "after" }), true);
  });
}

test("contact addresses and query or fragment values stay out of tracked destinations", () => {
  const base = "https://example.org/";
  assert.equal(linkDestination("mailto:owner@example.org?subject=event", base), "mailto:");
  assert.equal(linkDestination("tel:+123456789", base), "tel:");
  assert.equal(linkDestination("/menu.pdf?signature=private#location", base), base + "menu.pdf");
  assert.equal(linkDestination("javascript:void(0)", base), "");
});

test("GA4 sends one page view when consent changes twice during script loading", async () => {
  let analytics = false;
  let script;
  let consentChanged;
  const events = [];
  const win = {
    document: { getElementById: () => script, createElement: () => ({ dataset: {} }), head: { appendChild(node) { script = node; } } },
    __APP_CONFIG__: { ga4MeasurementId: "G-TEST12345" },
    Project318Consent: { permits: () => analytics },
    addEventListener(name, callback) { if (name === "318:consent-changed") consentChanged = callback; },
    gtag(type, event) { if (type === "event") events.push(event); }
  };
  require("../js/ga4-provider.js").createProvider(win);
  analytics = true;
  const originalGrant = consentChanged();
  analytics = false;
  consentChanged();
  analytics = true;
  const finalGrant = consentChanged();
  script.onload();
  await Promise.all([originalGrant, finalGrant]);
  assert.deepEqual(events, ["page_view"]);
});
