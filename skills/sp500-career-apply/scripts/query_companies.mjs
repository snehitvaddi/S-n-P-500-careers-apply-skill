#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function normalizeBool(value) {
  if (value === undefined) return undefined;
  const v = String(value).toLowerCase();
  if (["true", "1", "yes", "y"].includes(v)) return true;
  if (["false", "0", "no", "n"].includes(v)) return false;
  return undefined;
}

async function main() {
  const args = parseArgs(process.argv);
  const datasetPath = resolve(
    process.cwd(),
    String(args.dataset || "data/llm-careers-dataset.json")
  );

  const raw = JSON.parse(await readFile(datasetPath, "utf8"));
  let companies = Array.isArray(raw.companies) ? raw.companies : [];

  const ats = args.ats ? String(args.ats).toLowerCase() : undefined;
  const sector = args.sector ? String(args.sector).toLowerCase() : undefined;
  const requiresAccount = normalizeBool(args["requires-account"]);
  const tickerPrefix = args["ticker-prefix"]
    ? String(args["ticker-prefix"]).toUpperCase()
    : undefined;
  const limit = Number(args.limit || 25);

  if (ats) {
    companies = companies.filter((c) => String(c.ats || "").toLowerCase() === ats);
  }
  if (sector) {
    companies = companies.filter((c) =>
      String(c.sector || "").toLowerCase().includes(sector)
    );
  }
  if (requiresAccount !== undefined) {
    companies = companies.filter(
      (c) => Boolean(c.application_profile?.requires_account) === requiresAccount
    );
  }
  if (tickerPrefix) {
    companies = companies.filter((c) =>
      String(c.ticker || "").toUpperCase().startsWith(tickerPrefix)
    );
  }

  companies = companies
    .sort((a, b) => String(a.ticker).localeCompare(String(b.ticker)))
    .slice(0, Number.isFinite(limit) && limit > 0 ? limit : 25)
    .map((c) => ({
      ticker: c.ticker,
      company: c.company,
      ats: c.ats,
      sector: c.sector,
      careers_url_final: c.careers_url_final || c.careers_url,
      requires_account: Boolean(c.application_profile?.requires_account),
      filters: c.application_profile?.search_filters || [],
      apply_links: c.application_profile?.apply_links || [],
      form_field_count: Array.isArray(c.application_profile?.form_fields)
        ? c.application_profile.form_fields.length
        : 0,
    }));

  console.log(JSON.stringify({ count: companies.length, companies }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
