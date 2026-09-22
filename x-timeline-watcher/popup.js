async function loadState() {
  const data = await chrome.storage.local.get([
    "lastSeenPostId",
    "recentPostIds"
  ]);

  document.getElementById("lastPost").textContent =
    data.lastSeenPostId || "None";

  const ids = data.recentPostIds || [];

  document.getElementById("cacheCount").textContent =
    `${ids.length} posts`;

  document.getElementById("cacheList").textContent =
    ids.join("\n") || "empty";
}

document
  .getElementById("testSound")
  .addEventListener("click", async () => {

    const tabs = await chrome.tabs.query({
      url: [
        "https://x.com/i/timeline*"
      ]
    });

    for (const tab of tabs) {
      if (!tab.id) {
        continue;
      }

      chrome.tabs.sendMessage(tab.id, {
        type: "PLAY_ALERT"
      }).catch(() => {});
    }
  });

loadState();
