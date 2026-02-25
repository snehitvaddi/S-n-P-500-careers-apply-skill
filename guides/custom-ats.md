# Custom / Proprietary ATS — Agent Navigation Guide

## Overview

| Field           | Value                                                  |
|-----------------|--------------------------------------------------------|
| Platform        | Custom / Proprietary                                   |
| Difficulty      | Varies (Medium to Hard)                                |
| Form Type       | Varies                                                 |
| Account Required| Often yes                                              |
| API Available   | Rarely                                                 |
| CAPTCHA         | Common                                                 |
| Prevalence      | Large tech companies (FAANG, etc.)                     |

Some of the largest technology companies build their own career portals instead of using third-party ATS platforms. These custom systems vary widely in design and behavior, but share some common patterns.

---

## How to Detect a Custom ATS

When visiting a company's career page, check for these indicators:

### Signs it is a KNOWN ATS
```
- URL contains: greenhouse.io, lever.co, myworkdayjobs.com, icims.com,
  taleo.net, smartrecruiters.com, ashbyhq.com
- Page source references known ATS scripts or stylesheets
- Form structure matches documented ATS patterns
```

### Signs it is a CUSTOM ATS
```
- Career page is on the company's own domain (e.g., careers.google.com)
- No references to known ATS platforms in page source
- URL structure does not match any known ATS pattern
- Unique UI that does not resemble any standard ATS
- Company-branded design throughout the entire flow
```

### Detection Script (Playwright)
```typescript
async function detectATS(page: Page): Promise<string> {
  const url = page.url();
  const html = await page.content();

  // Check URL patterns
  if (url.includes('greenhouse.io') || url.includes('boards-api.greenhouse.io'))
    return 'greenhouse';
  if (url.includes('lever.co'))
    return 'lever';
  if (url.includes('myworkdayjobs.com'))
    return 'workday';
  if (url.includes('icims.com'))
    return 'icims';
  if (url.includes('taleo.net'))
    return 'taleo';
  if (url.includes('smartrecruiters.com'))
    return 'smartrecruiters';
  if (url.includes('ashbyhq.com'))
    return 'ashby';

  // Check page source for embedded ATS
  if (html.includes('greenhouse') && html.includes('job_application'))
    return 'greenhouse-embedded';
  if (html.includes('lever.co'))
    return 'lever-embedded';
  if (html.includes('workday'))
    return 'workday-embedded';

  return 'custom';
}
```

---

## Notable Custom ATS Platforms

### Google (Alphabet) — `careers.google.com`
- Fully custom career portal
- Account required (Google account)
- Multi-step application with Google-specific UI
- Location-based job search with Google Maps integration
- Requires uploading resume as PDF or Google Doc
- Known for complex screening questions

### Amazon — `amazon.jobs`
- Custom career portal
- Account creation required
- Resume upload + profile creation
- Multi-step wizard with screening questions
- High volume of positions
- Location and team-based filtering

### Meta (Facebook) — `metacareers.com`
- Custom career portal
- Uses Facebook/Meta account or email registration
- Clean, modern UI
- Application tracking dashboard
- Referral code field prominently featured

### Apple — `jobs.apple.com`
- Custom career portal
- Apple ID may be required
- Clean, minimal design
- Multi-step application
- Roles organized by team and location

### Microsoft — `careers.microsoft.com`
- Uses a customized version of internal tooling
- Microsoft account sign-in
- LinkedIn integration (owned by Microsoft)
- Resume upload and profile builder
- Multi-step with team-specific questions

---

## General Strategy for Unknown Career Portals

### Step 1: Reconnaissance
```
1. Navigate to the career page
2. SNAPSHOT the page
3. Identify:
   a. Is there a job search interface?
   b. Is there a direct "Apply" button?
   c. Does it require login/account creation?
   d. What form fields are visible?
```

### Step 2: Find the Application Form
```
4. Search for the target job:
   a. Use the search bar if available
   b. Browse by department/category
   c. Filter by location
5. Click on the job listing
6. Find and click the "Apply" button
7. SNAPSHOT the application form
```

### Step 3: Identify Form Fields
```
8. SNAPSHOT the form to see all visible fields
9. For each field, identify:
   a. Field type (text, email, tel, select, file, etc.)
   b. Required status (asterisk, "required" attribute, etc.)
   c. Best selector (id, name, aria-label, label text)
10. Create a field map:
    - Field name -> selector -> value to fill
```

### Step 4: Fill the Form
```
11. Fill fields in order (top to bottom, left to right)
12. For each field:
    a. Wait for field to be visible and enabled
    b. Clear existing value
    c. Type/select the new value
    d. Tab to next field
13. Upload resume when prompted
14. Answer screening questions
```

