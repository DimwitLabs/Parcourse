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

export const STYLES = [
    { value: "", name: "My default", icon: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/>' },
    { value: "explorer", name: "Explorer", icon: '<circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>' },
    { value: "quick_study", name: "Quick Study", icon: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>' },
    { value: "deep_diver", name: "Deep Diver", icon: '<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>' },
    { value: "storyteller", name: "Storyteller", icon: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>' },
    { value: "practitioner", name: "Practitioner", icon: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>' },
    { value: "exam_ready", name: "Exam Ready", icon: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>' }
];

export function courseUrl(instance, videoId, style) {
    const url = `${instance}/?v=${encodeURIComponent(videoId)}`;
    return style ? `${url}&style=${encodeURIComponent(style)}` : url;
}
