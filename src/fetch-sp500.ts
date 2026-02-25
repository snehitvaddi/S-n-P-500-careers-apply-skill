import { fileURLToPath } from "node:url";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SP500Company {
  ticker: string;
  name: string;
  sector: string;
  subsector: string;
}

// ── Wikipedia API ────────────────────────────────────────────────────────────

const WIKIPEDIA_API =
  "https://en.wikipedia.org/w/api.php?action=parse&page=List_of_S%26P_500_companies&prop=wikitext&format=json";

/**
 * Fetch the current S&P 500 IT sector companies from Wikipedia.
 *
 * Parses the wiki table on the "List of S&P 500 companies" page and
 * filters for GICS Sector = "Information Technology".
 */
export async function fetchSP500IT(): Promise<SP500Company[]> {
  console.log("[fetch-sp500] Fetching S&P 500 list from Wikipedia...");

  const response = await fetch(WIKIPEDIA_API, {
    headers: {
      "User-Agent": "sp500-careers/1.0 (https://github.com/snehitvaddi; vaddisnehit@gmail.com)",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Wikipedia API returned ${response.status}: ${response.statusText}`);
  }

  const data = (await response.json()) as {
    parse: { wikitext: { "*": string } };
  };

  const wikitext = data.parse.wikitext["*"];
  return parseWikiTable(wikitext);
}

/**
 * Parse the MediaWiki table markup to extract company rows.
 *
 * The table has columns:
 *   Symbol | Security | GICS Sector | GICS Sub-Industry | ...
 *
 * Each row starts with `|-` and cells are delimited by `|` or `||`.
 */
function parseWikiTable(wikitext: string): SP500Company[] {
  const companies: SP500Company[] = [];

  // Split into lines and find the first wikitable
  const lines = wikitext.split("\n");
  let inTable = false;
  let currentRow: string[] = [];
  const rows: string[][] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Start of wikitable
    if (trimmed.startsWith("{| class=\"wikitable")) {
      inTable = true;
      continue;
    }

    // End of wikitable — stop at the first table (the current constituents)
    if (inTable && trimmed === "|}") {
      if (currentRow.length > 0) rows.push(currentRow);
      break;
    }

    if (!inTable) continue;

    // Header row marker — skip
    if (trimmed.startsWith("!")) continue;

    // New row
    if (trimmed === "|-") {
      if (currentRow.length > 0) {
        rows.push(currentRow);
      }
      currentRow = [];
      continue;
    }

    // Cell data
    if (trimmed.startsWith("|")) {
      // Handle multiple cells on one line separated by ||
      const cells = trimmed
        .substring(1)
        .split("||")
        .map((c) => c.trim());
      currentRow.push(...cells);
    }
  }

  // Parse each row — expected columns:
  // 0: Symbol (ticker), 1: Security (name), 2: GICS Sector, 3: GICS Sub-Industry, ...
  for (const row of rows) {
    if (row.length < 4) continue;

    const ticker = cleanWikiCell(row[0]);
    const name = cleanWikiCell(row[1]);
    const sector = cleanWikiCell(row[2]);
    const subsector = cleanWikiCell(row[3]);

    if (!ticker || !sector) continue;

    // Filter for Information Technology sector
    if (sector === "Information Technology") {
      companies.push({ ticker, name, sector, subsector });
    }
  }

  console.log(`[fetch-sp500] Found ${companies.length} IT sector companies.`);
  return companies;
}

/**
 * Clean a wiki cell value:
 * - Remove [[ ]] link markup
 * - Remove {{ }} template markup
 * - Strip leading/trailing whitespace and pipes
 */
function cleanWikiCell(raw: string): string {
  let val = raw.trim();

  // Remove any leading pipe character (from cell formatting like "| value")
  if (val.startsWith("|")) val = val.substring(1).trim();

  // Handle wiki links: [[Target|Display]] → Display, [[Target]] → Target
  val = val.replace(/\[\[([^\]|]*)\|([^\]]*)\]\]/g, "$2");
  val = val.replace(/\[\[([^\]]*)\]\]/g, "$1");

  // Remove template markup {{...}}
  val = val.replace(/\{\{[^}]*\}\}/g, "");

  // Remove HTML tags
  val = val.replace(/<[^>]*>/g, "");

  // Remove sort keys and other wiki formatting
  val = val.replace(/data-sort-value="[^"]*"\s*\|/g, "");

  return val.trim();
}

// ── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const companies = await fetchSP500IT();

  console.log("\n--- S&P 500 Information Technology Companies ---\n");
  console.log(`${"Ticker".padEnd(8)} ${"Name".padEnd(40)} ${"Sub-Industry"}`);
  console.log("-".repeat(80));

  for (const c of companies.sort((a, b) => a.ticker.localeCompare(b.ticker))) {
    console.log(`${c.ticker.padEnd(8)} ${c.name.padEnd(40)} ${c.subsector}`);
  }

  console.log(`\nTotal: ${companies.length} companies`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
