export const DEFAULT_INSTANCE = "";

const KEY = "instanceUrl";

export function normaliseInstance(input) {
    const text = (input ?? "").trim();
    if (!text) return null;

    let url;
    try {
        url = new URL(/^[a-z][a-z\d+.-]*:/i.test(text) ? text : `https://${text}`);
    } catch {
        return null;
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname) return null;
    return url.origin;
}

export async function readInstance() {
    const stored = await chrome.storage.sync.get(KEY);
    return normaliseInstance(stored[KEY] ?? DEFAULT_INSTANCE);
}

export async function writeInstance(value) {
    const origin = normaliseInstance(value);
    if (!origin) throw new Error("That does not look like a URL.");
    await chrome.storage.sync.set({ [KEY]: origin });
    return origin;
}

export function courseUrl(instance, videoId) {
    return `${instance}/?v=${encodeURIComponent(videoId)}`;
}
