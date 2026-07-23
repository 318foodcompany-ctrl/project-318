"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const readiness = require("../js/admin-launch-readiness.js");

test("validates analytics identifiers", () => {
  assert.equal(readiness.validGa4("G-ABC12345"), true);
  assert.equal(readiness.validGa4("UA-123"), false);
  assert.equal(readiness.validMeta("1234567890"), true);
  assert.equal(readiness.validMeta("pixel-123"), false);
});

test("summarizes launch checks and calculates readiness score", () => {
  const summary = readiness.summarizeChecks([
    readiness.result("one", "One", "ready", "ok"),
    readiness.result("two", "Two", "ready", "ok"),
    readiness.result("three", "Three", "warning", "attention"),
    readiness.result("four", "Four", "blocked", "blocked")
  ]);
  assert.deepEqual(summary, { total: 4, ready: 2, warning: 1, blocked: 1 });
  assert.equal(readiness.score(summary), 50);
});

test("normalizes contact text for production checks", () => {
  const normalized = readiness.normalizedText("Call (318) 572-0137 or 318FoodCompany@gmail.com");
  assert.match(normalized, /3185720137/);
  assert.match(normalized, /318foodcompany@gmailcom/);
});

test("persists account-owner confirmations without credentials", () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
  readiness.writeOwnerActions(storage, { sitemap: true });
  assert.deepEqual(readiness.readOwnerActions(storage), { sitemap: true });
  assert.equal(readiness.OWNER_ACTIONS.length, 7);
});
