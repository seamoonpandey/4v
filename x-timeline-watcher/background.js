chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "NEW_POST") {
    return;
  }

  const post = message.post;

  console.log("[X Watcher] Alerting for:", post);

  chrome.notifications.create(
    `x-post-${post.id}`,
    {
      type: "basic",
      title: "New X Post",
      message: post.text || "A new post appeared on your timeline.",
      priority: 2
    }
  );

  playAlertSound();
});

async function playAlertSound() {
  // MV3 service workers don't have a DOM/audio element.
  // We'll handle the actual sound from the content page.
  chrome.tabs.query(
    {
      url: [
        "https://x.com/i/timeline*"
      ]
    },
    (tabs) => {
      for (const tab of tabs) {
        if (!tab.id) {
          continue;
        }

        chrome.tabs.sendMessage(tab.id, {
          type: "PLAY_ALERT"
        }).catch(() => {});
      }
    }
  );
}
