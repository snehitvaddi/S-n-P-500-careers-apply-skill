import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { Company, Playbook } from "./types.js";
import { buildATSIndex } from "./build-ats-index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const ROOT = join(__dirname, "..");

// ── Helpers ──────────────────────────────────────────────────────────────────

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

// ── Playbook Template ────────────────────────────────────────────────────────

function createPlaybookStub(company: Company): Playbook {
  return {
    ticker: company.ticker,
    company_name: company.name,
    ats_platform: company.ats_platform,
    careers_url: company.careers_url,
    application_url: "",
    api_endpoint: company.api_endpoint ?? "",
    search_filters: [],
    application_flow: [],
    quirks: [],
    verified: false,
    last_verified: "",
    notes: "",
  };
}

// ── Main Seeder ──────────────────────────────────────────────────────────────

async function main() {
  const companiesPath = join(ROOT, "data", "companies.json");
  const tickerDir = join(ROOT, "playbooks", "by-ticker");

  // Ensure directories exist
  await mkdir(join(ROOT, "data"), { recursive: true });
  await mkdir(tickerDir, { recursive: true });
  await mkdir(join(ROOT, "playbooks", "by-ats"), { recursive: true });

  // 1. Read companies.json
  let companies: Company[];

  if (await fileExists(companiesPath)) {
    console.log("[seed] Reading existing data/companies.json...");
    const raw = await readFile(companiesPath, "utf-8");
    companies = JSON.parse(raw);
    console.log(`[seed] Found ${companies.length} companies.`);
  } else {
    console.log("[seed] data/companies.json not found. Creating empty file.");
    console.log("[seed] Run 'npm run diff' after adding companies to populate the list.");
    companies = [];
    await writeFile(companiesPath, JSON.stringify(companies, null, 2) + "\n", "utf-8");
  }

  // 2. For each company, create a stub playbook if one doesn't exist
  let created = 0;
  let skipped = 0;

  for (const company of companies) {
    const playbookPath = join(tickerDir, `${company.ticker}.json`);

    if (await fileExists(playbookPath)) {
      skipped++;
      continue;
    }

    const playbook = createPlaybookStub(company);
    await writeFile(playbookPath, JSON.stringify(playbook, null, 2) + "\n", "utf-8");
    console.log(`[seed] Created playbook: ${company.ticker} (${company.ats_platform})`);
    created++;
  }

  // 3. Rebuild ATS index
  console.log("\n[seed] Rebuilding ATS index...");
  await buildATSIndex();

  // 4. Summary
  console.log("\n--- Seed Summary ---");
  console.log(`Total companies:     ${companies.length}`);
  console.log(`Playbooks created:   ${created}`);
  console.log(`Playbooks existing:  ${skipped}`);
  console.log("Done.");
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
