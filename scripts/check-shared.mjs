#!/usr/bin/env node
/**
 * Guards the files that are meant to be byte-identical between tlm-frontend and
 * tlm-frontend-service.
 *
 * The two apps are separate git repos, so neither one's CI can see the other's copy of a shared
 * file. Instead both repos commit the SAME manifest of expected content hashes, and each verifies
 * its own copies against it. Editing a shared file in one repo without making the identical edit
 * in the other leaves the manifest disagreeing with at least one repo, so the drift fails a check
 * instead of being discovered months later when a bug is fixed in one app and not the other.
 *
 *   npm run check:shared            verify (this is what `npm test` runs)
 *   npm run check:shared -- --update  re-hash after an intentional shared change
 *
 * Changing a shared file is therefore a three-part edit: change it in BOTH repos, then --update in
 * both. If a file genuinely needs to differ per app, remove it from the manifest rather than
 * letting the hashes drift apart.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(repoRoot, "shared-files.json");
const update = process.argv.includes("--update");

if (!existsSync(manifestPath)) {
  console.error(`Missing ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const paths = Object.keys(manifest.files).sort();

// Normalize line endings so a checkout with different git autocrlf settings isn't reported as
// drift — the guarantee here is about content, not about how a working tree stores it.
const hash = (p) => createHash("sha256").update(readFileSync(p, "utf8").replace(/\r\n/g, "\n")).digest("hex");

const missing = [];
const drifted = [];
const next = {};

for (const rel of paths) {
  const abs = join(repoRoot, rel);
  if (!existsSync(abs)) {
    missing.push(rel);
    continue;
  }
  const actual = hash(abs);
  next[rel] = actual;
  if (actual !== manifest.files[rel]) drifted.push(rel);
}

if (update) {
  if (missing.length) {
    console.error(`Cannot update: ${missing.length} manifest file(s) missing from this repo:`);
    for (const m of missing) console.error(`  ${m}`);
    process.exit(1);
  }
  writeFileSync(manifestPath, `${JSON.stringify({ ...manifest, files: next }, null, 2)}\n`);
  console.log(`Updated ${manifestPath} (${paths.length} files).`);
  console.log("Now make the identical change and run this in the OTHER frontend repo too.");
  process.exit(0);
}

if (!missing.length && !drifted.length) {
  console.log(`check:shared — ${paths.length} shared files match the manifest.`);
  process.exit(0);
}

if (missing.length) {
  console.error(`\n${missing.length} shared file(s) missing from this repo:`);
  for (const m of missing) console.error(`  ${m}`);
}
if (drifted.length) {
  console.error(`\n${drifted.length} shared file(s) differ from the manifest:`);
  for (const d of drifted) console.error(`  ${d}`);
  console.error(
    "\nThese files are meant to be identical in tlm-frontend and tlm-frontend-service." +
      "\nIf the change is intentional, apply it in BOTH repos and run `npm run check:shared -- --update` in each." +
      "\nIf this file should now differ per app, drop it from shared-files.json in both repos."
  );
}
process.exit(1);
