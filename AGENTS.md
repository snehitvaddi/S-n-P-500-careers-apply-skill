# AGENTS.md -- Guide for AI Job Application Agents

> This document is designed to be read by AI agents (LLMs, autonomous job-apply bots, etc.)
> that need to navigate S&P 500 tech company career pages.
>
> If you are an AI agent, this is the first file you should read in this repository.

---

## How to Use This Repository

### Step 1: Look Up the Company

Find your target company in `data/companies.json`. You can search by:

- **Ticker symbol**: `jq '.[] | select(.ticker == "DDOG")' data/companies.json`
- **Company name** (case-insensitive): `jq '.[] | select(.name | test("datadog"; "i"))' data/companies.json`
- **ATS platform**: `jq '[.[] | select(.ats_platform == "greenhouse")]' data/companies.json`

Each company entry contains:

| Field            | Description |
|------------------|-------------|
| `ticker`         | Stock ticker symbol (e.g., `DDOG`) |
| `name`           | Full legal company name |
| `slug`           | URL-friendly identifier used in ATS URLs |
| `hq`             | Headquarters location |
| `subsector`      | GICS subsector (Application Software, Semiconductors, etc.) |
| `careers_url`    | Primary careers page URL |
| `ats_platform`   | ATS platform ID: `greenhouse`, `workday`, `lever`, `ashby`, `taleo`, `custom`, etc. |
| `api_endpoint`   | Direct API URL for job listings (Greenhouse only, others are `null`) |
| `h1b_sponsor`    | `true` if the company is known to sponsor H-1B visas |
| `added_date`     | When this company was added to the database |
| `last_verified`  | When the career URL was last checked |
| `status`         | `active`, `inactive`, `removed`, or `pending` |

### Step 2: Read the Playbook

Each company has a JSON playbook at `playbooks/by-ticker/{TICKER}.json`. The playbook contains:

```json
{
  "ticker": "DDOG",
  "company_name": "Datadog, Inc.",
  "ats_platform": "greenhouse",
  "careers_url": "https://careers.datadoghq.com/",
  "application_url": "https://boards.greenhouse.io/datadog/jobs/{job_id}",
  "api_endpoint": "https://boards-api.greenhouse.io/v1/boards/datadog/jobs",
  "search_filters": [ ... ],
  "application_flow": [
    {
      "step": 1,
      "action": "Navigate to job listing",
      "selector": null,
      "field_type": null,
      "value_key": null,
      "notes": "Use API endpoint to get job IDs, then construct application URL"
    },
    {
      "step": 2,
      "action": "Upload resume",
      "selector": "input[type='file']",
      "field_type": "file",
      "value_key": "resume_path",
      "notes": "PDF format, under 2MB, must be text-selectable",
      "required": true
    }
  ],
  "quirks": [ ... ],
  "verified": true,
  "last_verified": "2026-02-25",
  "notes": "..."
}
```

**Playbook field reference:**

| Field              | Purpose |
|--------------------|---------|
| `application_url`  | URL template for a specific job. Replace `{job_id}` with the actual ID. |
| `api_endpoint`     | Fetch this URL to get a JSON list of open positions (Greenhouse only). |
| `search_filters`   | Describes available search/filter controls on the careers page (dropdowns, text inputs, URL params). |
| `application_flow` | Ordered list of steps to complete the application. Each step has a `selector`, `field_type`, and `value_key` (maps to your applicant profile data). |
| `quirks`           | Known issues with this company's application process. Each quirk has a `severity` (`info`, `warning`, `blocker`) and a `workaround`. |
| `verified`         | Whether a human or automated check has confirmed this playbook works. |

### Step 3: Follow the ATS Guide

Read the relevant ATS platform guide in `guides/`:

| Platform         | Guide File                    |
|------------------|-------------------------------|
| Greenhouse       | `guides/greenhouse.md`        |
| Lever            | `guides/lever.md`             |
| Workday          | `guides/workday.md`           |
| Ashby            | `guides/ashby.md`             |
| SmartRecruiters  | `guides/smartrecruiters.md`   |
| iCIMS            | `guides/icims.md`             |
| Taleo            | `guides/taleo.md`             |
| Custom           | `guides/custom-ats.md`        |

