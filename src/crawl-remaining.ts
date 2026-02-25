/**
 * crawl-remaining.ts — Crawl the 443 non-IT S&P 500 companies
 *
 * Reads companies-full.json, skips already-crawled tickers from crawl-results.json,
 * crawls the rest with Playwright in batches of 5, and appends to crawl-results.json.
 */

import { chromium, Browser, Page } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

interface Company {
  ticker: string;
  name: string;
  careers_url: string;
  ats_platform: string;
}

interface CrawlResult {
  ticker: string;
  name: string;
  url: string;
  final_url: string;
  status: "ok" | "error" | "blocked";
  page_title: string;
  ats_detected: string;
  job_count_estimate: number;
  search_filters: string[];
  sections: any[];
  form_fields: any[];
  links: { text: string; href: string }[];
  error?: string;
  crawled_at: string;
}

function detectATSFromUrl(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("greenhouse.io")) return "greenhouse";
  if (u.includes("lever.co")) return "lever";
  if (u.includes("myworkdayjobs.com") || u.includes("myworkday.com")) return "workday";
  if (u.includes("ashbyhq.com")) return "ashby";
  if (u.includes("smartrecruiters.com")) return "smartrecruiters";
  if (u.includes("icims.com")) return "icims";
  if (u.includes("taleo.net")) return "taleo";
  if (u.includes("successfactors.com") || u.includes("successfactors.eu")) return "successfactors";
  if (u.includes("jobvite.com")) return "jobvite";
  if (u.includes("ultipro.com") || u.includes("ukg.com")) return "ukg";
  if (u.includes("phenom")) return "phenom";
  if (u.includes("brassring.com")) return "brassring";
  if (u.includes("avature")) return "avature";
  return "unknown";
}

function detectATSFromDOM(html: string): string {
  const h = html.toLowerCase();
  if (h.includes("greenhouse") || h.includes("boards-api.greenhouse.io")) return "greenhouse";
  if (h.includes("lever.co") || h.includes("lever-jobs-embed")) return "lever";
  if (h.includes("workday") || h.includes("myworkdayjobs")) return "workday";
  if (h.includes("ashbyhq") || h.includes("ashby")) return "ashby";
  if (h.includes("smartrecruiters")) return "smartrecruiters";
  if (h.includes("icims")) return "icims";
  if (h.includes("taleo")) return "taleo";
  if (h.includes("successfactors")) return "successfactors";
  if (h.includes("jobvite")) return "jobvite";
  if (h.includes("phenom")) return "phenom";
  if (h.includes("brassring")) return "brassring";
  return "unknown";
}

async function crawlCompany(
  browser: Browser,
  company: Company,
  index: number,
  total: number
): Promise<CrawlResult> {
  const result: CrawlResult = {
    ticker: company.ticker,
    name: company.name,
    url: company.careers_url,
    final_url: company.careers_url,
    status: "error",
    page_title: "",
    ats_detected: company.ats_platform || "unknown",
    job_count_estimate: 0,
    search_filters: [],
    sections: [],
    form_fields: [],
    links: [],
    crawled_at: new Date().toISOString(),
  };

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  try {
    const response = await page.goto(company.careers_url, {
      waitUntil: "domcontentloaded",
      timeout: 20000,
    });

    if (!response) {
      result.error = "No response";
      return result;
    }

    result.final_url = page.url();
    result.status = response.status() < 400 ? "ok" : "error";

    // Wait for JS to render
    await page.waitForTimeout(1500);

    // Page title
    result.page_title = await page.title();

    // ATS detection
    const urlATS = detectATSFromUrl(result.final_url);
    if (urlATS !== "unknown") {
      result.ats_detected = urlATS;
    } else {
      const html = await page.content();
      const domATS = detectATSFromDOM(html);
      if (domATS !== "unknown") {
        result.ats_detected = domATS;
      }
    }

    // Extract form fields
    result.form_fields = await page.evaluate(() => {
      const fields: any[] = [];
      document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button])").forEach((el) => {
        const input = el as HTMLInputElement;
        const label =
          input.labels?.[0]?.textContent?.trim() ||
          input.getAttribute("aria-label") ||
          input.getAttribute("placeholder") ||
          input.name || "";
        if (!label && !input.name) return;
        // Skip cookie/consent fields
        const lcLabel = label.toLowerCase();
        if (lcLabel.includes("cookie") || lcLabel.includes("consent") || lcLabel.includes("gdpr")) return;
        fields.push({
          name: input.name || input.id || "",
          type: input.type || "text",
          label: label.slice(0, 100),
          required: input.required || input.getAttribute("aria-required") === "true",
          selector: input.id ? `#${input.id}` : input.name ? `input[name="${input.name}"]` : "",
          placeholder: input.placeholder || undefined,
        });
      });

      document.querySelectorAll("select").forEach((el) => {
        const select = el as HTMLSelectElement;
        const label = select.labels?.[0]?.textContent?.trim() || select.getAttribute("aria-label") || select.name || "";
        const lcLabel = label.toLowerCase();
        if (lcLabel.includes("cookie") || lcLabel.includes("consent")) return;
        const options = Array.from(select.options).map((o) => o.text.trim()).filter(Boolean).slice(0, 20);
        fields.push({
          name: select.name || select.id || "",
          type: "select",
          label: label.slice(0, 100),
          required: select.required,
          selector: select.id ? `#${select.id}` : select.name ? `select[name="${select.name}"]` : "",
          options,
        });
      });

      document.querySelectorAll("[role=combobox]").forEach((el) => {
        const label = el.getAttribute("aria-label") || (el as HTMLElement).textContent?.trim()?.slice(0, 50) || "";
        fields.push({
          name: el.id || "",
          type: "combobox",
          label,
          required: el.getAttribute("aria-required") === "true",
          selector: el.id ? `#${el.id}` : "[role=combobox]",
        });
      });

      return fields.slice(0, 30);
    });

    // Extract links
    result.links = await page.evaluate(() => {
      const links: { text: string; href: string }[] = [];
      document.querySelectorAll("a[href]").forEach((el) => {
        const a = el as HTMLAnchorElement;
        const text = a.textContent?.trim()?.slice(0, 80) || "";
        const href = a.href;
        if (
          href.includes("/jobs") || href.includes("/careers") ||
          href.includes("/apply") || href.includes("/openings") ||
          href.includes("/positions") ||
          text.toLowerCase().includes("apply") ||
          text.toLowerCase().includes("job") ||
          text.toLowerCase().includes("career")
        ) {
          links.push({ text, href });
        }
      });
      return links.slice(0, 20);
    });

    // Job count estimate
    const jobCountText = await page.evaluate(() => {
      const el = document.querySelector("[data-total], .job-count, .results-count, .total-jobs");
      if (el) return el.textContent?.trim() || "";
      const listings = document.querySelectorAll(
        "[data-job-id], .job-listing, .job-card, .opening, tr.job, .posting-title, a[href*='/jobs/']"
      );
      return listings.length > 0 ? `${listings.length}` : "";
    });
    const countMatch = jobCountText.match(/(\d+)/);
    if (countMatch) result.job_count_estimate = parseInt(countMatch[1]);

    // Search filters
    result.search_filters = await page.evaluate(() => {
      const filters: string[] = [];
      document.querySelectorAll(
        "select[name*='filter'], select[name*='location'], select[name*='department'], select[name*='category'], [data-automation-id*='Search']"
      ).forEach((el) => {
        const label =
          (el as HTMLSelectElement).labels?.[0]?.textContent?.trim() ||
          el.getAttribute("aria-label") ||
          el.getAttribute("name") || "";
        if (label) filters.push(label);
      });
      return filters;
    });

  } catch (err) {
    result.error = err instanceof Error ? err.message.slice(0, 200) : "Unknown error";
    result.status = "error";
  } finally {
    await context.close();
  }

  return result;
}

