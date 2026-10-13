import { youTubeVideoId } from "./lib/youtube.js";
import { STYLES, readInstance } from "./lib/config.js";

const title = document.getElementById("title");
const note = document.getElementById("note");
const go = document.getElementById("go");
const host = document.getElementById("host");
const hostName = document.getElementById("host-name");
const tiles = document.getElementById("style");
let style = "";

for (const option of STYLES) {
    const tile = document.createElement("label");
    tile.className = option.value ? "style-tile" : "style-tile default";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "style";
    radio.className = "style-radio";
    radio.checked = option.value === "";
    radio.addEventListener("change", () => {
        style = option.value;
    });
    tile.append(radio);
    tile.insertAdjacentHTML(
        "beforeend",
        `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${option.icon}</svg>`
    );
    tile.append(option.name);
    tiles.append(tile);
}

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
    try {
        const reply = await chrome.runtime.sendMessage({ type: "learn", videoId, style });
        if (reply?.ok) {
            window.close();
            return;
        }
    } catch (error) {
        console.error("Parcourse: the hand-over failed", error);
    }
    go.disabled = false;
    go.textContent = "Create course";
    note.dataset.tone = "bad";
    note.textContent = "Parcourse did not open. Check its address in settings and try again.";
});
