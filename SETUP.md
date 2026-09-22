# Setup guide — X Timeline Watcher

A no-assumptions walkthrough for installing this Chrome extension on Windows,
macOS, Linux and ChromeOS, by terminal or by clicking.

You do not need to know what an extension is. You do not need to build or
compile anything — there is no install step, no `npm install`, no bundler. The
extension is a folder of plain files that you point Chrome at.

> **Read this first, it is the whole trick.** Chrome's folder picker must be
> given the folder that *contains* `manifest.json`. In this repository that is
> **`x-timeline-watcher/`** — a subfolder — **not** the repository root. Picking
> the root is the single most common reason the install fails, and the error it
> produces ("Manifest file is missing or unreadable") does not explain itself.

---

## 1. Get the files onto this machine

Two routes. Pick one.

### Route A — Download the ZIP (no Git, works on every OS)

1. Open <https://github.com/seamoonpandey/4v>
2. Click the green **Code** button → **Download ZIP**.
3. Unzip it wherever you like (Downloads is fine). You get a folder named
   `4v-main`.
4. Inside it is `x-timeline-watcher/`. **Leave it where it is** — Chrome reads
   this folder on every launch, so do not unzip it to a temp location or delete
   the ZIP's parent later.

### Route B — Clone with Git

Open a terminal (PowerShell, Terminal, or your shell) and run:

```bash
cd ~
git clone https://github.com/seamoonpandey/4v.git
```

This creates `~/4v/` containing `x-timeline-watcher/`.

No Git installed? Windows: <https://git-scm.com/download/win> (accept the
defaults). macOS: `xcode-select --install`, or `brew install git`. Linux: your
package manager (`sudo apt install git`, `sudo dnf install git`). Or skip Git
entirely and use Route A.

### Where your files ended up

The folder Chrome wants is the one with `manifest.json` inside it:

| OS | Path to select |
| --- | --- |
| Windows | `C:\Users\<you>\4v\x-timeline-watcher` |
| macOS | `/Users/<you>/4v/x-timeline-watcher` |
| Linux | `/home/<you>/4v/x-timeline-watcher` |
| ZIP instead of clone | same path, but `4v-main` replaces `4v` |

Confirm it from the terminal — this prints the exact string you will paste into
Chrome's picker later:

```bash
# macOS / Linux
cd ~/4v/x-timeline-watcher && pwd

# Windows PowerShell
(Get-Item "$HOME\4v\x-timeline-watcher").FullName

# Windows Git Bash (note: prints a Windows-style path)
cygpath -w ~/4v/x-timeline-watcher
```

If that command errors, the folder is not where you think it is. Find it before
continuing.

---

## 2. Install in Chrome (GUI — the supported route)

This works identically on Windows, macOS, Linux and ChromeOS.

1. **Open Chrome.**
2. **Go to the extensions page.** Click the address bar, type exactly this, hit
   Enter:

   ```
   chrome://extensions
   ```

   (There is no link you can click to reach it — it must be typed.)
3. **Turn on Developer mode.** Look at the **top-right corner** of the page and
   flip the switch labelled **Developer mode** to blue/on. Until you do this,
   the next button does not exist anywhere on the page.
4. **Click the new button** labelled **Load unpacked** that just appeared in the
   **top-left** of the page.
5. A folder picker opens. **Navigate to and select the `x-timeline-watcher`
   folder** from §1. Select the folder itself — do not open it, do not pick a
   file inside it.
   - Windows: type/paste the path with <kbd>Ctrl</kbd>+<kbd>L</kbd> then Enter.
   - macOS: press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd>, paste, Enter.
   - Linux (GTK): press <kbd>Ctrl</kbd>+<kbd>L</kbd>, paste, Enter.
6. A card for **X Timeline Watcher** appears. Pin it: click the puzzle-piece
   icon in the toolbar → the pin icon next to *X Timeline Watcher*.

Chrome now shows a "Chrome is loading developer-mode extensions" reminder bubble
on each launch, and a "Developer mode" warning on the extensions page. That is
expected for any unpacked extension and is not an error.

### ChromeOS / school or work machines

The **Developer mode** switch can be missing or greyed out when the device is
managed by an organisation policy. If you cannot flip it, unpacked loading is
not available on that device and no workaround in this repo will change that. On
Chromebooks with Linux apps enabled, the files you cloned inside Linux appear in
the picker under **Linux files**.

---

## 3. Make it actually watch

The extension has one requirement: **a tab sitting on the home timeline.**

1. In Chrome, sign in to X and open `https://x.com/i/timeline`.
   - Not `/home`, not a profile, not a list — the content script is scoped to
     `/i/timeline`.
2. **If that tab was already open before you installed the extension, reload it**
   (<kbd>Ctrl</kbd>+<kbd>R</kbd> / <kbd>Cmd</kbd>+<kbd>R</kbd>). Content scripts
   are injected when a page loads, so a tab predating the install is invisible
   to it. This is the second most common "nothing happens" cause.
3. Open the extension popup (pinned icon). You should see post ids under
   **Recent cache** within ~30 seconds — that is the first scan writing its
   baseline. The first scan never notifies; it only records where you are.
4. Click **Test Alert** in the popup. You should hear the sound in the timeline
   tab and see a desktop notification only when a real new post lands.

Then just leave the timeline tab open. Minimum practical interval is 30 seconds;
that is Chrome's floor for alarms and what this extension asks for.

---

## 4. Terminal-only setup

### 4.1 Fetch and stage from the CLI, finish with clicks

Fully scripted up to the one step that must happen inside Chrome's own file
picker. Run, then do §2 steps 2–5:

