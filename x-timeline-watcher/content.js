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

function isNewerThanCursor(id, cursorId) {
  try {
    return BigInt(id) > BigInt(cursorId);
  } catch {
    return true;
  }
}

function emitNewPost(post) {
  chrome.runtime.sendMessage({
    type: "NEW_POST",
    post
  });
}

async function checkTimeline() {
  if (checkInProgress) {
    return;
  }

  checkInProgress = true;

  try {
    const state = await loadState();

    const posts = getTimelinePosts();

    if (!posts.length) {
      console.log(
        "[X Watcher] No timeline posts found."
      );
      return;
    }

    console.log(
      "[X Watcher] Current newest:",
      posts[0].id
    );

    // First-ever scan establishes the baseline:
    // everything currently visible counts as seen.
    if (!initialized) {
      await chrome.storage.local.set({
        lastSeenPostId: posts[0].id,
        recentPostIds: posts
          .map(post => post.id)
          .slice(0, RECENT_POSTS_LIMIT)
      });

      initialized = true;

      console.log(
        "[X Watcher] Baseline:",
        posts[0].id
      );

      return;
    }

    // Collect everything genuinely new: not in the
    // cache and newer than the cursor. Promoted
    // content, replies, and junk X inserts at the top
    // are older snowflakes, so they never qualify.
    const newPosts = posts.filter(post =>
      !state.recentPostIds.includes(post.id) &&
      isNewerThanCursor(post.id, state.lastSeenPostId)
    );

    if (!newPosts.length) {
      // Newest visible post changed to something we
      // already know; keep the cursor following the
      // top of the feed. Only cached ids count, so a
      // promoted post at the top never captures it.
      if (
        state.recentPostIds.includes(posts[0].id) &&
        posts[0].id !== state.lastSeenPostId
      ) {
        await chrome.storage.local.set({
          lastSeenPostId: posts[0].id
        });
      }
      return;
    }

    // Alert oldest first so a burst reads in order.
    newPosts.sort((a, b) =>
      isNewerThanCursor(a.id, b.id) ? 1 : -1
    );

    const newestId = newPosts[newPosts.length - 1].id;

    await chrome.storage.local.set({
      lastSeenPostId: newestId,
      recentPostIds: [
        ...newPosts.map(post => post.id).reverse(),
        ...state.recentPostIds
      ].slice(0, RECENT_POSTS_LIMIT)
    });

    console.log(
      "[X Watcher] NEW POSTS:",
      newPosts.map(post => post.id).join(", ")
    );

    for (const post of newPosts) {
      emitNewPost({
        id: post.id,
        url: post.url,
        text: getPostText(post)
      });
    }
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
