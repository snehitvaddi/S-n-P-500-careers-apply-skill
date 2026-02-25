import { readFile, writeFile, readdir, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ATSIndex, ATSPlatformId } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const ROOT = join(__dirname, "..");

// ── Types ────────────────────────────────────────────────────────────────────

interface PlaybookStub {
  ticker: string;
  company_name: string;
  ats_platform: string;
  slug?: string;
  careers_url: string;
  api_endpoint?: string;
}

// ── Core Logic ───────────────────────────────────────────────────────────────

/**
 * Read all playbook files from playbooks/by-ticker/ and group them by ATS platform.
 * Write an index file for each platform into playbooks/by-ats/{platform}.json.
 */
export async function buildATSIndex(): Promise<Map<string, ATSIndex>> {
  const tickerDir = join(ROOT, "playbooks", "by-ticker");
  const atsDir = join(ROOT, "playbooks", "by-ats");

  // Ensure output directory exists
  await mkdir(atsDir, { recursive: true });

  // Read all playbook files
  let files: string[];
  try {
    files = await readdir(tickerDir);
  } catch {
    console.log("[build-ats-index] No playbooks/by-ticker/ directory found. Nothing to index.");
    return new Map();
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  if (jsonFiles.length === 0) {
    console.log("[build-ats-index] No playbook files found in playbooks/by-ticker/.");
    return new Map();
  }

  // Group by platform
  const byPlatform = new Map<
    string,
    Array<{
      ticker: string;
      name: string;
      slug: string;
      careers_url: string;
      api_endpoint?: string;
    }>
  >();

  let parsed = 0;
  let errors = 0;

  for (const file of jsonFiles) {
    try {
      const raw = await readFile(join(tickerDir, file), "utf-8");
      const playbook: PlaybookStub = JSON.parse(raw);

      const platform = playbook.ats_platform || "custom";
      if (!byPlatform.has(platform)) {
        byPlatform.set(platform, []);
      }

      // Derive slug from ticker if not present
      const slug =
        playbook.slug ?? file.replace(".json", "").toLowerCase();

      byPlatform.get(platform)!.push({
        ticker: playbook.ticker,
        name: playbook.company_name,
        slug,
        careers_url: playbook.careers_url,
        api_endpoint: playbook.api_endpoint,
      });

      parsed++;
    } catch (err) {
      console.error(`[build-ats-index] Error reading ${file}: ${err}`);
      errors++;
    }
  }

  // Write index files
  const today = new Date().toISOString().split("T")[0];
  const indexes = new Map<string, ATSIndex>();

  for (const [platform, companies] of byPlatform) {
    // Sort companies by ticker
    companies.sort((a, b) => a.ticker.localeCompare(b.ticker));

    const index: ATSIndex = {
      platform: platform as ATSPlatformId,
      count: companies.length,
      companies,
      last_updated: today,
    };

    const outPath = join(atsDir, `${platform}.json`);
    await writeFile(outPath, JSON.stringify(index, null, 2) + "\n", "utf-8");
    indexes.set(platform, index);

    console.log(`[build-ats-index] ${platform}: ${companies.length} companies -> ${outPath}`);
  }

  console.log(
    `\n[build-ats-index] Done. Parsed ${parsed} playbooks, wrote ${indexes.size} index files.${errors > 0 ? ` (${errors} errors)` : ""}`,
  );

  return indexes;
}

// ── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  await buildATSIndex();
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
