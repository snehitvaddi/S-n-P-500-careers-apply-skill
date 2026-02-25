/**
 * recrawl-errors.ts — Re-crawl only companies that previously errored, using fixed URLs
 */

import { chromium, Browser, Page } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

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
  if (u.includes("oraclecloud.com")) return "oracle-cloud";
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

async function crawlOne(browser: Browser, ticker: string, name: string, url: string): Promise<CrawlResult> {
  const result: CrawlResult = {
    ticker, name, url, final_url: url,
    status: "error", page_title: "", ats_detected: "unknown",
    job_count_estimate: 0, search_filters: [], sections: [],
    form_fields: [], links: [], crawled_at: new Date().toISOString(),
  };

  const ctx = await browser.newContext({
    userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    viewport: { width: 1440, height: 900 },
  });
  const page = await ctx.newPage();

  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (!resp) { result.error = "No response"; return result; }

    result.final_url = page.url();
    result.status = resp.status() < 400 ? "ok" : "error";
    await page.waitForTimeout(1500);
    result.page_title = await page.title();

    const urlATS = detectATSFromUrl(result.final_url);
    if (urlATS !== "unknown") {
      result.ats_detected = urlATS;
    } else {
      const html = await page.content();
      const domATS = detectATSFromDOM(html);
      if (domATS !== "unknown") result.ats_detected = domATS;
    }

    result.form_fields = await page.evaluate(() => {
      const fields: any[] = [];
      document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button])").forEach((el) => {
        const input = el as HTMLInputElement;
        const label = input.labels?.[0]?.textContent?.trim() || input.getAttribute("aria-label") || input.getAttribute("placeholder") || input.name || "";
        if (!label && !input.name) return;
        const lc = label.toLowerCase();
        if (lc.includes("cookie") || lc.includes("consent") || lc.includes("gdpr")) return;
        fields.push({ name: input.name || input.id || "", type: input.type || "text", label: label.slice(0, 100), required: input.required || input.getAttribute("aria-required") === "true", selector: input.id ? `#${input.id}` : input.name ? `input[name="${input.name}"]` : "", placeholder: input.placeholder || undefined });
      });
      document.querySelectorAll("select").forEach((el) => {
        const s = el as HTMLSelectElement;
        const label = s.labels?.[0]?.textContent?.trim() || s.getAttribute("aria-label") || s.name || "";
        if (label.toLowerCase().includes("cookie")) return;
        fields.push({ name: s.name || s.id || "", type: "select", label: label.slice(0, 100), required: s.required, selector: s.id ? `#${s.id}` : s.name ? `select[name="${s.name}"]` : "", options: Array.from(s.options).map(o => o.text.trim()).filter(Boolean).slice(0, 20) });
      });
      document.querySelectorAll("[role=combobox]").forEach((el) => {
        const label = el.getAttribute("aria-label") || (el as HTMLElement).textContent?.trim()?.slice(0, 50) || "";
        fields.push({ name: el.id || "", type: "combobox", label, required: el.getAttribute("aria-required") === "true", selector: el.id ? `#${el.id}` : "[role=combobox]" });
      });
      return fields.slice(0, 30);
    });

    result.links = await page.evaluate(() => {
      const links: { text: string; href: string }[] = [];
      document.querySelectorAll("a[href]").forEach((el) => {
        const a = el as HTMLAnchorElement;
        const text = a.textContent?.trim()?.slice(0, 80) || "";
        const href = a.href;
        if (href.includes("/jobs") || href.includes("/careers") || href.includes("/apply") || href.includes("/openings") || text.toLowerCase().includes("apply") || text.toLowerCase().includes("job") || text.toLowerCase().includes("career")) {
          links.push({ text, href });
        }
      });
      return links.slice(0, 20);
    });

    const jobCountText = await page.evaluate(() => {
      const el = document.querySelector("[data-total], .job-count, .results-count, .total-jobs");
      if (el) return el.textContent?.trim() || "";
      const listings = document.querySelectorAll("[data-job-id], .job-listing, .job-card, .opening, .posting-title, a[href*='/jobs/']");
      return listings.length > 0 ? `${listings.length}` : "";
    });
    const m = jobCountText.match(/(\d+)/);
    if (m) result.job_count_estimate = parseInt(m[1]);

    result.search_filters = await page.evaluate(() => {
      const f: string[] = [];
      document.querySelectorAll("select[name*='filter'], select[name*='location'], select[name*='department'], [data-automation-id*='Search']").forEach((el) => {
        const label = (el as HTMLSelectElement).labels?.[0]?.textContent?.trim() || el.getAttribute("aria-label") || el.getAttribute("name") || "";
        if (label) f.push(label);
      });
      return f;
    });
  } catch (err) {
    result.error = err instanceof Error ? err.message.slice(0, 200) : "Unknown error";
    result.status = "error";
  } finally {
    await ctx.close();
  }
  return result;
}

