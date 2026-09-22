# X Timeline Watcher

A Chrome extension (Manifest V3) that watches your X home timeline and fires a
desktop notification plus an alert sound when a new post appears.

It has no server, no account and no analytics — detection runs entirely in your
browser against the timeline you already have open.

## Install

Short version below. For a click-by-click guide covering Windows, macOS, Linux,
ChromeOS, terminal-only setup and a troubleshooting table, see
**[SETUP.md](./SETUP.md)**.

1. Open `chrome://extensions`, enable **Developer mode**.
2. Click **Load unpacked** and select the `x-timeline-watcher/` directory.
3. Keep a tab open on `https://x.com/i/timeline`. The extension does nothing
   outside that page.

Requires Chrome 120 or newer. The check alarm is set to `periodInMinutes: 0.5`,
and older Chrome builds silently clamp it to one minute.

## How it works

```
background.js  --30s alarm-->  content.js  --NEW_POST-->  background.js
 (service worker)              (in the timeline tab)       (notification + sound)
```

**`background.js`** owns the schedule. On install and on browser startup it
creates a repeating 30-second alarm. Each tick queries for a timeline tab and
sends it `CHECK_TIMELINE`; if no such tab exists, the tick is a no-op. When a
`NEW_POST` message comes back it raises the notification and asks the tab to
play `sounds/alert.mp3`.

**`content.js`** does the detection. It collects every `<article>` in the DOM
that links to `/status/<id>` and decides which ids are genuinely new. Two
mechanisms make that reliable:

- **Snowflake ordering.** X post ids are chronological. An id older than the
  stored cursor is never reported, which is what keeps promoted posts, replies
  and other junk X injects at the top of the feed from looking like news.
- **A 50-entry recent cache.** Anything already in the cache is not new,
  whatever position X has placed it in, so scrolling back up does not re-alert.

The first scan after install is silent: it records the baseline instead of
notifying for every post currently on screen.

**Bursts.** More than one post can land between two checks, so a scan reports
*every* new id rather than only the top one, oldest first. The cursor advances
to the newest of the group.

**`popup.html`** shows the cursor id, the contents of the recent cache, and a
**Test Alert** button that plays the sound in every open timeline tab. The cache
list is the debugging path when a post is missed or duplicated.

## Files

| Path | Role |
| --- | --- |
| `manifest.json` | MV3 manifest: `alarms`, `notifications`, `storage`, `tabs`, host access to `x.com` |
| `background.js` | Service worker — alarm scheduling, notifications, sound dispatch |
| `content.js` | Timeline scraper and new-post detection |
| `popup.{html,css,js}` | Toolbar popup |
| `sounds/alert.mp3` | Alert sound |
| `test/smoke.test.js` | Dependency-free smoke tests |

## Tests

```bash
node test/smoke.test.js
```

No dependencies. The suite stubs `document` and `chrome`, then drives
`CHECK_TIMELINE` directly and asserts on what gets stored and sent. It covers
cache-based detection, promoted-post filtering, scrolling back through history,
persistence across a reload, the 50-entry cache cap, overlapping checks, bursts
of several new posts at once, and registering listeners off `/i/timeline`.

## Known limitations

- Detection depends on X's DOM (`article`, `a[href*="/status/"]`,
  `data-testid="tweetText"`). A markup change can break it silently.
- The audio is played from a content script, so Chrome may block it until you
  have interacted with the timeline tab at least once.
- Only the first matching timeline tab is checked, and only the home timeline
  (`/i/timeline`) — lists, profiles and search are out of scope.
- There is no filtering by author or keyword: every new post alerts.
