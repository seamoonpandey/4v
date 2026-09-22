const ALARM_NAME = "x-timeline-check";
const CHECK_INTERVAL_MINUTES = 0.5;

// Start the alarm when the extension loads.
chrome.runtime.onInstalled.addListener(() => {
  createAlarm();
});

// Also recreate it when Chrome starts.
chrome.runtime.onStartup.addListener(() => {
  createAlarm();
});

function createAlarm() {
  chrome.alarms.create(ALARM_NAME, {
    periodInMinutes: CHECK_INTERVAL_MINUTES
  });

  console.log(
    "[X Watcher] Alarm created: every 30 seconds"
  );
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) {
    return;
  }

  console.log("[X Watcher] 30-second check");

  const tabs = await chrome.tabs.query({
    url: "https://x.com/i/timeline*"
  });

  if (tabs.length === 0) {
    console.log(
      "[X Watcher] No X timeline tab found."
    );
    return;
  }

  // Use the first matching timeline tab.
  const tab = tabs[0];
  if (!tab.id) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tab.id, {
      type: "CHECK_TIMELINE"
    });
  } catch (error) {
    console.log(
      "[X Watcher] Could not contact timeline:",
      error.message
    );
  }
});

chrome.runtime.onMessage.addListener(
  (message, sender) => {
    if (message.type !== "NEW_POST") {
      return;
    }

    const post = message.post;

    console.log(
      "[X Watcher] NEW POST:",
      post.id
    );

    notifyUser(post);
    playAlert(sender.tab?.id);
  }
);

function notifyUser(post) {
  const message =
    post.text ||
    "A new post appeared on your X timeline.";

  chrome.notifications.create(
    `x-post-${post.id}`,
    {
      type: "basic",
      title: "🚨 New X Post",
      message,
      priority: 2
    }
  );
}

async function playAlert(tabId) {
  if (!tabId) {
    return;
  }

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: "PLAY_ALERT"
    });
  } catch (error) {
    console.log(
      "[X Watcher] Sound failed:",
      error.message
    );
  }
}
