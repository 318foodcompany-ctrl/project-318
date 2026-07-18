const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const supabaseSource = fs.readFileSync(path.join(root, "js", "supabase.js"), "utf8");
const crmServiceSource = fs.readFileSync(path.join(root, "js", "crm-service.js"), "utf8");

const rpcCalls = [];
const client = {
  async rpc(name, parameters) {
    rpcCalls.push({ name, parameters });
    return { data: [], error: null };
  }
};

const window = {
  __APP_CONFIG__: {
    supabaseUrl: "https://owsxnyxkgzplvrxaijop.supabase.co",
    supabaseAnonKey: "public-anon-test-key"
  },
  crmUtils: {
    validateCustomer() {
      return "";
    }
  },
  supabase: {
    createClient(url, key) {
      assert.match(url, /^https:\/\//);
      assert.ok(key);
      return client;
    }
  }
};

const context = vm.createContext({
  CustomEvent: class CustomEvent {
    constructor(type) {
      this.type = type;
    }
  },
  document: {
    dispatchEvent() {}
  },
  window
});

vm.runInContext(supabaseSource, context, { filename: "js/supabase.js" });
assert.equal(window.supabaseClient, client, "supabase.js exposes the initialized client on window");

vm.runInContext(crmServiceSource, context, { filename: "js/crm-service.js" });
assert.ok(window.crmService, "crm-service.js initializes when the shared client is available");

(async () => {
  const result = await window.crmService.dashboard();
  assert.equal(Array.isArray(result.rows), true);
  assert.equal(result.rows.length, 0);
  assert.equal(result.total, 0);
  assert.equal(rpcCalls.length, 1, "Customers dashboard reaches the Supabase client");
  assert.equal(rpcCalls[0].name, "crm_customer_dashboard");
  console.log("crm-client tests passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
