const fs = require('fs');
const assert = require('assert');

const commandCenter = fs.readFileSync('js/admin-command-center.js', 'utf8');
const quoteStatus = fs.readFileSync('js/quote-status.js', 'utf8');

assert(commandCenter.includes('318 Food Co. Command Center'), 'command center hero is missing');
assert(commandCenter.includes('Pipeline value'), 'pipeline value metric is missing');
assert(commandCenter.includes('Booked this month'), 'booked revenue metric is missing');
assert(commandCenter.includes('Outstanding'), 'outstanding balance metric is missing');
assert(commandCenter.includes('newBookingButton'), 'new booking quick action is missing');
assert(commandCenter.includes('newInvoiceButton'), 'new invoice quick action is missing');
assert(commandCenter.includes('prefers-reduced-motion'), 'reduced-motion support is missing');
assert(commandCenter.includes('focus-visible'), 'keyboard focus styling is missing');
assert(commandCenter.includes('escapeHTML'), 'user-provided content must be escaped');
assert(quoteStatus.includes('window.quoteStatusService = { update }'), 'quote status service contract changed');
assert(quoteStatus.includes('admin-command-center.js'), 'command center loader is missing');

console.log('Admin command center regression checks passed.');
