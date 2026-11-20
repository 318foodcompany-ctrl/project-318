"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { estimate } = require("../js/quote-estimate.js");
test("quote simulator and live planner use integer cents and distinguish per-guest and flat fees", () => {
  assert.equal(estimate(25,15,[15.99,2],[75]),524.75);
  assert.equal(estimate(25,15,[16.99,2],[75]),549.75);
  assert.equal(estimate(15,15,[0.1,0.2],[]),4.5);
  assert.throws(() => estimate(14,15,[10],[]), /whole guest count/);
  assert.throws(() => estimate(25.5,15,[10],[]), /whole guest count/);
  assert.throws(() => estimate(25,15,[-1],[]), /rate/);
});
