import { youTubeVideoId } from "./lib/youtube.js";
import { readInstance } from "./lib/config.js";

const title = document.getElementById("title");
const note = document.getElementById("note");
const go = document.getElementById("go");
const host = document.getElementById("host");
const hostName = document.getElementById("host-name");

document.getElementById("settings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
    window.close();
});

const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
const videoId = youTubeVideoId(tab?.url ?? "");
const instance = await readInstance();

if (instance) {
    hostName.textContent = new URL(instance).host;
    host.hidden = false;
    host.addEventListener("click", async () => {
        await chrome.tabs.create({ url: instance });
        window.close();
    });
}

if (!instance) {
    title.textContent = "Where is your Parcourse?";
    note.textContent = "Set the address of your instance to get started.";
} else if (!videoId) {
    title.textContent = "No YouTube video here.";
    note.textContent = "Open a video and try again.";
} else {
    title.textContent = tab.title?.replace(/ - YouTube$/, "") ?? "This video";
    go.disabled = false;
}

go.addEventListener("click", async () => {
    go.disabled = true;
    go.textContent = "Opening…";
    await chrome.runtime.sendMessage({ type: "learn", videoId });
    window.close();
});