async function main() {
  const allCompanies: Company[] = JSON.parse(
    await readFile(join(ROOT, "data", "companies-full.json"), "utf-8")
  );
  const existingResults: CrawlResult[] = JSON.parse(
    await readFile(join(ROOT, "data", "crawl-results.json"), "utf-8")
  );

  const crawledTickers = new Set(existingResults.map((r) => r.ticker));
  const toCrawl = allCompanies.filter((c) => !crawledTickers.has(c.ticker));

  console.log(`\n🕷️  Crawling ${toCrawl.length} remaining companies (${existingResults.length} already done)\n`);

  if (toCrawl.length === 0) {
    console.log("Nothing to crawl — all companies already have results.");
    return;
  }

  const browser = await chromium.launch({ headless: true });
  const newResults: CrawlResult[] = [];
  let okCount = 0;
  let errCount = 0;

  const batchSize = 5;
  for (let i = 0; i < toCrawl.length; i += batchSize) {
    const batch = toCrawl.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((company, j) => crawlCompany(browser, company, i + j, toCrawl.length))
    );

    for (const r of batchResults) {
      newResults.push(r);
      if (r.status === "ok") {
        okCount++;
        process.stdout.write(`  ✅ ${r.ticker.padEnd(6)} ${r.page_title.slice(0, 45).padEnd(47)} ATS: ${r.ats_detected}\n`);
      } else {
        errCount++;
        process.stdout.write(`  ❌ ${r.ticker.padEnd(6)} ${(r.error || "failed").slice(0, 55)}\n`);
      }
    }

    // Progress bar
    const done = Math.min(i + batchSize, toCrawl.length);
    const pct = Math.round((done / toCrawl.length) * 100);
    const filled = Math.round(pct / 2);
    const bar = "█".repeat(filled) + "░".repeat(50 - filled);
    process.stdout.write(`  [${bar}] ${pct}% (${done}/${toCrawl.length}) ✅${okCount} ❌${errCount}\n\n`);

    // Save progress every 50 companies
    if (newResults.length % 50 < batchSize) {
      const merged = [...existingResults, ...newResults];
      await writeFile(join(ROOT, "data", "crawl-results-full.json"), JSON.stringify(merged, null, 2));
    }
  }

  await browser.close();

  // Final save
  const allResults = [...existingResults, ...newResults];
  await writeFile(join(ROOT, "data", "crawl-results-full.json"), JSON.stringify(allResults, null, 2));

  // Summary
  const totalOk = allResults.filter((r) => r.status === "ok").length;
  const totalErr = allResults.filter((r) => r.status === "error").length;

  // ATS distribution
  const atsCounts: Record<string, number> = {};
  for (const r of allResults) {
    const ats = r.ats_detected || "unknown";
    atsCounts[ats] = (atsCounts[ats] || 0) + 1;
  }

  console.log(`\n📊 Full Crawl Complete — ${allResults.length} companies`);
  console.log(`   ✅ ${totalOk} OK | ❌ ${totalErr} errors`);
  console.log(`   ATS Distribution:`);
  for (const [ats, count] of Object.entries(atsCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${ats.padEnd(20)} ${count}`);
  }
  console.log(`   💾 Saved to data/crawl-results-full.json\n`);
}

main().catch(console.error);
