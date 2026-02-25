import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

async function main() {
  const companies = JSON.parse(await readFile(join(ROOT, "data", "companies-full.json"), "utf8"));
  const raw = JSON.parse(await readFile(join(ROOT, "data", "sp500-full-raw.json"), "utf8"));

  const rawMap = new Map<string, any>();
  for (const r of raw) rawMap.set(r.ticker, r);

  let fixed = 0;
  for (const c of companies) {
    const r = rawMap.get(c.ticker);
    if (r) {
      if (c.sector === "Unknown" || c.sector === "Information Technology" || !c.sector) {
        if (r.sector) { c.sector = r.sector; fixed++; }
      }
      if (!c.subsector && r.subsector) c.subsector = r.subsector;
    }
  }

  await writeFile(join(ROOT, "data", "companies-full.json"), JSON.stringify(companies, null, 2));
  console.log(`Fixed sectors for ${fixed} companies`);
}

main().catch(console.error);
