import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ChangelogEntry } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const ROOT = join(__dirname, "..");

// ── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Append new changelog entries to data/changelog.json and print a summary.
 */
export async function appendChangelog(newEntries: ChangelogEntry[]): Promise<ChangelogEntry[]> {
  const changelogPath = join(ROOT, "data", "changelog.json");
  await mkdir(join(ROOT, "data"), { recursive: true });

  // 1. Read existing changelog
  let existing: ChangelogEntry[] = [];
  try {
    const raw = await readFile(changelogPath, "utf-8");
    existing = JSON.parse(raw);
  } catch {
    // File doesn't exist yet; start fresh
  }

  if (newEntries.length === 0) {
    console.log("[report] No new entries to append.");
    return existing;
  }

  // 2. Append new entries
  const merged = [...existing, ...newEntries];

  // 3. Write back
  await writeFile(changelogPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");

  console.log(`[report] Appended ${newEntries.length} entries to changelog (total: ${merged.length}).`);

  return merged;
}

/**
 * Print a human-readable summary of changelog entries.
 */
export function printChangelogSummary(entries: ChangelogEntry[]) {
  if (entries.length === 0) {
    console.log("\n--- Changelog ---\nNo entries.\n");
    return;
  }

  // Group by date
  const byDate = new Map<string, ChangelogEntry[]>();
  for (const entry of entries) {
    const date = entry.date;
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date)!.push(entry);
  }

  // Sort dates descending (most recent first)
  const sortedDates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));

  console.log("\n--- Changelog ---\n");

  for (const date of sortedDates) {
    console.log(`${date}:`);
    const dayEntries = byDate.get(date)!;

    // Group by type for summary
    const byType = new Map<string, ChangelogEntry[]>();
    for (const entry of dayEntries) {
      if (!byType.has(entry.type)) byType.set(entry.type, []);
      byType.get(entry.type)!.push(entry);
    }

    for (const [type, typeEntries] of byType) {
      const label = formatType(type);
      console.log(`  ${label} (${typeEntries.length}):`);
      for (const entry of typeEntries) {
        const detail = entry.old_value && entry.new_value
          ? `${entry.details} [${entry.old_value} -> ${entry.new_value}]`
          : entry.details;
        console.log(`    - ${entry.ticker}: ${detail}`);
      }
    }
    console.log();
  }
}

function formatType(type: string): string {
  const labels: Record<string, string> = {
    company_added: "Companies Added",
    company_removed: "Companies Removed",
    ats_changed: "ATS Changes",
    url_changed: "URL Changes",
    url_broken: "Broken URLs",
    url_fixed: "URLs Fixed",
    verified: "Verified",
  };
  return labels[type] ?? type;
}

// ── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const changelogPath = join(ROOT, "data", "changelog.json");

  // Read the full changelog and print summary
  let entries: ChangelogEntry[] = [];
  try {
    const raw = await readFile(changelogPath, "utf-8");
    entries = JSON.parse(raw);
  } catch {
    console.log("[report] No changelog found at data/changelog.json.");
  }

  printChangelogSummary(entries);

  // Print stats
  const types = new Map<string, number>();
  for (const e of entries) {
    types.set(e.type, (types.get(e.type) ?? 0) + 1);
  }

  if (entries.length > 0) {
    console.log("--- Stats ---");
    console.log(`Total entries: ${entries.length}`);
    for (const [type, count] of [...types.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${formatType(type)}: ${count}`);
    }
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