The ATS guide gives you universal patterns for the platform (selectors, flow, quirks). Then read the company-specific guide at `guides/companies/{TICKER}.md` for any overrides.

**Order of operations:**
1. ATS platform guide (general patterns)
2. Company-specific guide (overrides and additions)
3. Playbook JSON (machine-readable step-by-step)

### Step 4: Handle Edge Cases

#### Comboboxes (ARIA Combobox / Autocomplete Dropdowns)

Many ATS platforms use ARIA combobox widgets for location, department, and other fields. These do NOT work with simple `input.value = "..."` assignment. You must:

1. Click the combobox input to open the dropdown
2. Type the desired value slowly (50-100ms between keystrokes)
3. Wait for the dropdown options to appear (200-500ms)
4. Click the matching option from the dropdown list
5. Verify the selection was committed (the input value should update)

Greenhouse, SmartRecruiters, and Ashby all use this pattern.

#### reCAPTCHA

- **Greenhouse**: Uses invisible reCAPTCHA Enterprise on the submit button. It triggers automatically when you click Submit. If you are running headful Chrome with a normal-looking fingerprint, it usually passes silently. If it blocks, you need a human in the loop.
- **Workday**: Generally does not use reCAPTCHA, but may have bot-detection via session fingerprinting.
- **General strategy**: Run a headful browser (not headless), use a residential IP, and maintain realistic mouse movement and typing patterns.

#### Email Verification

Some ATS platforms (SmartRecruiters, some custom portals) send a verification email after application submission. Your agent cannot complete this step without access to the applicant's email inbox.

#### Session Timeouts

- **Workday**: Sessions expire after ~15 minutes of inactivity. If you are filling a long form, keep the session alive with periodic interactions.
- **Taleo**: Aggressive session timeouts. Complete the form as quickly as possible.

#### File Uploads

Best practices for resume upload:
- **Format**: PDF (universally accepted)
- **Size**: Under 2MB
- **Content**: Must be text-selectable (not a scanned image). Many ATS platforms auto-parse the resume.
- **Selector**: Usually `input[type='file']` or a specific `data-automation-id` on Workday

#### EEO / Voluntary Self-Identification

Most applications include Equal Employment Opportunity questions (race, gender, veteran status, disability). These are legally required to be optional.

**Default behavior**: Always select "Decline to self-identify" or "I choose not to disclose" for all EEO questions.

Do not attempt to infer or fabricate demographic data for the applicant.

---

## ATS Difficulty Ratings

| Rating     | Meaning |
|------------|---------|
| **Easy**   | Single-page form, standard HTML inputs, minimal JavaScript complexity. Examples: Lever, Ashby. Estimated time: 1-2 minutes per application. |
| **Moderate** | Multi-section form, some comboboxes or dynamic elements, but no account creation required. Examples: Greenhouse, SmartRecruiters. Estimated time: 2-4 minutes per application. |
| **Hard**   | Multi-page wizard, account creation required, dynamic element IDs, possible CAPTCHAs, session management issues. Examples: Workday, iCIMS, Taleo. Estimated time: 5-15 minutes per application. |

---

## H-1B Sponsorship Lookup

To find companies that sponsor H-1B visas:

```bash
jq '[.[] | select(.h1b_sponsor == true) | {ticker, name}]' data/companies.json
```

Note: `h1b_sponsor: true` means the company has historically sponsored H-1B visas. It does NOT guarantee sponsorship for a specific role. Always check the individual job listing for sponsorship availability.

---

## Detecting ATS Platform Changes

Companies occasionally migrate between ATS platforms (e.g., from Lever to Greenhouse, or from custom to Workday). To detect this:

1. Fetch the careers URL from `data/companies.json`
2. Check the response URL and page content against the `detection_patterns` in `data/ats-platforms.json`
3. Each ATS platform has both URL patterns and DOM selectors for detection:
   - **URL patterns**: Check if the final URL (after redirects) matches known ATS domains
   - **DOM patterns**: Check if the page HTML contains known ATS-specific elements

