"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const { render } = require("../js/landing-page-template.js");
const page={title:"Office <lunch>",description:"Lunch & delivery",indexed:false,destination:"quote",sections:[{heading:"Menu",body:"<script>test</script>"},{heading:"Hidden heading",body:"",hidden:true}]};
test("a public page escapes edited text, honors visibility and limits the call to action",()=>{
  const html=render(page,"office-lunch");
  assert.match(html,/Office &lt;lunch&gt;/);
  assert.match(html,/&lt;script&gt;test/);
  assert.match(html,/noindex,follow/);
  assert.doesNotMatch(html,/Hidden heading|public-tracking/);
  assert.match(render({...page,destination:"toString"},"office-lunch",true),/href="\/quote-builder\.html"/);
  assert.match(render(page,"office-lunch",true),/public-tracking/);
});
