import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

type Company = {
  ticker: string;
  name: string;
  sector?: string;
  subsector?: string;
  hq?: string;
  careers_url: string;
  ats_platform?: string;
};

type CrawlField = {
  label?: string;
  type?: string;
  required?: boolean;
  selector?: string;
  options?: string[];
};

type CrawlLink = {
  text?: string;
  href?: string;
};

type CrawlResult = {
  ticker: string;
  status?: "ok" | "error" | "blocked";
  url?: string;
  final_url?: string;
  ats_detected?: string;
  form_fields?: CrawlField[];
  search_filters?: string[];
  links?: CrawlLink[];
  error?: string;
  crawled_at?: string;
};

type RawConstituent = {
  ticker: string;
  sector?: string;
  subsector?: string;
  hq?: string;
};

type LlmField = {
  label: string;
  type: string;
  required: boolean;
  selector?: string;
  options?: string[];
};

type LlmLink = {
  text: string;
  url: string;
};

type LlmCompanyRecord = {
  ticker: string;
  company: string;
  sector: string;
  sub_industry: string;
  hq: string;
  careers_url: string;
  careers_url_final: string;
  ats: string;
  ats_source: "crawl" | "seed";
  application_profile: {
    requires_account: boolean;
    search_filters: string[];
    apply_links: LlmLink[];
    form_fields: LlmField[];
  };
  crawl: {
    status: string;
    last_crawled_at: string;
    redirect_detected: boolean;
    error?: string;
  };
};

type Output = {
  generated_at: string;
  total_companies: number;
  schema_version: string;
  fields: string[];
  companies: LlmCompanyRecord[];
};

function normalizeAts(raw: string | undefined): string {
  const value = String(raw || "unknown").trim().toLowerCase();
  if (["greenhouse", "lever", "workday", "ashby", "smartrecruiters", "icims", "taleo", "successfactors", "custom", "unknown"].includes(value)) {
    return value;
  }

  // Treat uncommon ATS detections as custom, since flow is proprietary for agents.
  if (["phenom", "brassring", "jobvite", "ukg", "avature"].includes(value)) {
    return "custom";
  }

  return "unknown";
}

function requiresAccount(ats: string): boolean {
  return ["workday", "icims", "taleo", "successfactors"].includes(ats);
}

function shortText(input: string | undefined, max = 180): string {
  return String(input || "")
    .replace(/\u001b\[[0-9;]*m/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanError(input: string | undefined): string {
  const text = shortText(input, 500);
  if (!text) return "";
  return text.split("Call log:")[0]?.trim() || text;
}

function cleanHq(input: string | undefined): string {
  const text = shortText(input, 220);
  if (!text) return "";
  return text.split(/quote=/i)[0]?.trim() || text;
}

function pickSearchFilters(filters: string[] | undefined): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const filter of filters || []) {
    const text = shortText(filter, 80);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= 8) break;
  }

  return out;
}

function pickApplyLinks(links: CrawlLink[] | undefined): LlmLink[] {
  const seen = new Set<string>();
  const out: LlmLink[] = [];

  for (const link of links || []) {
    const href = shortText(link.href, 300);
    if (!href) continue;

    const lower = href.toLowerCase();
    const isJobish =
      lower.includes("/job") ||
      lower.includes("/jobs") ||
      lower.includes("career") ||
      lower.includes("apply") ||
      lower.includes("opening") ||
      lower.includes("position");

    if (!isJobish) continue;
    if (seen.has(href)) continue;
    seen.add(href);

    out.push({
      text: shortText(link.text, 80) || "Job/Career Link",
      url: href,
    });

    if (out.length >= 10) break;
  }

  return out;
}

