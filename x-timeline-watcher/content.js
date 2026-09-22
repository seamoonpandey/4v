const RECENT_POSTS_LIMIT = 50;
const TIMELINE_PATTERN = /^\/i\/timeline/;

let initialized = false;
let checkInProgress = false;

async function loadState() {
  const data = await chrome.storage.local.get([
    "lastSeenPostId",
    "recentPostIds"
  ]);

  if (data.lastSeenPostId) {
    initialized = true;
  }

  return {
    lastSeenPostId: data.lastSeenPostId || null,
    recentPostIds: data.recentPostIds || []
  };
}

function getTimelinePosts() {
  const articles = document.querySelectorAll('article');

  const posts = [];

  for (const article of articles) {
    const links = article.querySelectorAll(
      'a[href*="/status/"]'
    );

    for (const link of links) {
      const match =
        link.href.match(/\/status\/(\d+)/);

      if (!match) {
        continue;
      }

      const id = match[1];

      if (
        !posts.some(post => post.id === id)
      ) {
        posts.push({
          id,
          url: link.href,
          element: article
        });
      }
    }
  }

  return posts;
}

function getNewestPost() {
  const posts = getTimelinePosts();
  if (!posts.length) {
    return null;
  }

  // The timeline normally places the newest post first.
  return posts[0];
}

function getPostText(post) {
  if (!post?.element) {
    return "";
  }

  const text =
    post.element.querySelector(
      '[data-testid="tweetText"]'
    );

  return text?.innerText?.trim() || "";
}

async function checkTimeline() {
  if (checkInProgress) {
    return;
  }

  checkInProgress = true;

  try {
    const state = await loadState();

    const newestPost = getNewestPost();

    if (!newestPost) {
      console.log(
        "[X Watcher] No timeline posts found."
      );
      return;
    }

    console.log(
      "[X Watcher] Current newest:",
      newestPost.id
    );

    // First-ever scan establishes baseline.
    if (!initialized) {
      await chrome.storage.local.set({
        lastSeenPostId: newestPost.id,
        recentPostIds: [newestPost.id]
      });

      initialized = true;

      console.log(
        "[X Watcher] Baseline:",
        newestPost.id
      );

      return;
    }

    // Anything we've seen recently is not new,
    // no matter where X places it in the DOM.
    if (state.recentPostIds.includes(newestPost.id)) {
      if (newestPost.id !== state.lastSeenPostId) {
        // Newest visible post changed to something we
        // already know; keep lastSeenPostId tracking it
        // so the cache cursor follows the top of the feed.
        await chrome.storage.local.set({
          lastSeenPostId: newestPost.id
        });
      }
      return;
    }

    // Unknown id older than the cursor: promoted content,
    // replies, or junk X inserted at the top. Not new.
    let isNewer = true;
    try {
      isNewer =
        BigInt(newestPost.id) > BigInt(state.lastSeenPostId);
    } catch {
      isNewer = true;
    }

    if (!isNewer) {
      return;
    }

    lastSeenPostId = newestPost.id;

    await chrome.storage.local.set({
      lastSeenPostId,
      recentPostIds: [
        newestPost.id,
        ...state.recentPostIds
      ].slice(0, RECENT_POSTS_LIMIT)
    });

    const post = {
      id: newestPost.id,
      url: newestPost.url,
      text: getPostText(newestPost)
    };

    chrome.runtime.sendMessage({
      type: "NEW_POST",
      post
    });
  } finally {
    checkInProgress = false;
  }
}

function playAlert() {

  const audio = new Audio(
    chrome.runtime.getURL(
      "sounds/alert.mp3"
    )
  );

  audio.volume = 1.0;

  audio.play().catch(error => {
    console.warn(
      "[X Watcher] Audio playback blocked:",
      error
    );
  });
}

function isTimelinePath() {
  return TIMELINE_PATTERN.test(location.pathname);
}

// X is a SPA: navigating away unloads us anyway,
// but re-entering /i/timeline must be able to
// re-register the message listener if Chrome
// keeps the content script alive.
if (!isTimelinePath()) {
  console.log(
    "[X Watcher] Not on /i/timeline — ignoring."
  );
} else {
  chrome.runtime.onMessage.addListener(
    (message) => {
      if (message.type === "CHECK_TIMELINE") {
        checkTimeline();
      }

      if (message.type === "PLAY_ALERT") {
        playAlert();
      }
    }
  );

  loadState();
}
