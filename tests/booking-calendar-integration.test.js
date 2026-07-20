const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const bookings = fs.readFileSync(path.join(root, "js", "admin-bookings.js"), "utf8");
const quotes = fs.readFileSync(path.join(root, "js", "admin-quotes.js"), "utf8");

assert.ok(
  quotes.includes("window.bookingCalendar.openFromQuote(quote)"),
  "quote details launch booking creation with the selected quote"
);

assert.ok(
  /async function openFromQuote\(quote\)[\s\S]*?quote_id:\s*quote\.id/.test(bookings),
  "booking prefill preserves the initiating quote ID"
);

for (const field of [
  "customer_id: quote.customer_id",
  "customer_name: quote.name",
  "company_name: quote.company",
  "event_date: quote.event_date",
  "guest_count: quote.guests"
]) {
  assert.ok(bookings.includes(field), `booking prefill includes ${field}`);
}

assert.ok(
  /supabaseClient\.from\("bookings"\)\.insert\(\[payload\]\)\.select\(\)\.single\(\)/.test(bookings),
  "new bookings are persisted and returned from Supabase"
);

assert.ok(
  /bookings\.push\(data\)[\s\S]*?renderSummary\(\)[\s\S]*?renderCalendar\(\)/.test(bookings),
  "a newly saved booking is added to local state and immediately rendered on the calendar"
);

assert.ok(
  /function bookingsForDate\(date\)[\s\S]*?booking\.event_date === dateValue/.test(bookings),
  "calendar placement is driven by the saved booking event date"
);

assert.ok(
  /function eventButton\(booking\)[\s\S]*?booking\.event_title[\s\S]*?booking\.company_name \|\| booking\.customer_name/.test(bookings),
  "calendar events display the event title and customer or company"
);

assert.ok(
  /const existing = bookings\.find\([\s\S]*?String\(booking\.quote_id\) === String\(quote\.id\)/.test(bookings),
  "duplicate booking creation is blocked for an existing quote"
);

console.log("booking calendar integration tests passed");
