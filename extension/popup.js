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
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = option.value ? "style-tile" : "style-tile default";
    tile.setAttribute("role", "radio");
    tile.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${option.icon}</svg>`;
    tile.append(option.name);
    tile.addEventListener("click", () => pick(option.value));
    tile.dataset.value = option.value;
    tiles.append(tile);
}

function pick(value) {
    style = value;
    for (const tile of tiles.children) {
        const on = tile.dataset.value === value;
        tile.classList.toggle("selected", on);
        tile.setAttribute("aria-checked", String(on));
    }
}

pick("");

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
    await chrome.runtime.sendMessage({ type: "learn", videoId, style });
    window.close();
});
