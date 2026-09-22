// V2 smoke tests: stub DOM/chrome, drive CHECK_TIMELINE manually.
// Covers cache-based detection, promoted posts, scroll-back,
// reload persistence, cache cap, re-entrancy, SPA navigation.
// Run: node test/smoke.test.js

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

// Track intervals without scheduling real timers.
const intervals = [];
global.setInterval = (fn) => {
  intervals.push(fn);
  return intervals.length;
};

// --- Stub chrome ---
const sentMessages = [];
const listeners = [];
let storageState = {};
let audioPlays = 0;

global.chrome = {
  storage: {
    local: {
      set: async (obj) => {
        storageState = { ...storageState, ...obj };
      },
      get: async (keys) =>
        keys.reduce(
          (acc, key) => (acc[key] = storageState[key], acc),
          {}
        )
    }
  },
  runtime: {
    onMessage: {
      addListener: (fn) => listeners.push(fn)
    },
    sendMessage: (msg) => sentMessages.push(msg),
    getURL: (p) => `chrome-extension://fake/${p}`
  }
};

global.Audio = class {
  play() {
    audioPlays += 1;
    return Promise.resolve();
  }
};

function dispatch(message) {
  for (const fn of listeners) fn(message);
}

// Run one check cycle and let its async body settle.
async function tick(ms = 30) {
  dispatch({ type: "CHECK_TIMELINE" });
  await new Promise(r => setTimeout(r, ms));
}

function resetTestScope() {
  // Fresh module registry so each suite reloads content.js
  // with clean module-level state.
  delete require.cache[
    require.resolve("../content.js")
  ];
  sentMessages.length = 0;
  listeners.length = 0;
  storageState = {};
  audioPlays = 0;
}

function requireContent(pathname) {
  global.location = { pathname };
  require("../content.js");
}

function lastAlert() {
  return sentMessages[sentMessages.length - 1];
}

(async () => {
  // --- Suite 1: core detection ---
  requireContent("/i/timeline");
  await tick(); // let loadState settle
  setPosts(["100"]);

  await tick(); // baseline
  assert.strictEqual(storageState.lastSeenPostId, "100");
  assert.deepStrictEqual(storageState.recentPostIds, ["100"]);
  assert.strictEqual(sentMessages.length, 0, "baseline must not alert");
  console.log("ok - baseline established without alert");

  await tick(); // same post: silence
  assert.strictEqual(sentMessages.length, 0);
  console.log("ok - no duplicate alert for same post");

  // promoted post at top (older snowflake, as real promoted
  // content is): filtered, cursor and cache untouched
  setPosts(["50", "100"]);
  await tick();
  assert.strictEqual(sentMessages.length, 0, "promoted post must not alert");
  assert.strictEqual(storageState.lastSeenPostId, "100",
    "cursor must not advance to promoted content");
  assert.deepStrictEqual(storageState.recentPostIds, ["100"],
    "cache must not grow for promoted content");
  console.log("ok - promoted (older) post at top is ignored");

  // genuine new post
  setPosts(["900", "100"]);
  await tick();
  assert.strictEqual(sentMessages.length, 1);
  assert.strictEqual(lastAlert().post.id, "900");
  assert.deepStrictEqual(storageState.recentPostIds, ["900", "100"]);
  console.log("ok - new post alerts once and is cached");

  // scroll-back: 100 returns to top after cache cursor moved
  setPosts(["100"]);
  await tick();
  assert.strictEqual(sentMessages.length, 1, "scroll-back must not re-alert");
  console.log("ok - scroll-back to older post does not re-alert");

  // PLAY_ALERT triggers audio playback
  dispatch({ type: "PLAY_ALERT" });
  await new Promise(r => setTimeout(r, 20));
  assert.strictEqual(audioPlays, 1, "PLAY_ALERT must play sound once");
  console.log("ok - PLAY_ALERT plays audio");

  // --- Suite 2: reload persistence (extension reload / browser restart) ---
  resetTestScope();
  setPosts(["100"]); // DOM restored, storage survives
  requireContent("/i/timeline");
  await tick(); // loadState settles; initialized=true from storage

  setPosts(["950"]);
  await tick();
  assert.strictEqual(sentMessages.length, 1, "unseen post after reload must alert");
  assert.strictEqual(lastAlert().post.id, "950");
  console.log("ok - cache persists across content-script reload");

  // --- Suite 3: cache cap ---
  resetTestScope();
  setPosts(["100"]);
  requireContent("/i/timeline");
  await tick(); // baseline
  for (let i = 200; i <= 680; i += 10) {
    setPosts([String(i), "100"]);
    await tick();
  }
  assert.strictEqual(storageState.recentPostIds.length, 50,
    "cache must be capped at 50");
  assert.strictEqual(storageState.recentPostIds[0], "680",
    "newest id stays at front of cache");
  console.log("ok - recent-post cache capped at 50 entries");

  // --- Suite 4: re-entrancy guard ---
  resetTestScope();
  setPosts(["100"]);
  requireContent("/i/timeline");
  await tick(); // baseline
  setPosts(["300"]);
  // Two overlapping ticks share one 30ms settle window.
  dispatch({ type: "CHECK_TIMELINE" });
  dispatch({ type: "CHECK_TIMELINE" });
  await new Promise(r => setTimeout(r, 60));
  assert.strictEqual(sentMessages.length, 1,
    "overlapping checks must alert exactly once");
  console.log("ok - overlapping checks alert exactly once");

  // --- Suite 5: SPA navigation guard ---
  resetTestScope();
  requireContent("/home"); // wrong page
  assert.strictEqual(listeners.length, 0,
    "must not register listeners off the timeline");
  dispatch({ type: "CHECK_TIMELINE" });
  await new Promise(r => setTimeout(r, 30));
  assert.strictEqual(sentMessages.length, 0);
  console.log("ok - listeners not registered off /i/timeline");

  console.log("\nAll smoke tests passed.");
  process.exit(0);
})().catch((err) => {
  console.error("FAIL:", err.message);
  process.exit(1);
});
