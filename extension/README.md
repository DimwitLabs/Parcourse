# Parcourse browser extension

A Chrome extension that notices when you are watching a YouTube video and sends it to your Parcourse instance as a course.

Nothing is injected into YouTube. The video is read from the tab's address, and a dot on the toolbar icon says when one has been found.

## Loading it

1. Open `chrome://extensions` and turn on Developer mode.
2. Choose Load unpacked and pick this folder.
3. It opens its options page on first install. Paste the address you open Parcourse at.

Works in any Chromium browser. There is no build step and no dependencies.

## How it works

The extension holds no credentials. It opens a tab at:

```
<your-instance>/?v=<videoId>
```

The app reads `v` on the home screen, rebuilds the watch URL and runs the same course creation the paste box does. Signed out, the login screen keeps the query, so the video is picked up as soon as the session exists.

That is the whole contract, which is why pointing this at the hosted instance later needs no change here beyond a different address.

## Files

| File | What it does |
| --- | --- |
| `manifest.json` | MV3 manifest. YouTube host permissions only. |
| `background.js` | Service worker. Badges the icon, owns the context menu, opens the tab. |
| `popup.js` | Toolbar popup. The whole interface. |
| `options.js` | Instance address, saved to `chrome.storage.sync`. |
| `lib/youtube.js` | Video id parser, kept in step with `frontend/src/lib/youtube.ts`. |
| `lib/config.js` | Reads and normalises the instance address. |

## Publishing

```
./scripts/pack-extension.sh
```

Writes `dist/parcourse-<version>.zip` with the manifest at the root, which is the shape the Chrome Web Store expects. The version tracks Parcourse's own, so a listing says which release it was cut alongside.

The store asks why each permission is needed:

| Permission | Why |
| --- | --- |
| `storage` | Holds the one setting, the address of your instance, synced across your own Chrome profile. |
| `contextMenus` | Adds the right-click entry on a YouTube link or page. |
| `*://*.youtube.com/*`, `*://youtu.be/*` | Reads the address of a YouTube tab to find the video id. Nothing is injected and the page is never read. |

There is no `tabs` permission, so the extension cannot see the address of any tab that is not YouTube.

## When hosted launches

Set `DEFAULT_INSTANCE` in `lib/config.js` to the hosted origin. A saved address always wins, so nobody's existing setup is disturbed, and a fresh install works with no configuration at all.
