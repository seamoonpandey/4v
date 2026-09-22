const CHECK_INTERVAL = 30 * 1000;

let lastSeenPostId = null;
let initialized = false;
let checkInProgress = false;

function getTimelinePosts() {
  const articles = document.querySelectorAll('article');

  const posts = [];

  for (const article of articles) {
    const links = article.querySelectorAll('a[href*="/status/"]');

    for (const link of links) {
      const match = link.href.match(/\/status\/(\d+)/);

      if (match) {
        const postId = match[1];

        if (!posts.some(post => post.id === postId)) {
          posts.push({
            id: postId,
            url: link.href,
            element: article
          });
        }
      }
    }
  }

  return posts;
}

function getNewestPost() {
  const posts = getTimelinePosts();

  if (posts.length === 0) {
    return null;
  }

  // X timeline is normally newest first.
  // We still compare numeric IDs to avoid relying entirely on DOM order.
  posts.sort((a, b) => {
    try {
      return BigInt(b.id) > BigInt(a.id) ? 1 : -1;
    } catch {
      return 0;
    }
  });

  return posts[0];
}

function extractPostText(post) {
  if (!post?.element) {
    return "";
  }

  const textElement = post.element.querySelector(
    '[data-testid="tweetText"]'
  );

  return textElement?.innerText?.trim() || "";
}

async function checkTimeline() {
  if (checkInProgress) {
    return;
  }

  checkInProgress = true;

  try {
    const newestPost = getNewestPost();

    if (!newestPost) {
      console.log("[X Watcher] No posts found.");
      return;
    }

    console.log(
      "[X Watcher] Newest post:",
      newestPost.id
    );

    // First scan establishes the baseline.
    if (!initialized) {
      lastSeenPostId = newestPost.id;
      initialized = true;

      await chrome.storage.local.set({
        lastSeenPostId
      });

      console.log(
        "[X Watcher] Baseline established:",
        lastSeenPostId
      );

      return;
    }

    if (newestPost.id === lastSeenPostId) {
      return;
    }

    let isNewer = false;

    try {
      isNewer =
        BigInt(newestPost.id) > BigInt(lastSeenPostId);
    } catch {
      isNewer = newestPost.id !== lastSeenPostId;
    }

    if (!isNewer) {
      return;
    }

    console.log(
      "[X Watcher] NEW POST:",
      newestPost.id
    );

    lastSeenPostId = newestPost.id;

    await chrome.storage.local.set({
      lastSeenPostId
    });

    const text = extractPostText(newestPost);

    chrome.runtime.sendMessage({
      type: "NEW_POST",
      post: {
        id: newestPost.id,
        url: newestPost.url,
        text
      }
    });
  } finally {
    checkInProgress = false;
  }
}

function startWatcher() {
  console.log("[X Watcher] Starting...");

  checkTimeline();

  setInterval(() => {
    checkTimeline();
  }, CHECK_INTERVAL);
}

// X is a SPA, so the timeline can change without the page itself loading.
const observer = new MutationObserver(() => {
  // Don't immediately alert from every DOM mutation.
  // The 30-second poll remains our actual detection mechanism.
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true
});

startWatcher();

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "PLAY_ALERT") {
    return;
  }

  const audio = new Audio(
    chrome.runtime.getURL("sounds/alert.mp3")
  );

  audio.volume = 1.0;

  audio.play().catch((error) => {
    console.warn(
      "[X Watcher] Could not play alert sound:",
      error
    );
  });
});
