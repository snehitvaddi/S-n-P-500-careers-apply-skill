import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ATSPlatformId } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const ROOT = join(__dirname, "..");

// ── Types ────────────────────────────────────────────────────────────────────

export interface DetectionResult {
  platform: ATSPlatformId;
  confidence: "high" | "medium" | "low";
  method: "url_pattern" | "dom_inspection" | "http_header";
  details?: string;
}

interface ATSPlatformData {
  id: string;
  name: string;
  detection_patterns: {
    url: string[];
    dom?: string[];
  };
}

// ── URL Pattern Rules ────────────────────────────────────────────────────────

const URL_RULES: Array<{ pattern: RegExp; platform: ATSPlatformId; label: string }> = [
  { pattern: /boards\.greenhouse\.io/i, platform: "greenhouse", label: "boards.greenhouse.io" },
  { pattern: /job-boards\.greenhouse\.io/i, platform: "greenhouse", label: "job-boards.greenhouse.io" },
  { pattern: /boards-api\.greenhouse\.io/i, platform: "greenhouse", label: "boards-api.greenhouse.io" },
  { pattern: /jobs\.lever\.co/i, platform: "lever", label: "jobs.lever.co" },
  { pattern: /\.wd\d+\.myworkdayjobs\.com/i, platform: "workday", label: "*.wd*.myworkdayjobs.com" },
  { pattern: /myworkdayjobs\.com/i, platform: "workday", label: "myworkdayjobs.com" },
  { pattern: /myworkday\.com/i, platform: "workday", label: "myworkday.com" },
  { pattern: /jobs\.ashbyhq\.com/i, platform: "ashby", label: "jobs.ashbyhq.com" },
  { pattern: /jobs\.smartrecruiters\.com/i, platform: "smartrecruiters", label: "jobs.smartrecruiters.com" },
  { pattern: /\.icims\.com/i, platform: "icims", label: "*.icims.com" },
  { pattern: /\.taleo\.net/i, platform: "taleo", label: "*.taleo.net" },
  { pattern: /\.successfactors\.com/i, platform: "successfactors", label: "*.successfactors.com" },
  { pattern: /jobs\.sap\.com/i, platform: "successfactors", label: "jobs.sap.com" },
];

// ── URL-based detection (fast, no network) ───────────────────────────────────

export function detectATSFromUrl(url: string): DetectionResult | null {
  for (const rule of URL_RULES) {
    if (rule.pattern.test(url)) {
      return {
        platform: rule.platform,
        confidence: "high",
        method: "url_pattern",
        details: `Matched URL pattern: ${rule.label}`,
      };
    }
  }
  return null;
}

// ── Page-based detection (slower, more accurate) ─────────────────────────────

export async function detectATSFromPage(url: string): Promise<DetectionResult | null> {
  // First try URL-based detection
  const urlResult = detectATSFromUrl(url);
  if (urlResult && urlResult.confidence === "high") {
    return urlResult;
  }

  // Load ATS platform data for DOM patterns
  let platforms: ATSPlatformData[];
  try {
    const raw = await readFile(join(ROOT, "data", "ats-platforms.json"), "utf-8");
    platforms = JSON.parse(raw);
  } catch {
    console.error("[detect-ats] Failed to load ats-platforms.json");
    return urlResult ?? null;
  }

  // Fetch the page
  let html: string;
  let finalUrl: string;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    html = await response.text();
    finalUrl = response.url;
  } catch (err) {
    console.error(`[detect-ats] Failed to fetch ${url}: ${err}`);
    return urlResult ?? null;
  }

  // Check the final URL (after redirects) against URL patterns
  const redirectResult = detectATSFromUrl(finalUrl);
  if (redirectResult) {
    redirectResult.details = `Redirected to ${finalUrl} - ${redirectResult.details}`;
    return redirectResult;
  }

  // Check HTML content for DOM patterns
  const htmlLower = html.toLowerCase();
  for (const platform of platforms) {
    if (!platform.detection_patterns.dom) continue;
    for (const domPattern of platform.detection_patterns.dom) {
      // Convert CSS-selector-like patterns to simple string checks
      // e.g., "meta[content*='greenhouse']" → check for "greenhouse" in html
      const match = domPattern.match(/\*='([^']+)'/);
      const keyword = match ? match[1] : domPattern.replace(/[#.[\]]/g, "");
      if (htmlLower.includes(keyword.toLowerCase())) {
        return {
          platform: platform.id as ATSPlatformId,
          confidence: "medium",
          method: "dom_inspection",
          details: `Found DOM pattern: ${domPattern}`,
        };
      }
    }
  }

  // If URL-based detection had a low-confidence match, return it
  if (urlResult) return urlResult;

  return null;
}

// ── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const url = process.argv[2];

  if (!url) {
    // If no URL provided, run detection against all companies in data/companies.json
    let companies: Array<{ ticker: string; careers_url: string; ats_platform: string }>;
    try {
      const raw = await readFile(join(ROOT, "data", "companies.json"), "utf-8");
      companies = JSON.parse(raw);
    } catch {
      console.error("Usage: npm run detect [URL]");
      console.error("Or ensure data/companies.json exists to detect all companies.");
      process.exit(1);
    }

    console.log("Detecting ATS platforms for all companies...\n");
    let changes = 0;

    for (const company of companies) {
      const result = detectATSFromUrl(company.careers_url);
      const detected = result?.platform ?? "unknown";
      const match = detected === company.ats_platform;
      if (!match) {
        changes++;
        console.log(
          `  [MISMATCH] ${company.ticker}: stored=${company.ats_platform}, detected=${detected} (${result?.confidence ?? "none"})`,
        );
      }
    }

    console.log(`\nTotal companies: ${companies.length}`);
    console.log(`Mismatches: ${changes}`);
    return;
  }

  // Single URL mode
  console.log(`Detecting ATS for: ${url}\n`);

  const urlResult = detectATSFromUrl(url);
  if (urlResult) {
    console.log(`URL Pattern Detection:`);
    console.log(`  Platform:   ${urlResult.platform}`);
    console.log(`  Confidence: ${urlResult.confidence}`);
    console.log(`  Details:    ${urlResult.details}`);
  } else {
    console.log(`URL Pattern Detection: no match`);
  }

  console.log(`\nPage Inspection Detection (fetching page)...`);
  const pageResult = await detectATSFromPage(url);
  if (pageResult) {
    console.log(`  Platform:   ${pageResult.platform}`);
    console.log(`  Confidence: ${pageResult.confidence}`);
    console.log(`  Method:     ${pageResult.method}`);
    console.log(`  Details:    ${pageResult.details}`);
  } else {
    console.log(`  No ATS detected from page content.`);
  }
}

// Run CLI if executed directly
const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
