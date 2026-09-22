async function loadState() {
  const data = await chrome.storage.local.get([
    "lastSeenPostId"
  ]);

  document.getElementById("lastPost").textContent =
    data.lastSeenPostId || "None";
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
