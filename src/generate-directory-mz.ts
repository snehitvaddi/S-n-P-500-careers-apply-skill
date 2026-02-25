import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

type Company = {
  ticker: string;
  company: string;
  sector: string;
  sub_industry: string;
  hq: string;
  careers_url: string;
  careers_url_final: string;
  ats: string;
  application_profile?: {
    search_filters?: string[];
    apply_links?: Array<{ text?: string; url?: string }>;
    form_fields?: Array<{ label?: string; type?: string }>;
  };
  crawl?: {
    status?: string;
    redirect_detected?: boolean;
    error?: string;
  };
};

type Dataset = {
  companies: Company[];
};

const ATS_META: Record<
  string,
  {
    emoji: string;
    tableName: string;
    detailName: string;
    guide: string;
    templateKey: string;
  }
> = {
  greenhouse: {
    emoji: "🌿",
    tableName: "greenhouse",
    detailName: "Greenhouse",
    guide: "greenhouse.md",
    templateKey: "greenhouse",
  },
  lever: {
    emoji: "🔷",
    tableName: "lever",
    detailName: "Lever",
    guide: "lever.md",
    templateKey: "lever",
  },
  workday: {
    emoji: "🔶",
    tableName: "workday",
    detailName: "Workday",
    guide: "workday.md",
    templateKey: "workday",
  },
  ashby: {
    emoji: "💠",
    tableName: "ashby",
    detailName: "Ashby",
    guide: "ashby.md",
    templateKey: "ashby",
  },
  smartrecruiters: {
    emoji: "🟢",
    tableName: "smartrecruiters",
    detailName: "SmartRecruiters",
    guide: "smartrecruiters.md",
    templateKey: "custom",
  },
  icims: {
    emoji: "🟡",
    tableName: "icims",
    detailName: "iCIMS",
    guide: "icims.md",
    templateKey: "icims",
  },
  taleo: {
    emoji: "🔴",
    tableName: "taleo",
    detailName: "Taleo",
    guide: "taleo.md",
    templateKey: "taleo",
  },
  successfactors: {
    emoji: "🟣",
    tableName: "successfactors",
    detailName: "SuccessFactors",
    guide: "successfactors.md",
    templateKey: "successfactors",
  },
  custom: {
    emoji: "⚪",
    tableName: "custom",
    detailName: "Custom/Unknown",
    guide: "custom-ats.md",
    templateKey: "custom",
  },
  unknown: {
    emoji: "⚪",
    tableName: "unknown",
    detailName: "Custom/Unknown",
    guide: "custom-ats.md",
    templateKey: "custom",
  },
};

const APPLY_TEMPLATES: Record<string, string> = {
  workday: [
    "1. Navigate to careers URL -> redirects to Workday portal",
    "2. Use `data-automation-id` selectors (stable, unlike CSS classes)",
    "3. Search: `data-automation-id=\"searchBox\"` -> type keywords",
    "4. Location filter: `data-automation-id=\"Location\"` combobox",
    "5. Click job card -> \"Apply\" button -> creates/logs into Workday account",
    "6. Multi-step wizard: Personal Info -> Experience -> Education -> Resume Upload -> Review -> Submit",
    "7. **Note**: Workday requires account creation - email + password",
  ].join("\n"),
  greenhouse: [
    "1. Jobs listed at careers page or `boards.greenhouse.io/{slug}`",
    "2. API: `GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true`",
    "3. Click job -> scroll to application form (anchor `#app`)",
    "4. Fields: First Name, Last Name, Email, Phone, Resume (file upload), LinkedIn, Cover Letter",
    "5. **Combobox pattern**: Click to open -> snapshot options -> click matching option (NOT native select)",
    "6. Submit - watch for invisible reCAPTCHA Enterprise",
  ].join("\n"),
  lever: [
    "1. Jobs listed at `jobs.lever.co/{slug}` or embedded on careers page",
    "2. Click job -> single-page application form",
    "3. Fields: Full Name, Email, Phone, Current Company, LinkedIn, Resume (drag-drop/file), Cover Letter",
    "4. Clean single-page flow - no account creation needed",
  ].join("\n"),
  ashby: [
    "1. Jobs at `jobs.ashbyhq.com/{slug}` or embedded React widget",
    "2. Click job -> inline application form",
    "3. Fields: First Name, Last Name, Email, Phone, LinkedIn, Resume, Cover Letter",
    "4. React-based - fields are controlled components",
  ].join("\n"),
  icims: [
    "1. Career portal with iframe-based job listings",
    "2. Search by keyword/location",
    "3. Click job -> \"Apply\" -> redirects to iCIMS application portal",
    "4. Multi-step: Profile -> Resume Upload -> Questions -> Review -> Submit",
    "5. **Note**: Heavy iframe usage - may need to switch frames",
  ].join("\n"),
  taleo: [
    "1. Legacy Oracle Taleo career portal",
    "2. Search jobs -> click -> \"Apply\" -> account creation required",
    "3. Multi-step wizard with many required fields",
    "4. **Note**: Slow, legacy UI - may have session timeouts",
  ].join("\n"),
  successfactors: [
    "1. SAP SuccessFactors career portal",
    "2. Search by keyword/location/category",
    "3. Click job -> \"Apply\" -> account required",
    "4. Multi-step: Profile -> Experience -> Education -> Resume -> Submit",
  ].join("\n"),
  custom: [
    "1. Visit careers URL directly",
    "2. Proprietary career portal - inspect page for form structure",
    "3. Look for: search inputs, job cards/listings, \"Apply\" buttons",
    "4. Application flow varies - check page source for ATS indicators",
  ].join("\n"),
};

