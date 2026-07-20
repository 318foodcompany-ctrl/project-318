const fs = require('fs');
const assert = require('assert');

const enhancement = fs.readFileSync('js/admin-booking-enhancements.js', 'utf8');
const loader = fs.readFileSync('js/quote-status.js', 'utf8');
const calendar = fs.readFileSync('js/admin-bookings.js', 'utf8');

assert(enhancement.includes('data.bookingView = "agenda"') || enhancement.includes('dataset.bookingView = "agenda"'), 'Agenda view button must be created');
assert(enhancement.includes('booking-agenda-item'), 'Agenda event cards must be rendered');
assert(enhancement.includes('guest_count'), 'Booking cards must show guest count');
assert(enhancement.includes('venue_name'), 'Booking cards must show venue');
assert(enhancement.includes('quote_amount'), 'Booking cards must show event value');
assert(enhancement.includes('Open Customer'), 'Booking modal must link to the customer record');
assert(enhancement.includes('Open Quote Pipeline'), 'Booking modal must link to the quote pipeline');
assert(enhancement.includes('prefers-reduced-motion'), 'Reduced-motion support must remain available');
assert(loader.includes('js/admin-booking-enhancements.js'), 'Admin must load the booking enhancements');
assert(calendar.includes('conflictsFor'), 'Existing conflict protection must remain in place');
assert(calendar.includes('duplicateQuote'), 'Existing duplicate quote-booking protection must remain in place');
assert(calendar.includes('openFromQuote'), 'Quote-to-booking handoff must remain in place');

console.log('Booking visual upgrade regression checks passed.');
