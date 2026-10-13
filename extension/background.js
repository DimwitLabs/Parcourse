import { youTubeVideoId } from "./lib/youtube.js";
import { courseUrl, readInstance } from "./lib/config.js";

const VIDEO_PAGES = ["*://*.youtube.com/watch*", "*://*.youtube.com/shorts/*", "*://*.youtube.com/live/*"];
const VIDEO_LINKS = [...VIDEO_PAGES, "*://youtu.be/*"];

chrome.runtime.onInstalled.addListener(async () => {
    await chrome.contextMenus.removeAll();
    chrome.contextMenus.create({
        id: "learn-this-video",
        title: "Learn in Parcourse",
        contexts: ["page", "video"],
        documentUrlPatterns: VIDEO_PAGES
    });
    chrome.contextMenus.create({
        id: "learn-linked-video",
        title: "Learn in Parcourse",
        contexts: ["link"],
        documentUrlPatterns: ["*://*.youtube.com/*"],
        targetUrlPatterns: VIDEO_LINKS
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

const FLAG_MS = 3000;

async function flag(tabId) {
    await chrome.action.setBadgeText({ tabId, text: "!" });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: "#b3261e" });
    setTimeout(() => markTab(tabId), FLAG_MS);
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const source = info.linkUrl || info.pageUrl || tab?.url || "";
    let ok = false;
    try {
        ok = await handOver(youTubeVideoId(source));
    } catch (error) {
        console.error("Parcourse: the hand-over failed", error);
    }
    if (!ok && tab?.id !== undefined) await flag(tab.id);
});

chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message?.type !== "learn") return false;
    (async () => {
        try {
            respond({ ok: await handOver(message.videoId, message.style) });
        } catch (error) {
            console.error("Parcourse: the hand-over failed", error);
            respond({ ok: false });
        }
    })();
    return true;
});

async function handOver(videoId, style) {
    if (!videoId) return false;

    const instance = await readInstance();
    if (!instance) {
        chrome.runtime.openOptionsPage();
        return false;
    }

    await chrome.tabs.create({ url: courseUrl(instance, videoId, style) });
    return true;
}
