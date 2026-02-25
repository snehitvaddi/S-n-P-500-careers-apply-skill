import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import type { ChangelogEntry } from "./types.js";
import { diffConstituents } from "./diff-constituents.js";
import { verifyAllCareers } from "./verify-careers.js";
import { buildATSIndex } from "./build-ats-index.js";
import { appendChangelog, printChangelogSummary } from "./generate-report.js";
import { generateExports } from "./export.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const ROOT = join(__dirname, "..");

// ── Helpers ──────────────────────────────────────────────────────────────────

function hr(label: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  STEP: ${label}`);
  console.log(`${"=".repeat(60)}\n`);
}

function gitAutoCommit(message: string) {
  try {
    // Check if we're in a git repo
    execSync("git rev-parse --is-inside-work-tree", {
      cwd: ROOT,
      stdio: "pipe",
    });

    // Check if there are changes to commit
    const status = execSync("git status --porcelain", {
      cwd: ROOT,
      encoding: "utf-8",
    }).trim();

    if (!status) {
      console.log("[cron] No changes to commit.");
      return;
    }

    // Stage and commit
    execSync("git add -A", { cwd: ROOT, stdio: "pipe" });
    execSync(`git commit -m "${message.replace(/"/g, '\\"')}"`, {
      cwd: ROOT,
      stdio: "pipe",
    });

    console.log(`[cron] Auto-committed: "${message}"`);
  } catch {
    console.log("[cron] Not a git repository or git commit failed. Skipping auto-commit.");
  }
}

// ── Main Orchestrator ────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  const today = new Date().toISOString().split("T")[0];
  const allChangelog: ChangelogEntry[] = [];
  let hasChanges = false;

  console.log(`[cron] Starting full run at ${new Date().toISOString()}`);
  console.log(`[cron] Project root: ${ROOT}`);

  // ── Step 1: Fetch S&P 500 + Diff ─────────────────────────────────────────
  hr("1/6 — Fetch S&P 500 IT & Diff Constituents");
  try {
    const diff = await diffConstituents();
    if (diff.changelog.length > 0) {
      allChangelog.push(...diff.changelog);
      hasChanges = true;
      console.log(`[cron] Found ${diff.additions.length} additions, ${diff.removals.length} removals.`);
    } else {
      console.log("[cron] No constituent changes.");
    }
  } catch (err) {
    console.error(`[cron] Diff failed: ${err}`);
  }

  // ── Step 2: Verify Career URLs ────────────────────────────────────────────
  hr("2/6 — Verify Career URLs");
  try {
    const { results, changelog } = await verifyAllCareers();
    if (changelog.length > 0) {
      allChangelog.push(...changelog);
      hasChanges = true;
    }

    const broken = results.filter((r) => r.status >= 400 || r.error);
    const atsChanged = results.filter((r) => r.ats_changed);
    console.log(`[cron] Verified ${results.length} URLs. Broken: ${broken.length}, ATS changes: ${atsChanged.length}`);
  } catch (err) {
    console.error(`[cron] Verify failed: ${err}`);
  }

  // ── Step 3: Build ATS Index ───────────────────────────────────────────────
  hr("3/6 — Build ATS Index");
  try {
    const indexes = await buildATSIndex();
    if (indexes.size > 0) {
      hasChanges = true;
    }
  } catch (err) {
    console.error(`[cron] ATS index build failed: ${err}`);
  }

  // ── Step 4: Generate Report / Append Changelog ────────────────────────────
  hr("4/6 — Generate Report");
  try {
    const merged = await appendChangelog(allChangelog);
    printChangelogSummary(allChangelog);
  } catch (err) {
    console.error(`[cron] Report generation failed: ${err}`);
  }

  // ── Step 5: Export Files ──────────────────────────────────────────────────
  hr("5/6 — Export Files");
  try {
    await generateExports();
  } catch (err) {
    console.error(`[cron] Export failed: ${err}`);
  }

  // ── Step 6: Auto-Commit ───────────────────────────────────────────────────
  hr("6/6 — Auto-Commit");
  if (hasChanges) {
    const summary = [
      allChangelog.filter((e) => e.type === "company_added").length > 0
        ? `+${allChangelog.filter((e) => e.type === "company_added").length} companies`
        : "",
      allChangelog.filter((e) => e.type === "company_removed").length > 0
        ? `-${allChangelog.filter((e) => e.type === "company_removed").length} companies`
        : "",
      allChangelog.filter((e) => e.type === "ats_changed").length > 0
        ? `${allChangelog.filter((e) => e.type === "ats_changed").length} ATS changes`
        : "",
      allChangelog.filter((e) => e.type === "url_broken").length > 0
        ? `${allChangelog.filter((e) => e.type === "url_broken").length} broken URLs`
        : "",
    ]
      .filter(Boolean)
      .join(", ");

    const commitMsg = `chore: cron update ${today}${summary ? ` (${summary})` : ""}`;
    gitAutoCommit(commitMsg);
  } else {
    console.log("[cron] No changes detected. Skipping commit.");
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[cron] Completed in ${elapsed}s. Changelog entries: ${allChangelog.length}.`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