async function main() {
  const companies = JSON.parse(await readFile(join(ROOT, "data", "companies-full.json"), "utf8"));
  const existingResults: CrawlResult[] = JSON.parse(await readFile(join(ROOT, "data", "crawl-results-full.json"), "utf8"));

  // Find errored tickers
  const errorTickers = new Set(existingResults.filter(r => r.status === "error").map(r => r.ticker));
  const companyMap = new Map(companies.map((c: any) => [c.ticker, c]));

  // Build re-crawl list with NEW urls from companies-full.json
  const toCrawl: { ticker: string; name: string; url: string }[] = [];
  for (const ticker of errorTickers) {
    const c = companyMap.get(ticker);
    if (c) toCrawl.push({ ticker: c.ticker, name: c.name, url: c.careers_url });
  }

  console.log(`\n🔄 Re-crawling ${toCrawl.length} previously-errored companies with fixed URLs\n`);

  const browser = await chromium.launch({ headless: true });
  const newResults: CrawlResult[] = [];
  let okCount = 0, errCount = 0;

  const batchSize = 5;
  for (let i = 0; i < toCrawl.length; i += batchSize) {
    const batch = toCrawl.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(c => crawlOne(browser, c.ticker, c.name, c.url)));

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

    const done = Math.min(i + batchSize, toCrawl.length);
    const pct = Math.round((done / toCrawl.length) * 100);
    const filled = Math.round(pct / 2);
    process.stdout.write(`  [${"█".repeat(filled)}${"░".repeat(50 - filled)}] ${pct}% (${done}/${toCrawl.length}) ✅${okCount} ❌${errCount}\n\n`);
  }

  await browser.close();

  // Merge: replace errored results with new results
  const newResultMap = new Map(newResults.map(r => [r.ticker, r]));
  const merged = existingResults.map(r => {
    const replacement = newResultMap.get(r.ticker);
    return replacement || r;
  });

  await writeFile(join(ROOT, "data", "crawl-results-full.json"), JSON.stringify(merged, null, 2));

  const totalOk = merged.filter(r => r.status === "ok").length;
  const totalErr = merged.filter(r => r.status === "error").length;

  const atsCounts: Record<string, number> = {};
  for (const r of merged) { const ats = r.ats_detected || "unknown"; atsCounts[ats] = (atsCounts[ats] || 0) + 1; }

  console.log(`\n📊 Re-crawl Complete`);
  console.log(`   This run: ✅ ${okCount} recovered | ❌ ${errCount} still failing`);
  console.log(`   Overall:  ✅ ${totalOk} OK | ❌ ${totalErr} errors (of ${merged.length} total)`);
  console.log(`   ATS Distribution:`);
  for (const [ats, count] of Object.entries(atsCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`     ${ats.padEnd(20)} ${count}`);
  }
  console.log(`   💾 Saved to data/crawl-results-full.json\n`);
}

main().catch(console.error);