```bash
# macOS / Linux — clone, then put the exact path on your clipboard
git clone https://github.com/seamoonpandey/4v.git ~/4v
cd ~/4v/x-timeline-watcher && pwd | tr -d '\n' | pbcopy      # macOS
cd ~/4v/x-timeline-watcher && pwd | tr -d '\n' | xclip -selection clipboard   # Linux/X11
cd ~/4v/x-timeline-watcher && pwd | tr -d '\n' | wl-copy          # Linux/Wayland
```

```powershell
# Windows PowerShell — clone is available once Git is installed
git clone https://github.com/seamoonpandey/4v.git "$HOME\4v"
cd "$HOME\4v\x-timeline-watcher"; (Get-Location).Path | Set-Clipboard
```

With the path on the clipboard, the picker is three keystrokes:
<kbd>Ctrl</kbd>+<kbd>L</kbd> (macOS <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>G</kbd>),
<kbd>Ctrl</kbd>+<kbd>V</kbd>, Enter.

No command opens `chrome://extensions` for you reliably — Chrome's internal
pages are not a supported shell argument, so that address is typed by hand.

### 4.2 `--load-extension` does not work on current Chrome

If you found advice saying to launch Chrome with `--load-extension`:

```bash
google-chrome --load-extension="$HOME/4v/x-timeline-watcher"   # silently does nothing
```

Chrome **removed `--load-extension` in version 137** and
**`--disable-extensions-except` in 139** from branded builds. The flag is
accepted and ignored — Chrome starts with no error and no extension, which is
why this wastes so much time. Use §2/§4.1 on normal Chrome.

The flag still exists in **Chrome for Testing**, which is what Chrome's own team
recommends for automated/CI use:

```bash
# Downloads Chrome for Testing into the current directory
npx --yes @puppeteer/browsers install chrome@stable

# Then launch it with the extension preloaded
./chrome-linux64/chrome --load-extension="$HOME/4v/x-timeline-watcher"
```

That is the right choice for headless or scripted runs; for daily use it is
pointless, since a separate Chrome build gets its own empty profile.

### 4.3 Other Chromium browsers

Same manifest, same **Load unpacked** flow — only the page address changes.
Edge, Brave, Vivaldi and Opera all accept it; the folder to select is still
`x-timeline-watcher`.

| Browser | Extensions page |
| --- | --- |
| Edge | `edge://extensions` (then **Developers mode** toggle, left) |
| Brave | `brave://extensions` |
| Vivaldi | `vivaldi://extensions` |
| Opera | `opera://extensions` |

**Firefox is not supported.** The code uses the `chrome.*` API namespace and an
MV3 service worker; Firefox needs `browser.*` and a background script, so
loading it unmodified fails.

---

## 5. Updating later

```bash
cd ~/4v && git pull
```

Then in `chrome://extensions`, hit the **↻ reload** icon on the extension card,
and reload any open timeline tab. Editing files in place without that reload
button does nothing — Chrome caches the unpacked copy.

---

## 6. Removing it

`chrome://extensions` → the extension card → **Remove**. Delete the folder
afterwards if you want. Nothing is written anywhere else: state lives in
Chrome's own `storage.local` for this extension, and is discarded with it.

---

## 7. Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| "Manifest file is missing or unreadable" | Picked the repo root / `4v-main` instead of `x-timeline-watcher` | Re-add pointing at the folder containing `manifest.json` |
| No **Load unpacked** button | Developer mode is off | Top-right switch on `chrome://extensions` |
| **Developer mode** missing or greyed | Managed device policy (school/work, some Chromebooks) | Ask the device admin; not fixable locally |
| Popup shows `None` / cache stays empty | Tab is not on `x.com/i/timeline`, or was opened before install | Open the timeline URL, reload the tab |
| No sound from **Test Alert** | Browser autoplay policy blocks audio until you interact with the tab | Click once inside the timeline tab, retry; check tab isn't muted |
| Notifications silent, sound works | OS Do Not Disturb / Focus assist suppressing them | Disable DND, or allow Chrome in the OS notification settings |
| Nothing on Linux, no errors | No notification daemon running (common on minimal WMs) | Install/run one (GNOME, KDE, `dunst`, `mako`) |
| Alerts every ~60 s, not 30 | Chrome older than 120 clamps `periodInMinutes` | Update Chrome |
| Stops working days later | Chrome disabled the extension after an update, or storage cache was cleared | Re-enable on the card; re-add if removed |
| Same post alerts twice | Timeline scrolled so an old cached id fell out of the 50-entry window | Expected at the margin; re-check the Recent cache list |
| Popup status stays "Checking…" | Cosmetic: the status dot is not wired to anything | Ignore it; read **Last seen post** and **Recent cache** instead |

### When it is genuinely broken, look here

- `chrome://extensions` → card → **service worker** opens the background
  console. You want `[X Watcher] Alarm created: every 30 seconds` and then
  `[X Watcher] 30-second check` twice a minute. Missing checks mean no timeline
  tab was found.
- On the timeline tab, DevTools console shows `[X Watcher] Current newest: <id>`
  and `[X Watcher] NEW POSTS: <ids>` when detection fires.
- The popup's **Recent cache** list is the ground truth of what the extension
  believes it has already seen.
- `node test/smoke.test.js` in `x-timeline-watcher/` verifies the detection
  logic without a browser at all.

---

## 8. What to expect, so you know it is working

- A post appears → desktop notification with the post text, an alert sound in
  the timeline tab, within 30 seconds.
- A promoted/ad post lands at the top → **nothing**. Those carry older ids and
  are deliberately rejected.
- You scroll back through hours of history → **nothing**.
- Three real posts arrive between two checks → three notifications, oldest
  first.
- First-ever scan after install → **nothing**, silently. It is establishing your
  baseline, not alerting your existing feed.
