import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Company, ChangelogEntry } from "./types.js";
import { fetchSP500IT } from "./fetch-sp500.js";
import type { SP500Company } from "./fetch-sp500.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const ROOT = join(__dirname, "..");

// ── Types ────────────────────────────────────────────────────────────────────

export interface DiffResult {
  additions: SP500Company[];
  removals: Company[];
  unchanged: number;
  changelog: ChangelogEntry[];
}

// ── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Compare stored companies against the current S&P 500 IT sector list
 * from Wikipedia. Returns additions, removals, and changelog entries.
 */
export async function diffConstituents(): Promise<DiffResult> {
  // 1. Load stored companies
  const companiesPath = join(ROOT, "data", "companies.json");
  let stored: Company[];

  try {
    const raw = await readFile(companiesPath, "utf-8");
    stored = JSON.parse(raw);
  } catch {
    console.log("[diff] No data/companies.json found. Treating stored list as empty.");
    stored = [];
  }

  // 2. Fetch current list from Wikipedia
  const current = await fetchSP500IT();

  // 3. Build lookup sets
  const storedTickers = new Set(stored.map((c) => c.ticker));
  const currentTickers = new Set(current.map((c) => c.ticker));

  // 4. Find additions (in current but not in stored)
  const additions = current.filter((c) => !storedTickers.has(c.ticker));

  // 5. Find removals (in stored but not in current)
  const removals = stored.filter((c) => !currentTickers.has(c.ticker));

  // 6. Count unchanged
  const unchanged = stored.filter((c) => currentTickers.has(c.ticker)).length;

  // 7. Build changelog entries
  const today = new Date().toISOString().split("T")[0];
  const changelog: ChangelogEntry[] = [];

  for (const company of additions) {
    changelog.push({
      date: today,
      type: "company_added",
      ticker: company.ticker,
      details: `${company.name} added to S&P 500 IT sector (${company.subsector})`,
    });
  }

  for (const company of removals) {
    changelog.push({
      date: today,
      type: "company_removed",
      ticker: company.ticker,
      details: `${company.name} removed from S&P 500 IT sector`,
    });
  }

  return { additions, removals, unchanged, changelog };
}

// ── CLI Output ───────────────────────────────────────────────────────────────

function printDiff(result: DiffResult) {
  console.log("\n--- S&P 500 IT Sector Diff ---\n");

  if (result.additions.length === 0 && result.removals.length === 0) {
    console.log("No changes detected. Stored list matches current S&P 500 IT constituents.");
    console.log(`Unchanged: ${result.unchanged} companies`);
    return;
  }

  if (result.additions.length > 0) {
    console.log(`Additions (${result.additions.length}):`);
    for (const c of result.additions) {
      console.log(`  + ${c.ticker.padEnd(8)} ${c.name.padEnd(35)} ${c.subsector}`);
    }
    console.log();
  }

  if (result.removals.length > 0) {
    console.log(`Removals (${result.removals.length}):`);
    for (const c of result.removals) {
      console.log(`  - ${c.ticker.padEnd(8)} ${c.name.padEnd(35)} ${c.subsector}`);
    }
    console.log();
  }

  console.log(`Summary:`);
  console.log(`  Additions: ${result.additions.length}`);
  console.log(`  Removals:  ${result.removals.length}`);
  console.log(`  Unchanged: ${result.unchanged}`);
}

// ── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const result = await diffConstituents();
  printDiff(result);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