function normalizeAts(rawValue?: string): string {
  const value = String(rawValue || "unknown").toLowerCase().trim();
  if (["phenom", "brassring", "jobvite", "ukg", "avature"].includes(value)) {
    return "custom";
  }
  return ATS_META[value] ? value : "unknown";
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

function anchorSlug(name: string): string {
  let s = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "");

  const suffixes = [
    "incorporated",
    "inc",
    "corporation",
    "corp",
    "company",
    "co",
    "plc",
    "limited",
    "ltd",
    "llc",
    "group",
    "holdings",
    "holding",
    "n\\.?v\\.?",
    "s\\.?a\\.?",
    "ag",
    "lp",
    "llp",
  ];

  s = s.replace(/\((the)\)$/i, "");

  let changed = true;
  while (changed) {
    changed = false;
    for (const suffix of suffixes) {
      const re = new RegExp(`(?:,|\\.|\\s|-)*(?:&|and)?(?:,|\\.|\\s|-)*${suffix}\\.?$`, "i");
      if (re.test(s)) {
        s = s.replace(re, "");
        changed = true;
      }
    }
  }

  s = s.replace(/&/g, " and ");
  s = s.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  s = s.replace(/-and$/g, "");
  return s;
}

function cleanUrlDisplay(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  }
}

function h1b(ticker: string): "Yes" | "Unknown" {
  const wellKnown = new Set([
    "MDB", "META", "MPWR", "MRVL", "MSFT", "MSI", "MU", "NFLX", "NOW", "NTAP", "NVDA", "NXPI", "ON", "ORCL", "PANW", "PLTR", "PTC", "PYPL", "QCOM", "ROP", "SNOW", "SNPS", "STX", "SWKS", "TEAM", "TEL", "TER", "TRMB", "TTD", "TXN", "TYL", "UBER", "VRSN", "WDC", "ZBRA", "ZS",
  ]);
  return wellKnown.has(ticker) ? "Yes" : "Unknown";
}

function knownQuirks(company: Company, atsMeta: { detailName: string; guide: string }): string {
  const lines: string[] = [];

  if (!company.crawl) {
    lines.push("- No crawl snapshot available yet for this company.");
  } else {
    if (company.crawl.redirect_detected && company.careers_url_final && company.careers_url_final !== company.careers_url) {
      lines.push(`- Redirects to [${cleanUrlDisplay(company.careers_url_final)}](${company.careers_url_final}).`);
    }

    if ((company.crawl.status || "") !== "ok" && company.crawl.error) {
      lines.push(`- Crawl error observed: \`${cleanError(company.crawl.error).slice(0, 180)}\`.`);
    } else if ((company.application_profile?.form_fields || []).length === 0 && (company.application_profile?.apply_links || []).length === 0) {
      lines.push("- Landing page exposes limited metadata; open a job detail page before filling forms.");
    }

    const filters = (company.application_profile?.search_filters || []).map((f) => shortText(f, 60)).filter(Boolean).slice(0, 3);
    if (filters.length > 0) {
      lines.push(`- Search/filter controls seen: ${filters.map((f) => `\`${f}\``).join(", ")}.`);
    }
  }

  lines.push(`- Standard ${atsMeta.detailName} flow — see [guides/${atsMeta.guide}](guides/${atsMeta.guide}).`);
  return lines.join("\n");
}

async function main() {
  const dataset = JSON.parse(
    await readFile(join(ROOT, "data", "llm-careers-dataset.json"), "utf8")
  ) as Dataset;

  const mz = dataset.companies
    .filter((company) => company.ticker >= "M")
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

  let rowNumber = 256;
  const tableRows: string[] = [];
  const detailBlocks: string[] = [];

  for (const company of mz) {
    const ats = normalizeAts(company.ats);
    const atsMeta = ATS_META[ats] || ATS_META.unknown;

    const anchor = `${company.ticker.toLowerCase()}--${anchorSlug(company.company)}`;
    const urlDisplay = cleanUrlDisplay(company.careers_url);
    const h1bValue = h1b(company.ticker);

    tableRows.push(
      `| ${rowNumber} | [${company.ticker}](#${anchor}) | ${company.company} | ${company.sector || "Unknown"} | ${cleanHq(company.hq) || "Unknown"} | ${atsMeta.emoji} ${atsMeta.tableName} | [${urlDisplay}](${company.careers_url}) | ${h1bValue === "Yes" ? "Yes" : "Unk"} |`
    );

    detailBlocks.push(
      [
        "---",
        "",
        `<a id=\"${anchor}\"></a>`,
        `### ${company.ticker} — ${company.company}`,
        "",
        "| | |",
        "|---|---|",
        `| **Sector** | ${company.sector || "Unknown"} |`,
        `| **Sub-Industry** | ${company.sub_industry || "Unknown"} |`,
        `| **HQ** | ${cleanHq(company.hq) || "Unknown"} |`,
        `| **ATS** | ${atsMeta.emoji} ${atsMeta.detailName} |`,
        `| **Careers URL** | [${urlDisplay}](${company.careers_url}) |`,
        `| **H-1B Sponsor** | ${h1bValue} |`,
        "",
        `#### How to Apply (${atsMeta.detailName})`,
        APPLY_TEMPLATES[atsMeta.templateKey] || APPLY_TEMPLATES.custom,
        "",
        "#### Known Quirks",
        knownQuirks(company, atsMeta),
        "",
      ].join("\n")
    );

    rowNumber += 1;
  }

  const output = `${tableRows.join("\n")}\n\n${detailBlocks.join("\n")}`;
  const outPath = join(ROOT, "DIRECTORY-MZ.md");
  await writeFile(outPath, output);

  console.log(`Wrote ${outPath}`);
  console.log(`Companies: ${mz.length}`);
  console.log(`Rows: 256-${rowNumber - 1}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
