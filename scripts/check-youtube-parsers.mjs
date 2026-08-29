// The extension has no build step, so it carries its own copy of the parser that
// rejects evil.com/youtube.com/watch?v=... This fails loudly when the two drift.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(import.meta.url);
const root = join(dirname(here), "..");

// Node strips types on its own from 23.6; older ones need --experimental-strip-types.
async function loadTypeScript(path) {
  try {
    return await import(path);
  } catch (error) {
    if (process.env.PARCOURSE_RETRIED) throw error;
    const retry = spawnSync(process.execPath, ["--experimental-strip-types", here], {
      stdio: "inherit",
      env: { ...process.env, PARCOURSE_RETRIED: "1" },
    });
    process.exit(retry.status ?? 1);
  }
}

const app = await loadTypeScript(join(root, "frontend/src/lib/youtube.ts"));
const extension = await import(join(root, "extension/lib/youtube.js"));

const { cases } = JSON.parse(readFileSync(join(root, "shared/youtube-urls.json"), "utf8"));
const failures = [];

for (const { url, id } of cases) {
  const fromApp = app.youTubeVideoId(url) ?? null;
  const fromExtension = extension.youTubeVideoId(url) ?? null;

  if (fromApp !== id) failures.push(`app disagrees with the list on ${JSON.stringify(url)}: got ${fromApp}, expected ${id}`);
  if (fromExtension !== id) failures.push(`extension disagrees with the list on ${JSON.stringify(url)}: got ${fromExtension}, expected ${id}`);
  if (fromApp !== fromExtension) failures.push(`the two parsers have drifted on ${JSON.stringify(url)}: app ${fromApp}, extension ${fromExtension}`);

  if (id) {
    const handedOver = app.youTubeWatchUrl(id);
    if (app.youTubeVideoId(handedOver) !== id) {
      failures.push(`the handed-over link for ${id} does not parse back to it: ${handedOver}`);
    }
  }
}

for (const bad of ["", "   ", "short", "way-too-long-for-an-id", "has spaces", "../../etc"]) {
  if (app.youTubeWatchUrl(bad) !== null) failures.push(`youTubeWatchUrl accepted ${JSON.stringify(bad)}`);
}

if (failures.length) {
  console.error(`${failures.length} problem(s):`);
  for (const bad of failures) console.error(`  ${bad}`);
  process.exit(1);
}

console.log(`Both YouTube parsers agree on all ${cases.length} urls, and every handed-over link parses back.`);
