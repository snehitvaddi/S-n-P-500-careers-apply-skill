# SP500 Careers — Agent-Friendly ATS Navigation Guides

## What Are These Guides?

These guides are **agent-friendly ATS (Applicant Tracking System) navigation playbooks**. They provide step-by-step instructions that AI job-apply agents can follow to programmatically navigate career portals, fill out application forms, upload resumes, and submit applications for S&P 500 IT companies.

Each guide is written in a structured, deterministic format so that browser-automation agents (OpenClaw, Playwright-based bots, Selenium scripts, etc.) can parse and execute them without ambiguity.

## How AI Agents Should Use These Guides

### Step 1: Identify the Company

Look up the target company by ticker symbol in the `guides/companies/` directory. Each company file contains:
- The ATS platform the company uses
- The careers URL and API endpoint (if available)
- Company-specific quirks and instructions

### Step 2: Read the Platform Guide

Before interacting with any application form, read the relevant **ATS platform guide** from the table below. Platform guides contain:
- Universal selector patterns for form fields
- Step-by-step navigation flows
- File upload methods
- CAPTCHA handling strategies
- Known quirks and workarounds

### Step 3: Execute

Follow the company guide for company-specific details (URL, API slug, sponsorship info), then follow the platform guide for the actual form-filling procedure.

## Quick Reference: ATS Platform to Guide File

| ATS Platform      | Guide File                  | Difficulty | Notes                                      |
|--------------------|-----------------------------|------------|--------------------------------------------|
| Greenhouse         | `guides/greenhouse.md`      | Medium     | Most common for tech. API available.       |
| Lever              | `guides/lever.md`           | Easy       | Single-page form. Many companies migrating.|
| Workday            | `guides/workday.md`         | Hard       | Multi-step wizard. Account required.       |
| Ashby              | `guides/ashby.md`           | Easy       | Clean React forms.                         |
| SmartRecruiters    | `guides/smartrecruiters.md` | Medium     | Email confirmation required.               |
| iCIMS              | `guides/icims.md`           | Hard       | Iframe-heavy, dynamic IDs.                 |
| Taleo (Oracle)     | `guides/taleo.md`           | Hard       | Legacy system, being phased out.           |
| Custom / Proprietary | `guides/custom-ats.md`    | Varies     | FAANG and large companies often use custom. |

## Handling Companies with "Custom" ATS

Some S&P 500 companies (notably Google/Alphabet, Amazon, Meta) run proprietary career portals that do not use any standard ATS platform. For these companies:

1. Read `guides/custom-ats.md` for general strategies on unknown career portals.
2. Read the specific company guide in `guides/companies/{TICKER}.md` for any known patterns.
3. If the company guide says "Needs verification," the agent should:
   - Navigate to the careers URL listed in the company guide.
   - Snapshot the page and identify form elements.
   - Apply the generic patterns from `custom-ats.md`.
   - Log the discovered selectors for future runs.

## Directory Structure

```
guides/
  README.md               <- You are here
  greenhouse.md           <- Greenhouse ATS platform guide
  lever.md                <- Lever ATS platform guide
  workday.md              <- Workday ATS platform guide
  ashby.md                <- Ashby ATS platform guide
  smartrecruiters.md      <- SmartRecruiters ATS platform guide
  icims.md                <- iCIMS ATS platform guide
  taleo.md                <- Taleo (Oracle) ATS platform guide
  custom-ats.md           <- Custom/proprietary ATS guide
  companies/
    AAPL.md               <- Apple Inc.
    MSFT.md               <- Microsoft Corporation
    ...                   <- 69 total company guides
```

## Contributing

When adding a new company guide:
1. Identify the ATS platform by visiting the careers page.
2. Copy the template from an existing company guide using the same ATS.
3. Fill in the company-specific fields (slug, careers URL, quirks).
4. If the ATS is not yet documented, create a new platform guide following the format of `greenhouse.md`.
