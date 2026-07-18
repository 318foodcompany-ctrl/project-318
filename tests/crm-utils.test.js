const assert = require("node:assert/strict");
const { splitName, displayName, phoneKey, validateCustomer, escapeHTML } = require("../js/crm-utils.js");

assert.deepEqual(splitName("Ada Lovelace"), { firstName: "Ada", lastName: "Lovelace" });
assert.deepEqual(splitName("Prince"), { firstName: "Prince", lastName: "" });
assert.deepEqual(splitName("  Mary Jane Watson  "), { firstName: "Mary", lastName: "Jane Watson" });
assert.equal(displayName({ first_name: "Ada", last_name: "Lovelace", company: "Analytical" }), "Ada Lovelace");
assert.equal(displayName({ first_name: "", last_name: "", company: "318 Food Co." }), "318 Food Co.");
assert.equal(phoneKey("+1 (318) 555-0100"), "13185550100");
assert.equal(validateCustomer({ first_name: "", last_name: "", company: "", email: "", phone: "" }), "Enter a name, company, email, or phone number.");
assert.equal(validateCustomer({ first_name: "Ada", email: "invalid", phone: "" }), "Enter a valid email address.");
assert.equal(validateCustomer({ first_name: "Ada", email: "ada@example.com", phone: "318-555-0100" }), "");
assert.equal(escapeHTML('<script>alert("x")</script>'), "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;");

console.log("crm-utils tests passed");