If you detect a platform change, the data in this repo may be stale. Open a GitHub issue or PR with your findings.

---

## Rate Limiting Recommendations

Be a responsible citizen of the internet:

| ATS Platform   | Recommended Rate        | Notes |
|----------------|------------------------|-------|
| Greenhouse     | 10-15 applications/hour | API rate limit is generous. Application submissions are slower due to reCAPTCHA. |
| Workday        | 3-5 applications/hour   | Account creation + multi-step wizard is slow. Do not rush -- it triggers bot detection. |
| Lever          | 10-15 applications/hour | Simple forms, fast submission. |
| Ashby          | 10-15 applications/hour | Clean forms, fast submission. |
| Custom portals | 2-3 applications/hour   | Unknown rate limits. Err on the side of caution. |

**General rules:**
- Wait 3-5 seconds between page navigations
- Wait 1-2 seconds between form field interactions
- Randomize delays slightly (+/- 20%) to avoid fingerprinting
- Cache job listing data locally -- do not re-fetch the same API endpoint repeatedly
- Respect `robots.txt` on career pages

---

## Citation Format

If your AI agent uses data from this repository, cite it as:

```
[sp500-careers/{TICKER}](https://github.com/snehitvaddi/sp500-careers)
```

Example:
```
Application strategy based on [sp500-careers/DDOG](https://github.com/snehitvaddi/sp500-careers)
```

---

## Quick Reference: Greenhouse API

Greenhouse is the most automation-friendly ATS. Here is the API pattern:

```
# List all jobs for a company
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs

# Get a specific job
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{job_id}

# Get job with questions (needed for application)
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{job_id}?questions=true
```

All Greenhouse API endpoints are public and require no authentication. Response format is JSON.

The `exports/greenhouse-slugs.json` file contains all known Greenhouse slugs for S&P 500 IT companies.

---

## Quick Reference: Workday URLs

Workday URLs follow the pattern `https://{company}.wd{N}.myworkdayjobs.com/` where `{N}` is 1, 2, 3, or 5.

The `exports/workday-urls.json` file contains all known Workday URLs for S&P 500 IT companies.

Key Workday selectors (use `data-automation-id` attribute):

| Selector                                         | Purpose |
|--------------------------------------------------|---------|
| `[data-automation-id="jobSearchBar"]`            | Job search input |
| `[data-automation-id="locationSearchBar"]`       | Location filter |
| `[data-automation-id="jobTitle"]`                | Job title in listing |
| `[data-automation-id="applyButton"]`             | Apply button |
| `[data-automation-id="legalNameSection_firstName"]` | First name field |
| `[data-automation-id="legalNameSection_lastName"]`  | Last name field |
| `[data-automation-id="email"]`                   | Email field |
| `[data-automation-id="phone-number"]`            | Phone field |
| `[data-automation-id="file-upload-input-ref"]`   | Resume upload |

---

## File Inventory

For programmatic consumption, here is every file in this repository that an agent should know about:

| Path | Format | Purpose |
|------|--------|---------|
| `data/companies.json` | JSON array | All 68 companies with metadata |
| `data/ats-platforms.json` | JSON array | ATS platform definitions and detection patterns |
| `data/changelog.json` | JSON array | History of data changes |
| `playbooks/_schema.json` | JSON Schema | Validation schema for playbook files |
| `playbooks/_template.json` | JSON | Blank playbook template |
| `playbooks/by-ticker/{TICKER}.json` | JSON | Per-company playbook |
| `playbooks/by-ats/{platform}.json` | JSON | Playbooks grouped by ATS |
| `guides/README.md` | Markdown | Guide index |
| `guides/{platform}.md` | Markdown | ATS platform navigation guide |
| `guides/companies/{TICKER}.md` | Markdown | Per-company navigation guide |
| `exports/greenhouse-slugs.json` | JSON | Greenhouse slug export |
| `exports/workday-urls.json` | JSON | Workday URL export |
| `exports/lever-slugs.json` | JSON | Lever slug export |
| `exports/ashby-slugs.json` | JSON | Ashby slug export |
| `exports/all-companies.md` | Markdown | Full company table |
