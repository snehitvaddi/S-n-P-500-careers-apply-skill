#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const ATS_CHECKLIST = {
  workday: [
    "Open careers URL and confirm Workday redirect",
    "Use search box and location filters",
    "Open a job card and click Apply",
    "Create/login account",
    "Complete multi-step wizard and submit",
  ],
  greenhouse: [
    "Open board/careers page and select job",
    "Navigate to application section (#app)",
    "Fill contact fields and upload resume",
    "Handle combobox-style fields",
    "Submit and wait for confirmation",
  ],
  lever: [
    "Open job listing and select role",
    "Fill single-page application form",
    "Upload resume/cover letter",
    "Submit and verify success state",
  ],
  ashby: [
    "Open Ashby job detail page",
    "Fill inline React form fields",
    "Upload documents",
    "Submit and verify response",
  ],
  icims: [
    "Open portal and locate job posting",
    "Click Apply and switch to application flow",
    "Complete profile/resume/questions steps",
    "Review and submit",
  ],
  taleo: [
    "Open Taleo role page",
    "Create/login account",
    "Complete multi-step form",
    "Review and submit",
  ],
  successfactors: [
    "Open role in SuccessFactors",
    "Create/login account",
    "Complete profile/experience/education",
    "Upload resume and submit",
  ],
  custom: [
    "Open careers URL and detect search + listing controls",
    "Open target job detail page",
    "Map required form fields and screening prompts",
    "Fill, validate, and submit",
  ],
  unknown: [
    "Open careers URL and detect search + listing controls",
    "Open target job detail page",
    "Map required form fields and screening prompts",
    "Fill, validate, and submit",
  ],
};

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

async function main() {
  const args = parseArgs(process.argv);
  const ticker = String(args.ticker || "").toUpperCase().trim();
  if (!ticker) {
    throw new Error("Missing required argument: --ticker <SYMBOL>");
  }

  const datasetPath = resolve(
    process.cwd(),
    String(args.dataset || "data/llm-careers-dataset.json")
  );
  const raw = JSON.parse(await readFile(datasetPath, "utf8"));
  const companies = Array.isArray(raw.companies) ? raw.companies : [];

  const company = companies.find((c) => String(c.ticker).toUpperCase() === ticker);
  if (!company) {
    throw new Error(`Ticker not found in dataset: ${ticker}`);
  }

  const ats = String(company.ats || "unknown").toLowerCase();
  const checklist = ATS_CHECKLIST[ats] || ATS_CHECKLIST.unknown;

  const packet = {
    ticker: company.ticker,
    company: company.company,
    ats,
    ats_source: company.ats_source || "unknown",
    urls: {
      careers_url: company.careers_url,
      careers_url_final: company.careers_url_final || company.careers_url,
    },
    routing: {
      requires_account: Boolean(company.application_profile?.requires_account),
      checklist,
    },
    discovery: {
      search_filters: company.application_profile?.search_filters || [],
      apply_links: company.application_profile?.apply_links || [],
      form_fields: company.application_profile?.form_fields || [],
    },
    crawl_health: {
      status: company.crawl?.status || "unknown",
      redirect_detected: Boolean(company.crawl?.redirect_detected),
      error: company.crawl?.error || null,
      last_crawled_at: company.crawl?.last_crawled_at || "",
    },
    required_question_categories: [
      "work_authorization",
      "sponsorship",
      "location_preference",
      "compensation_expectation",
      "experience_match",
    ],
  };

  console.log(JSON.stringify(packet, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
