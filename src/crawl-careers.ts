/**
 * crawl-careers.ts — Scrape career pages for form fields, sections, and metadata
 *
 * Opens each company's career page with Playwright, extracts:
 * - Page title, meta description
 * - ATS detection from URL + DOM
 * - Form fields (inputs, selects, textareas)
 * - Dropdown/combobox options
 * - Application sections
 * - Links to job listings
 */

import { chromium, Browser, Page } from "playwright";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, "..");

interface FormField {
  name: string;
  type: string;
  label: string;
  required: boolean;
  selector: string;
  options?: string[];
  placeholder?: string;
}

interface PageSection {
  heading: string;
  fields: FormField[];
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
  sections: PageSection[];
  form_fields: FormField[];
  links: { text: string; href: string }[];
  error?: string;
  crawled_at: string;
}

interface Company {
  ticker: string;
  name: string;
  careers_url: string;
  ats_platform: string;
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
  if (u.includes("successfactors.com")) return "successfactors";
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
  return "unknown";
}

async function extractFormFields(page: Page): Promise<FormField[]> {
  return page.evaluate(() => {
    const fields: Array<{
      name: string;
      type: string;
      label: string;
      required: boolean;
      selector: string;
      options?: string[];
      placeholder?: string;
    }> = [];

    // Input fields
    document.querySelectorAll("input:not([type=hidden]):not([type=submit]):not([type=button])").forEach((el) => {
      const input = el as HTMLInputElement;
      const label =
        input.labels?.[0]?.textContent?.trim() ||
        input.getAttribute("aria-label") ||
        input.getAttribute("placeholder") ||
        input.name ||
        "";
      if (!label && !input.name) return;
      fields.push({
        name: input.name || input.id || "",
        type: input.type || "text",
        label: label.slice(0, 100),
        required: input.required || input.getAttribute("aria-required") === "true",
        selector: input.id ? `#${input.id}` : input.name ? `input[name="${input.name}"]` : "",
        placeholder: input.placeholder || undefined,
      });
    });

    // Textareas
    document.querySelectorAll("textarea").forEach((el) => {
      const ta = el as HTMLTextAreaElement;
      const label = ta.labels?.[0]?.textContent?.trim() || ta.getAttribute("aria-label") || ta.name || "";
      fields.push({
        name: ta.name || ta.id || "",
        type: "textarea",
        label: label.slice(0, 100),
        required: ta.required,
        selector: ta.id ? `#${ta.id}` : ta.name ? `textarea[name="${ta.name}"]` : "",
      });
    });

    // Select dropdowns
    document.querySelectorAll("select").forEach((el) => {
      const select = el as HTMLSelectElement;
      const label = select.labels?.[0]?.textContent?.trim() || select.getAttribute("aria-label") || select.name || "";
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

    // ARIA comboboxes
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

    // Radio groups
    const radioGroups = new Map<string, string[]>();
    document.querySelectorAll("input[type=radio]").forEach((el) => {
      const radio = el as HTMLInputElement;
      const name = radio.name;
      if (!name) return;
      if (!radioGroups.has(name)) radioGroups.set(name, []);
      const label = radio.labels?.[0]?.textContent?.trim() || radio.value;
      radioGroups.get(name)!.push(label);
    });
    radioGroups.forEach((options, name) => {
      const firstRadio = document.querySelector(`input[name="${name}"]`) as HTMLInputElement;
      const groupLabel =
        firstRadio?.closest("fieldset")?.querySelector("legend")?.textContent?.trim() ||
        firstRadio?.getAttribute("aria-label") ||
        name;
      fields.push({
        name,
        type: "radio",
        label: groupLabel.slice(0, 100),
        required: firstRadio?.required || false,
        selector: `input[name="${name}"]`,
        options: options.slice(0, 20),
      });
    });

    // Checkbox groups
    document.querySelectorAll("input[type=checkbox]").forEach((el) => {
      const cb = el as HTMLInputElement;
      const label = cb.labels?.[0]?.textContent?.trim() || cb.name || "";
      if (!label) return;
      fields.push({
        name: cb.name || cb.id || "",
        type: "checkbox",
        label: label.slice(0, 100),
        required: cb.required,
        selector: cb.id ? `#${cb.id}` : cb.name ? `input[name="${cb.name}"]` : "",
      });
    });

    // File inputs
    document.querySelectorAll("input[type=file]").forEach((el) => {
      const input = el as HTMLInputElement;
      const label = input.labels?.[0]?.textContent?.trim() || input.getAttribute("aria-label") || "File Upload";
      fields.push({
        name: input.name || input.id || "",
        type: "file",
        label,
        required: input.required,
        selector: input.id ? `#${input.id}` : "input[type=file]",
      });
    });

    return fields;
  });
}

async function extractSections(page: Page): Promise<PageSection[]> {
  return page.evaluate(() => {
    const sections: Array<{ heading: string; fields: Array<any> }> = [];
    // Look for fieldsets, sections, or heading-grouped areas
    document.querySelectorAll("fieldset, section, [role=group], form > div > div").forEach((el) => {
      const heading =
        el.querySelector("legend, h1, h2, h3, h4, [role=heading]")?.textContent?.trim() || "";
      if (!heading) return;
      const inputs = el.querySelectorAll("input, select, textarea, [role=combobox]");
      if (inputs.length === 0) return;
      sections.push({
        heading: heading.slice(0, 100),
        fields: Array.from(inputs).map((input) => ({
          name: (input as HTMLInputElement).name || input.id || "",
          type: (input as HTMLInputElement).type || input.tagName.toLowerCase(),
          label: (input as HTMLInputElement).labels?.[0]?.textContent?.trim()?.slice(0, 80) || "",
        })),
      });
    });
    return sections.slice(0, 20);
  });
}

async function extractLinks(page: Page): Promise<{ text: string; href: string }[]> {
  return page.evaluate(() => {
    const links: Array<{ text: string; href: string }> = [];
    document.querySelectorAll("a[href]").forEach((el) => {
      const a = el as HTMLAnchorElement;
      const text = a.textContent?.trim()?.slice(0, 80) || "";
      const href = a.href;
      // Filter for job-related links
      if (
        href.includes("/jobs") ||
        href.includes("/careers") ||
        href.includes("/apply") ||
        href.includes("/openings") ||
        href.includes("/positions") ||
        text.toLowerCase().includes("apply") ||
        text.toLowerCase().includes("job") ||
        text.toLowerCase().includes("position") ||
        text.toLowerCase().includes("career")
      ) {
        links.push({ text, href });
      }
    });
    return links.slice(0, 30);
  });
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
    ats_detected: company.ats_platform,
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
    console.log(`[${index + 1}/${total}] Crawling ${company.ticker} — ${company.careers_url}`);

    const response = await page.goto(company.careers_url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    if (!response) {
      result.error = "No response";
      console.log(`  ❌ ${company.ticker}: No response`);
      return result;
    }

    result.final_url = page.url();
    result.status = response.status() < 400 ? "ok" : "error";

    // Wait a bit for JS to render
    await page.waitForTimeout(2000);

    // Get page title
    result.page_title = await page.title();

    // Detect ATS from final URL and page content
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
    result.form_fields = await extractFormFields(page);

    // Extract sections
    result.sections = await extractSections(page);

    // Extract links
    result.links = await extractLinks(page);

    // Estimate job count from page content
    const jobCountText = await page.evaluate(() => {
      const el = document.querySelector(
        "[data-total], .job-count, .results-count, .total-jobs"
      );
      if (el) return el.textContent?.trim() || "";
      // Try to count job listing elements
      const listings = document.querySelectorAll(
        "[data-job-id], .job-listing, .job-card, .opening, tr.job, .posting-title, a[href*='/jobs/']"
      );
      return listings.length > 0 ? `${listings.length} listings found` : "";
    });
    const countMatch = jobCountText.match(/(\d+)/);
    if (countMatch) {
      result.job_count_estimate = parseInt(countMatch[1]);
    }

    // Extract search/filter options
    result.search_filters = await page.evaluate(() => {
      const filters: string[] = [];
      document
        .querySelectorAll(
          "select[name*='filter'], select[name*='location'], select[name*='department'], select[name*='category'], [data-automation-id*='Search']"
        )
        .forEach((el) => {
          const label =
            (el as HTMLSelectElement).labels?.[0]?.textContent?.trim() ||
            el.getAttribute("aria-label") ||
            el.getAttribute("name") ||
            "";
          if (label) filters.push(label);
        });
      return filters;
    });

    const fieldCount = result.form_fields.length;
    const sectionCount = result.sections.length;
    const linkCount = result.links.length;
    console.log(
      `  ✅ ${company.ticker}: ${result.page_title.slice(0, 50)} | ${fieldCount} fields, ${sectionCount} sections, ${linkCount} links | ATS: ${result.ats_detected}`
    );
  } catch (err) {
    result.error = err instanceof Error ? err.message.slice(0, 200) : "Unknown error";
    result.status = "error";
    console.log(`  ❌ ${company.ticker}: ${result.error.slice(0, 80)}`);
  } finally {
    await context.close();
  }

  return result;
}

async function main() {
  const companiesPath = join(ROOT, "data", "companies.json");
  const companies: Company[] = JSON.parse(await readFile(companiesPath, "utf-8"));

  console.log(`\n🕷️  Career Page Crawler — ${companies.length} companies\n`);

  const browser = await chromium.launch({ headless: true });
  const results: CrawlResult[] = [];

  // Process in batches of 3 (to avoid overwhelming)
  const batchSize = 3;
  for (let i = 0; i < companies.length; i += batchSize) {
    const batch = companies.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((company, j) => crawlCompany(browser, company, i + j, companies.length))
    );
    results.push(...batchResults);

    // Progress
    const done = Math.min(i + batchSize, companies.length);
    const pct = Math.round((done / companies.length) * 100);
    const bar = "█".repeat(Math.round(pct / 2)) + "░".repeat(50 - Math.round(pct / 2));
    console.log(`\n  [${bar}] ${pct}% (${done}/${companies.length})\n`);
  }

  await browser.close();

  // Save results
  const outputPath = join(ROOT, "data", "crawl-results.json");
  await writeFile(outputPath, JSON.stringify(results, null, 2));

  // Summary
  const ok = results.filter((r) => r.status === "ok").length;
  const err = results.filter((r) => r.status === "error").length;
  const totalFields = results.reduce((s, r) => s + r.form_fields.length, 0);
  const totalSections = results.reduce((s, r) => s + r.sections.length, 0);

  console.log(`\n📊 Crawl Complete`);
  console.log(`   ✅ ${ok} OK | ❌ ${err} errors`);
  console.log(`   📝 ${totalFields} total form fields extracted`);
  console.log(`   📂 ${totalSections} total sections found`);
  console.log(`   💾 Saved to ${outputPath}\n`);
}

main().catch(console.error);
