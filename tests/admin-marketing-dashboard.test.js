const fs = require("fs");
const path = require("path");
const assert = require("assert");

const root = path.resolve(__dirname, "..");
const dashboard = fs.readFileSync(path.join(root, "js/admin-marketing-dashboard.js"), "utf8");
const loader = fs.readFileSync(path.join(root, "js/quote-status.js"), "utf8");

assert.match(loader, /admin-marketing-dashboard\.js/, "admin loader should include the marketing dashboard");
assert.match(dashboard, /Marketing & Sales Funnel/, "dashboard should identify the marketing funnel");
assert.match(dashboard, /marketing_revenue_attribution/, "dashboard should use the protected revenue attribution RPC");
assert.match(dashboard, /marketing_first_touchpoint_id/, "dashboard should read first-touch attribution");
assert.match(dashboard, /marketing_last_touchpoint_id/, "dashboard should read last-non-direct attribution");
assert.match(dashboard, /Quote requests/, "dashboard should display quote volume");
assert.match(dashboard, /Booking conversion/, "dashboard should display booking conversion");
assert.match(dashboard, /Pipeline value/, "dashboard should display pipeline value");
assert.match(dashboard, /Booked revenue/, "dashboard should display booked revenue");
assert.match(dashboard, /first-party attribution is saved when someone submits a quote/i, "dashboard should explain attribution limitations");
assert.match(dashboard, /private browser planning value/i, "ad spend input should be clearly identified as non-accounting planning data");
assert.doesNotMatch(dashboard, /insert\(|update\(|delete\(/, "analytics dashboard should not mutate production business records");

console.log("Admin marketing dashboard regression checks passed.");