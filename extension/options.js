import { readInstance, writeInstance } from "./lib/config.js";

const field = document.getElementById("instance");
const note = document.getElementById("note");

const current = await readInstance();
if (current) field.value = current;

document.getElementById("form").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
        const origin = await writeInstance(field.value);
        field.value = origin;
        say(`Saved. Videos will open at ${new URL(origin).host}.`, "good");
    } catch (error) {
        say(error.message, "bad");
    }
});

function say(message, tone) {
    note.textContent = message;
    note.dataset.tone = tone;
}
