const assert = require("node:assert/strict");
const {
  DEFAULT_START_TIME,
  DEFAULT_END_TIME,
  normalizeQuoteTime,
  safeQuoteTimeRange
} = require("../js/booking-time.js");

assert.equal(normalizeQuoteTime("18:00"), "18:00", "accepts 24-hour time");
assert.equal(normalizeQuoteTime("6:00 PM"), "18:00", "accepts AM/PM with minutes");
assert.equal(normalizeQuoteTime("6 PM"), "18:00", "accepts AM/PM without minutes");
assert.equal(normalizeQuoteTime("6:30 pm"), "18:30", "accepts lowercase AM/PM");
assert.equal(normalizeQuoteTime("TBD"), null, "rejects invalid free-form time");
assert.equal(normalizeQuoteTime("around noon"), null, "rejects ambiguous free-form time");
assert.equal(normalizeQuoteTime(""), null, "handles missing time");

assert.deepEqual(
  safeQuoteTimeRange("6:30 pm"),
  { start: "18:30", end: "20:30", usedDefault: false },
  "calculates a valid two-hour range"
);

assert.deepEqual(
  safeQuoteTimeRange("TBD"),
  { start: DEFAULT_START_TIME, end: DEFAULT_END_TIME, usedDefault: true },
  "uses safe defaults for invalid values"
);

assert.deepEqual(
  safeQuoteTimeRange(),
  { start: DEFAULT_START_TIME, end: DEFAULT_END_TIME, usedDefault: true },
  "uses safe defaults when time is missing"
);

assert.deepEqual(
  safeQuoteTimeRange("11:30 PM"),
  { start: DEFAULT_START_TIME, end: DEFAULT_END_TIME, usedDefault: true },
  "avoids an invalid same-day range near midnight"
);

assert.deepEqual(
  safeQuoteTimeRange("21:30"),
  { start: "21:30", end: "23:30", usedDefault: false },
  "retains a valid late-evening same-day range"
);

console.log("booking-time tests passed");
