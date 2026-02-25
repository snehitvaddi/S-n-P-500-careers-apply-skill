import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Company, ChangelogEntry } from "./types.js";
import { detectATSFromUrl } from "./detect-ats.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const ROOT = join(__dirname, "..");

// ── Types ────────────────────────────────────────────────────────────────────

export interface VerifyResult {
  ticker: string;
  url: string;
  status: number;
  redirected: boolean;
  redirect_url?: string;
  ats_detected?: string;
  ats_changed: boolean;
  error?: string;
}

// ── Concurrency Limiter ──────────────────────────────────────────────────────

async function parallelLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const i = index++;
      results[i] = await fn(items[i]);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── Single URL Verification ──────────────────────────────────────────────────

async function verifyOne(company: Company): Promise<VerifyResult> {
  const result: VerifyResult = {
    ticker: company.ticker,
    url: company.careers_url,
    status: 0,
    redirected: false,
    ats_changed: false,
  };

  try {
    const response = await fetch(company.careers_url, {
      method: "HEAD",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });

    result.status = response.status;
    result.redirected = response.redirected;

    if (response.redirected) {
      result.redirect_url = response.url;
    }

    // Detect ATS from the final URL
    const finalUrl = response.redirected ? response.url : company.careers_url;
    const detection = detectATSFromUrl(finalUrl);

    if (detection) {
      result.ats_detected = detection.platform;
      result.ats_changed = detection.platform !== company.ats_platform;
    }
  } catch (err) {
    result.error = err instanceof Error ? err.message : String(err);
    result.status = 0;
  }

  return result;
}

// ── Main Verification Run ────────────────────────────────────────────────────

export async function verifyAllCareers(): Promise<{
  results: VerifyResult[];
  changelog: ChangelogEntry[];
}> {
  const companiesPath = join(ROOT, "data", "companies.json");
  let companies: Company[];

  try {
    const raw = await readFile(companiesPath, "utf-8");
    companies = JSON.parse(raw);
  } catch {
    console.error("[verify] Could not read data/companies.json. Run 'npm run seed' first.");
    process.exit(1);
  }

  console.log(`[verify] Verifying ${companies.length} career URLs (max 10 concurrent)...\n`);

  const results = await parallelLimit(companies, 10, verifyOne);

  // Build changelog entries for issues
  const today = new Date().toISOString().split("T")[0];
  const changelog: ChangelogEntry[] = [];

  for (const r of results) {
    if (r.error || r.status >= 400) {
      changelog.push({
        date: today,
        type: "url_broken",
        ticker: r.ticker,
        details: r.error ?? `HTTP ${r.status}`,
        old_value: r.url,
      });
    }

    if (r.ats_changed && r.ats_detected) {
      const company = companies.find((c) => c.ticker === r.ticker)!;
      changelog.push({
        date: today,
        type: "ats_changed",
        ticker: r.ticker,
        details: `ATS changed from ${company.ats_platform} to ${r.ats_detected}`,
        old_value: company.ats_platform,
        new_value: r.ats_detected,
      });
    }

    if (r.redirected && r.redirect_url) {
      changelog.push({
        date: today,
        type: "url_changed",
        ticker: r.ticker,
        details: `Redirected to ${r.redirect_url}`,
        old_value: r.url,
        new_value: r.redirect_url,
      });
    }
  }

  return { results, changelog };
}

// ── CLI Output ───────────────────────────────────────────────────────────────

function printSummary(results: VerifyResult[]) {
  const ok = results.filter((r) => r.status >= 200 && r.status < 400 && !r.error);
  const broken = results.filter((r) => r.status >= 400 || r.error);
  const redirected = results.filter((r) => r.redirected);
  const atsChanged = results.filter((r) => r.ats_changed);

  console.log("\n--- Verification Summary ---\n");
  console.log(
    `${"Ticker".padEnd(8)} ${"Status".padEnd(8)} ${"ATS Change".padEnd(14)} ${"Notes"}`,
  );
  console.log("-".repeat(80));

  for (const r of results) {
    const status = r.error ? "ERR" : String(r.status);
    const atsNote = r.ats_changed ? `-> ${r.ats_detected}` : "";
    const notes = [
      r.redirected ? `redirect: ${r.redirect_url}` : "",
      r.error ? `error: ${r.error}` : "",
    ]
      .filter(Boolean)
      .join("; ");

    console.log(
      `${r.ticker.padEnd(8)} ${status.padEnd(8)} ${atsNote.padEnd(14)} ${notes}`,
    );
  }

  console.log(`\nTotal:       ${results.length}`);
  console.log(`OK:          ${ok.length}`);
  console.log(`Broken:      ${broken.length}`);
  console.log(`Redirected:  ${redirected.length}`);
  console.log(`ATS Changed: ${atsChanged.length}`);

  // Print broken URLs in detail
  if (broken.length > 0) {
    console.log("\n--- Broken URLs ---\n");
    for (const r of broken) {
      console.log(`  ${r.ticker}: ${r.url}`);
      console.log(`    Status: ${r.status || "N/A"}, Error: ${r.error || "N/A"}`);
    }
  }
}

// ── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const { results, changelog } = await verifyAllCareers();
  printSummary(results);

  // Write changelog entries if any
  if (changelog.length > 0) {
    const changelogPath = join(ROOT, "data", "changelog.json");
    let existing: ChangelogEntry[] = [];
    try {
      const raw = await readFile(changelogPath, "utf-8");
      existing = JSON.parse(raw);
    } catch {
      // File doesn't exist yet
    }

    const merged = [...existing, ...changelog];
    await writeFile(changelogPath, JSON.stringify(merged, null, 2) + "\n", "utf-8");
    console.log(`\n[verify] Wrote ${changelog.length} changelog entries.`);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
