---
id: extension
title: Browser Extension
---

# Browser Extension

The extension notices when you are watching a YouTube video. One click and it opens as a new course on your own instance, without copying a link across.

It works with any instance. Self-hosted on your laptop, self-hosted on a server, or the hosted version when it arrives, all of it is the same one line of setup.

## Installing It

The extension is not in the Chrome Web Store yet, so it loads from the repository.

1. Clone or download [Parcourse](https://github.com/DimwitLabs/Parcourse), which brings the `extension` folder with it.
2. Open `chrome://extensions` and turn on **Developer mode**, top right.
3. Choose **Load unpacked** and pick the `extension` folder.

It works in Chrome, Edge, Brave, Arc, and anything else built on Chromium.

## Pointing It At Your Instance

The first time it loads, it asks where your Parcourse is. Paste the address you already open Parcourse at, the same one in your address bar, and press Save.

| If you run it | Use |
| --- | --- |
| On your own machine | `http://localhost:5173` |
| On a server | `https://parcourse.example.com` |

Only the address is stored, and it syncs with your Chrome profile. You can change it later from the extension's options page.

## Using It

Open a YouTube video. A dot appears on the extension icon in the toolbar, which is how it tells you it has found a video on this tab.

Click the icon and press **Create course**. Right-clicking the page or a video link and choosing **Learn in Parcourse** does the same thing.

Parcourse opens in a new tab and starts the course. Everything after that is the ordinary flow, so chapters are still offered when the creator wrote them, and the guardrail still runs.

:::note[Signing in]
The extension never sees your password, and it holds no key or token of its own. It only opens a tab.

If you are not signed in when it opens, Parcourse shows its usual sign-in screen and remembers the video while you sign in. The course starts by itself once you are through.
:::

## What It Can See

It reads the address of your current tab, and acts only on YouTube. Nothing is added to the page and nothing on it is read: the video is worked out from the address alone. Nothing is sent anywhere except the instance you configured.
