import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Company, SlugExport } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const ROOT = join(__dirname, "..");

// ── Types ────────────────────────────────────────────────────────────────────

interface WorkdayExportEntry {
  ticker: string;
  name: string;
  slug: string;
  careers_url: string;
}

// ── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Generate export files in exports/ for downstream consumers (AI agents, scrapers, etc.).
 */
export async function generateExports(): Promise<void> {
  const companiesPath = join(ROOT, "data", "companies.json");
  const exportsDir = join(ROOT, "exports");

  await mkdir(exportsDir, { recursive: true });

  // Read companies
  let companies: Company[];
  try {
    const raw = await readFile(companiesPath, "utf-8");
    companies = JSON.parse(raw);
  } catch {
    console.error("[export] Could not read data/companies.json. Run 'npm run seed' first.");
    process.exit(1);
  }

  const today = new Date().toISOString().split("T")[0];

  // Group companies by platform
  const byPlatform = new Map<string, Company[]>();
  for (const company of companies) {
    const platform = company.ats_platform;
    if (!byPlatform.has(platform)) byPlatform.set(platform, []);
    byPlatform.get(platform)!.push(company);
  }

  // 1. greenhouse-slugs.json
  const greenhouseCompanies = byPlatform.get("greenhouse") ?? [];
  const greenhouseExport: SlugExport = {
    platform: "greenhouse",
    slugs: greenhouseCompanies.map((c) => ({
      slug: c.slug,
      ticker: c.ticker,
      name: c.name,
      api_endpoint: c.api_endpoint,
    })),
    generated: today,
  };
  await writeFile(
    join(exportsDir, "greenhouse-slugs.json"),
    JSON.stringify(greenhouseExport, null, 2) + "\n",
    "utf-8",
  );
  console.log(`[export] greenhouse-slugs.json: ${greenhouseCompanies.length} companies`);

  // 2. lever-slugs.json
  const leverCompanies = byPlatform.get("lever") ?? [];
  const leverExport: SlugExport = {
    platform: "lever",
    slugs: leverCompanies.map((c) => ({
      slug: c.slug,
      ticker: c.ticker,
      name: c.name,
    })),
    generated: today,
  };
  await writeFile(
    join(exportsDir, "lever-slugs.json"),
    JSON.stringify(leverExport, null, 2) + "\n",
    "utf-8",
  );
  console.log(`[export] lever-slugs.json: ${leverCompanies.length} companies`);

  // 3. ashby-slugs.json
  const ashbyCompanies = byPlatform.get("ashby") ?? [];
  const ashbyExport: SlugExport = {
    platform: "ashby",
    slugs: ashbyCompanies.map((c) => ({
      slug: c.slug,
      ticker: c.ticker,
      name: c.name,
    })),
    generated: today,
  };
  await writeFile(
    join(exportsDir, "ashby-slugs.json"),
    JSON.stringify(ashbyExport, null, 2) + "\n",
    "utf-8",
  );
  console.log(`[export] ashby-slugs.json: ${ashbyCompanies.length} companies`);

  // 4. workday-urls.json
  const workdayCompanies = byPlatform.get("workday") ?? [];
  const workdayExport = {
    platform: "workday",
    companies: workdayCompanies.map(
      (c): WorkdayExportEntry => ({
        ticker: c.ticker,
        name: c.name,
        slug: c.slug,
        careers_url: c.careers_url,
      }),
    ),
    generated: today,
  };
  await writeFile(
    join(exportsDir, "workday-urls.json"),
    JSON.stringify(workdayExport, null, 2) + "\n",
    "utf-8",
  );
  console.log(`[export] workday-urls.json: ${workdayCompanies.length} companies`);

  // 5. all-companies.md — Markdown table for AI agents
  const sorted = [...companies].sort((a, b) => a.ticker.localeCompare(b.ticker));
  const lines: string[] = [
    `# S&P 500 IT Sector — Career Pages`,
    ``,
    `> Generated: ${today}`,
    `> Total: ${companies.length} companies`,
    ``,
    `| Ticker | Company | ATS | Careers URL | H1B | Status |`,
    `|--------|---------|-----|-------------|-----|--------|`,
  ];

  for (const c of sorted) {
    const h1b = c.h1b_sponsor ? "Yes" : "No";
    lines.push(
      `| ${c.ticker} | ${c.name} | ${c.ats_platform} | ${c.careers_url} | ${h1b} | ${c.status} |`,
    );
  }

  lines.push(
    ``,
    `## By ATS Platform`,
    ``,
  );

  for (const [platform, platformCompanies] of [...byPlatform.entries()].sort()) {
    lines.push(`- **${platform}** (${platformCompanies.length}): ${platformCompanies.map((c) => c.ticker).join(", ")}`);
  }

  lines.push("");

  await writeFile(join(exportsDir, "all-companies.md"), lines.join("\n"), "utf-8");
  console.log(`[export] all-companies.md: ${companies.length} companies`);

  // Summary
  console.log(`\n[export] Done. ${5} export files written to exports/`);
}

// ── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  await generateExports();
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
