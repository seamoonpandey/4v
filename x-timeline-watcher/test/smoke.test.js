// Minimal smoke test: loads content.js's pure logic with DOM/chrome stubs.
// Verifies baseline, newer-post detection, no regression to old posts,
// and duplicate-alert suppression. Run: node test/smoke.test.js

const assert = require("assert");

// --- Stub DOM ---
function makeLink(id) {
  return { href: `https://x.com/someone/status/${id}` };
}

function makeArticle(id) {
  return {
    querySelectorAll: (selector) =>
      selector.includes("/status/") ? [makeLink(id)] : [],
    querySelector: () => null
  };
}

function setPosts(ids) {
  global.document.querySelectorAll = () =>
    ids.map(makeArticle);
}

global.document = {
  querySelectorAll: () => [],
  querySelector: () => null,
  documentElement: {}
};

global.MutationObserver = class {
  observe() {}
};

// Capture the poll callback instead of waiting 30 real seconds.
let intervalCallback = null;
global.setInterval = (fn) => {
  intervalCallback = fn;
  return 0;
};

// --- Stub chrome ---
const sentMessages = [];
const storageState = {};

global.chrome = {
  storage: {
    local: {
      set: async (obj) => Object.assign(storageState, obj),
      get: async (keys) =>
        keys.reduce(
          (acc, key) => (acc[key] = storageState[key], acc),
          {}
        )
    }
  },
  runtime: {
    onMessage: { addListener: () => {} },
    sendMessage: (msg) => sentMessages.push(msg),
    getURL: (p) => `chrome-extension://fake/${p}`
  }
};

require("../content.js");

// Run one poll cycle and let its async body settle.
async function tick(ms = 50) {
  intervalCallback();
  await new Promise(r => setTimeout(r, ms));
}

(async () => {
  // 1. Baseline: first scan must NOT alert.
  setPosts(["100"]);
  await tick();
  assert.strictEqual(storageState.lastSeenPostId, "100");
  assert.strictEqual(sentMessages.length, 0, "baseline must not alert");
  console.log("ok - baseline established without alert");

  // 2. Same post again: still no alert.
  await tick();
  assert.strictEqual(sentMessages.length, 0, "same post must not re-alert");
  console.log("ok - no duplicate alert for same post");

  // 3. Newer post arrives: exactly one alert.
  setPosts(["200", "100"]);
  await tick();
  assert.strictEqual(sentMessages.length, 1, "newer post must alert");
  assert.strictEqual(sentMessages[0].type, "NEW_POST");
  assert.strictEqual(sentMessages[0].post.id, "200");
  console.log("ok - newer post alerts once");

  // 4. Regression to an older post alone: must NOT alert.
  setPosts(["150"]);
  await tick();
  assert.strictEqual(sentMessages.length, 1, "older post must not alert");
  console.log("ok - older post does not trigger alert");

  // 5. Empty timeline: no crash, no alert.
  setPosts([]);
  await tick();
  assert.strictEqual(sentMessages.length, 1);
  console.log("ok - empty timeline is a no-op");

  console.log("\nAll smoke tests passed.");
  process.exit(0);
})().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