### Step 5: Handle Account Creation
```
15. If login/registration required:
    a. Look for "Create Account" or "Register" link
    b. Fill registration form
    c. Handle email verification if needed
    d. Log in with new credentials
    e. Navigate back to the job application
```

### Step 6: Submit
```
16. Review all entered data
17. Take pre-submission screenshot
18. Click Submit
19. Wait for confirmation
20. Take post-submission screenshot
```

---

## Common Patterns Across Custom Systems

### 1. Form Field Naming
Even custom systems tend to use predictable field names:
```css
/* First/Last name */
input[name*="first" i]
input[name*="last" i]
input[name*="name" i]

/* Contact */
input[name*="email" i]
input[name*="phone" i]
input[type="email"]
input[type="tel"]

/* Resume */
input[type="file"]
input[name*="resume" i]
input[name*="cv" i]

/* URLs */
input[name*="linkedin" i]
input[name*="github" i]
input[name*="portfolio" i]
input[name*="website" i]
```

### 2. Aria Attributes
Modern custom ATS platforms use proper ARIA attributes:
```css
[aria-label*="first name" i]
[aria-label*="email" i]
[aria-label*="resume" i]
[role="combobox"]
[role="listbox"]
[role="option"]
```

### 3. Submit Buttons
```css
button[type="submit"]
input[type="submit"]
button:has-text("Submit")
button:has-text("Apply")
button:has-text("Send Application")
```

### 4. Required Fields
```css
[required]
[aria-required="true"]
.required
label:has-text("*")
```

---

## How to Create a New Playbook

When encountering a custom ATS for the first time, follow this process to create a reusable playbook:

### 1. Document the URL Structure
```markdown
- Career page: https://careers.{company}.com/
- Job search: https://careers.{company}.com/search?q=...
- Job detail: https://careers.{company}.com/jobs/{id}
- Application: https://careers.{company}.com/jobs/{id}/apply
```

### 2. Document Required Steps
```markdown
1. Account creation? (Yes/No, what fields)
2. Number of form pages
3. Fields on each page (name, type, required, selector)
4. File upload method
5. CAPTCHA type (if any)
6. Confirmation indicator (success message, URL change, etc.)
```

### 3. Document Selectors
```markdown
| Field        | Selector                      | Type    | Required |
|--------------|-------------------------------|---------|----------|
| First Name   | input#firstName               | text    | Yes      |
| ...          | ...                           | ...     | ...      |
```

### 4. Document Quirks
```markdown
- Any unusual behavior (timing issues, dynamic fields, etc.)
- Error handling notes
- Rate limiting observations
- CAPTCHA behavior
```

### 5. Test & Iterate
```markdown
- Run the playbook manually first
- Note any failures
- Adjust selectors and timing
- Run automated test
- Refine until reliable
```

---

## CAPTCHA Handling for Custom Systems

Custom ATS platforms may use various CAPTCHA solutions:

| CAPTCHA Type         | Detection                                  | Handling                  |
|----------------------|--------------------------------------------|---------------------------|
| reCAPTCHA v2         | `div.g-recaptcha`                          | Pause, alert user         |
| reCAPTCHA v3         | `script[src*="recaptcha/api.js?render="]`  | Usually passes silently   |
| reCAPTCHA Enterprise | `script[src*="recaptcha/enterprise.js"]`   | Higher risk of blocking   |
| hCaptcha             | `div.h-captcha`                            | Pause, alert user         |
| Cloudflare Turnstile | `div.cf-turnstile`                         | Usually passes silently   |
| Custom CAPTCHA       | Varies                                     | Pause, alert user         |

### General CAPTCHA Strategy
1. Use a real browser (not headless mode).
2. Add natural interaction delays.
3. If CAPTCHA appears, pause and alert the user.
4. Never attempt to solve CAPTCHAs automatically without explicit user consent.

---

## Anti-Bot Detection Patterns

Custom systems may employ additional anti-bot measures:

1. **Honeypot fields** — hidden fields that should never be filled
2. **Timing checks** — forms submitted too fast are flagged
3. **Mouse movement tracking** — no mouse movement indicates automation
4. **Browser fingerprinting** — headless browsers have detectable fingerprints
5. **Rate limiting** — too many applications from one IP

### Mitigation
- Use `playwright` with `--no-headless` flag
- Add human-like delays between actions (200-1000ms)
- Simulate mouse movements between fields
- Limit applications to 3-5 per hour per IP
- Use a real user agent string