function pickFields(fields: CrawlField[] | undefined): LlmField[] {
  const out: LlmField[] = [];
  const seen = new Set<string>();

  for (const field of fields || []) {
    const label = shortText(field.label, 100);
    const type = shortText(field.type, 32).toLowerCase() || "text";

    if (!label) continue;

    const lc = label.toLowerCase();
    if (lc.includes("cookie") || lc.includes("consent") || lc.includes("captcha")) {
      continue;
    }

    const key = `${label.toLowerCase()}|${type}|${shortText(field.selector, 120)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const options = (field.options || [])
      .map((option) => shortText(option, 80))
      .filter(Boolean)
      .slice(0, 8);

    out.push({
      label,
      type,
      required: Boolean(field.required),
      selector: shortText(field.selector, 140) || undefined,
      options: options.length > 0 ? options : undefined,
    });

    if (out.length >= 20) break;
  }

  return out;
}

async function main() {
  const companies = JSON.parse(
    await readFile(join(ROOT, "data", "companies-full.json"), "utf8")
  ) as Company[];

  const raw = JSON.parse(
    await readFile(join(ROOT, "data", "sp500-full-raw.json"), "utf8")
  ) as RawConstituent[];

  const crawl = JSON.parse(
    await readFile(join(ROOT, "data", "crawl-results-full.json"), "utf8")
  ) as CrawlResult[];

  const crawlMap = new Map(crawl.map((row) => [row.ticker, row]));
  const rawMap = new Map(raw.map((row) => [row.ticker, row]));

  const records: LlmCompanyRecord[] = companies
    .slice()
    .sort((a, b) => a.ticker.localeCompare(b.ticker))
    .map((company) => {
      const crawlRow = crawlMap.get(company.ticker);
      const rawRow = rawMap.get(company.ticker);

      const seedAts = normalizeAts(company.ats_platform);
      const crawledAts = normalizeAts(crawlRow?.ats_detected);
      const useCrawl = crawledAts !== "unknown";
      const ats = useCrawl ? crawledAts : seedAts;

      const baseUrl = shortText(company.careers_url, 300);
      const finalUrl = shortText(crawlRow?.final_url, 300) || baseUrl;

      return {
        ticker: company.ticker,
        company: company.name,
        sector: shortText(company.sector, 80) || shortText(rawRow?.sector, 80) || "Unknown",
        sub_industry:
          shortText(company.subsector, 120) || shortText(rawRow?.subsector, 120) || "Unknown",
        hq: cleanHq(company.hq) || cleanHq(rawRow?.hq) || "Unknown",
        careers_url: baseUrl,
        careers_url_final: finalUrl,
        ats,
        ats_source: useCrawl ? "crawl" : "seed",
        application_profile: {
          requires_account: requiresAccount(ats),
          search_filters: pickSearchFilters(crawlRow?.search_filters),
          apply_links: pickApplyLinks(crawlRow?.links),
          form_fields: pickFields(crawlRow?.form_fields),
        },
        crawl: {
          status: shortText(crawlRow?.status, 24) || "unknown",
          last_crawled_at: shortText(crawlRow?.crawled_at, 40),
          redirect_detected:
            Boolean(crawlRow?.final_url) &&
            Boolean(crawlRow?.url) &&
            shortText(crawlRow?.final_url, 300) !== shortText(crawlRow?.url, 300),
          error: cleanError(crawlRow?.error) || undefined,
        },
      };
    });

  const output: Output = {
    generated_at: new Date().toISOString(),
    total_companies: records.length,
    schema_version: "1.0.0",
    fields: [
      "ticker",
      "company",
      "sector",
      "sub_industry",
      "hq",
      "careers_url",
      "careers_url_final",
      "ats",
      "ats_source",
      "application_profile.requires_account",
      "application_profile.search_filters",
      "application_profile.apply_links",
      "application_profile.form_fields",
      "crawl.status",
      "crawl.last_crawled_at",
      "crawl.redirect_detected",
      "crawl.error",
    ],
    companies: records,
  };

  const outputPath = join(ROOT, "data", "llm-careers-dataset.json");
  await writeFile(outputPath, JSON.stringify(output, null, 2));

  const atsCounts: Record<string, number> = {};
  for (const record of records) {
    atsCounts[record.ats] = (atsCounts[record.ats] || 0) + 1;
  }

  console.log(`Wrote ${outputPath}`);
  console.log(`Companies: ${records.length}`);
  console.log("ATS distribution:");
  for (const [ats, count] of Object.entries(atsCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${ats.padEnd(16)} ${count}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
