import { youTubeVideoId } from "./lib/youtube.js";
import { courseUrl, readInstance } from "./lib/config.js";

const MENU_ID = "learn-in-parcourse";

chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({
            id: MENU_ID,
            title: "Learn in Parcourse",
            contexts: ["page", "link", "video"],
            documentUrlPatterns: ["*://*.youtube.com/*"],
            targetUrlPatterns: ["*://*.youtube.com/*", "*://youtu.be/*"]
        });
    });

    if (!(await readInstance())) chrome.runtime.openOptionsPage();
});

chrome.runtime.onStartup.addListener(markOpenTabs);
chrome.runtime.onInstalled.addListener(markOpenTabs);

async function markOpenTabs() {
    for (const tab of await chrome.tabs.query({})) {
        if (tab.id !== undefined) await markTab(tab.id);
    }
}

const BADGE = "\u2022";

async function markTab(tabId) {
    let video = null;
    try {
        const tab = await chrome.tabs.get(tabId);
        video = youTubeVideoId(tab?.url ?? "");
    } catch {
        video = null;
    }
    await chrome.action.setBadgeText({ tabId, text: video ? BADGE : "" });
    if (video) await chrome.action.setBadgeBackgroundColor({ tabId, color: "#4c6546" });
}

chrome.tabs.onActivated.addListener(({ tabId }) => markTab(tabId));
chrome.tabs.onUpdated.addListener((tabId, change) => {
    if (change.url || change.status === "complete") markTab(tabId);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    const source = info.linkUrl || info.pageUrl || tab?.url || "";
    handOver(youTubeVideoId(source));
});

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== "learn") return false;
    handOver(message.videoId).then((ok) => respond({ ok }));
    return true;
});

async function handOver(videoId) {
    if (!videoId) return false;

    const instance = await readInstance();
    if (!instance) {
        chrome.runtime.openOptionsPage();
        return false;
    }

    await chrome.tabs.create({ url: courseUrl(instance, videoId) });
    return true;
}
