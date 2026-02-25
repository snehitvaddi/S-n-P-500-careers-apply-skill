# Greenhouse ATS — Agent Navigation Guide

## Overview

| Field           | Value                                               |
|-----------------|-----------------------------------------------------|
| Platform        | Greenhouse                                          |
| Difficulty      | Medium                                              |
| Form Type       | Multi-page (typically 2-3 pages)                    |
| Account Required| No                                                  |
| API Available   | Yes (public, no auth)                               |
| CAPTCHA         | Invisible reCAPTCHA Enterprise on submit            |
| Prevalence      | Most common ATS for tech startups and mid-size cos  |

Greenhouse is the most widely used ATS among technology companies in the S&P 500. It offers a public JSON API for job discovery and a relatively consistent form structure across companies, making it the most automatable platform.

---

## Job Discovery

### Public API

Greenhouse exposes a free, unauthenticated JSON API for every company that uses it.

**List all jobs for a company:**
```
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
```

**Get a single job:**
```
GET https://boards-api.greenhouse.io/v1/boards/{slug}/jobs/{job_id}
```

**Parameters:**
- `{slug}` — the company's Greenhouse board slug (e.g., `airbnb`, `stripe`, `figma`)
- `content=true` — includes the full job description HTML in the response

**Response shape (list):**
```json
{
  "jobs": [
    {
      "id": 123456,
      "title": "Senior Software Engineer",
      "location": { "name": "San Francisco, CA" },
      "departments": [{ "name": "Engineering" }],
      "content": "<p>Job description HTML...</p>",
      "updated_at": "2026-01-15T...",
      "absolute_url": "https://boards.greenhouse.io/{slug}/jobs/123456"
    }
  ],
  "meta": { "total": 42 }
}
```

**Code example (TypeScript):**
```typescript
async function fetchGreenhouseJobs(slug: string) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Greenhouse API error: ${res.status}`);
  const data = await res.json();
  return data.jobs;
}
```

**Code example (Python):**
```python
import requests

def fetch_greenhouse_jobs(slug: str) -> list:
    url = f"https://boards-api.greenhouse.io/v1/boards/{slug}/jobs"
    params = {"content": "true"}
    resp = requests.get(url, params=params)
    resp.raise_for_status()
    return resp.json()["jobs"]
```

### Board URLs

- **Job board page:** `https://boards.greenhouse.io/{slug}`
- **Embedded application form:** `https://job-boards.greenhouse.io/embed/job_app?for={slug}&token={job_id}`
- **Direct application URL:** `https://boards.greenhouse.io/{slug}/jobs/{job_id}`

---

## Application Form Structure

Greenhouse application forms typically have 2-3 pages:

### Page 1: Basic Information

| Field                  | Type        | Required | Selector Pattern                                                    |
|------------------------|-------------|----------|---------------------------------------------------------------------|
| First Name             | text input  | Yes      | `input#first_name`, `input[name="job_application[first_name]"]`     |
| Last Name              | text input  | Yes      | `input#last_name`, `input[name="job_application[last_name]"]`       |
| Preferred First Name   | text input  | Sometimes| `input[name*="preferred"]`                                          |
| Email                  | email input | Yes      | `input#email`, `input[name="job_application[email]"]`               |
| Phone                  | tel input   | Yes      | `input#phone`, `input[name="job_application[phone]"]`               |
| Country Code           | combobox    | Sometimes| Combobox near phone field                                           |
| Resume/CV              | file upload | Yes      | `input[type="file"]#resume`, `input[type="file"]`                   |
| Cover Letter           | file upload | No       | `input[type="file"]#cover_letter`                                   |
| LinkedIn Profile       | text input  | No       | `input[name*="linkedin"]`, `input[name*="urls[LinkedIn]"]`          |
| Website                | text input  | No       | `input[name*="website"]`, `input[name*="urls[Portfolio]"]`          |
| Location               | autocomplete| Sometimes| Google Places autocomplete input                                    |
| How Did You Hear?      | dropdown    | Sometimes| `select` or combobox with "How did you hear" label                  |

### Page 2: Custom Questions (varies by company)

| Common Field           | Type        | Notes                                                |
|------------------------|-------------|------------------------------------------------------|
| Work Authorization     | dropdown    | "Are you legally authorized to work in the US?"      |
| Sponsorship Need       | dropdown    | "Will you now or in the future require sponsorship?" |
| Years of Experience    | dropdown    | Ranges like "0-2", "3-5", "5-10", "10+"             |
| Salary Expectations    | text input  | Sometimes numeric-only                               |
| Start Date             | text/date   | "When can you start?"                                |
| Certifications         | text/dropdown| Varies                                              |
| Languages              | multi-select| Sometimes combobox                                   |
| Cover Letter Text      | textarea    | When file upload is not used                         |

### Page 3: EEO (Equal Employment Opportunity)

| Field                  | Type        | Default Recommendation                |
|------------------------|-------------|---------------------------------------|
| Gender                 | dropdown    | "Decline to self-identify"            |
| Race/Ethnicity         | dropdown    | "Decline to self-identify"            |
| Veteran Status         | dropdown    | "Decline to self-identify"            |
| Disability Status      | dropdown    | "Decline to self-identify"            |

> **Agent note:** EEO fields are always optional under US law. Default to "Decline to self-identify" unless the user has explicitly configured values.

---

## CRITICAL: Combobox Interaction Pattern

Greenhouse uses React-based comboboxes (not native `<select>` elements) for many dropdowns. These require a specific interaction sequence:

```
1. CLICK the combobox element to open the dropdown
2. SNAPSHOT to discover the listbox options (new refs appear dynamically)
3. CLICK the desired option ref to select it
```

### Why This Matters

- **Option refs are DYNAMIC** — they change every time the dropdown opens. You cannot cache or hardcode option references.
- **After clicking an option, the combobox value may appear empty.** This is normal React behavior (the display value clears momentarily). Do NOT re-click or re-type.
- **Verify selection** by looking for a `log` element or status text with "X selected" confirmation.

### Combobox Pseudocode

```
function selectComboboxOption(comboboxRef, optionText):
    click(comboboxRef)                         // Open dropdown
    snapshot()                                 // Discover option refs
    options = findAll("[role='option']")        // Find all options
    target = options.find(o => o.text.includes(optionText))
    if target:
        click(target.ref)                      // Select option
    else:
        // Option not found — try typing to filter
        type(comboboxRef, optionText)
        snapshot()
        options = findAll("[role='option']")
        click(options[0].ref)                  // Select first match
```

### Location Autocomplete (Google Places)

The Location field uses Google Places autocomplete, which behaves differently from standard comboboxes:

```
1. CLICK the location input field
2. TYPE the city name (e.g., "San Francisco")
3. WAIT 500ms for suggestions to appear
4. SNAPSHOT to see suggestion list
5. CLICK the desired suggestion (usually the first one)
```

> **Warning:** Do NOT press Enter before selecting a suggestion — this may submit partial text.

---

## Selector Patterns — Complete Reference

### Text Inputs
```css
/* Core fields */
input#first_name
input#last_name
input#email
input#phone

/* Alternative selectors (more stable) */
input[name="job_application[first_name]"]
input[name="job_application[last_name]"]
input[name="job_application[email]"]
input[name="job_application[phone]"]

/* URL fields */
input[name*="urls[LinkedIn]"]
input[name*="urls[Portfolio]"]
input[name*="urls[GitHub]"]
input[name*="urls[Website]"]
input[name*="urls[Twitter]"]
```

### File Upload
```css
/* Resume */
input[type="file"]#resume
input[type="file"][name*="resume"]

/* Cover letter */
input[type="file"]#cover_letter
input[type="file"][name*="cover_letter"]

/* Generic (when specific IDs not present) */
input[type="file"]
```

### Dropdowns and Custom Questions
```css
/* Custom question dropdowns (N is the question index, starts at 0) */
select#job_application_answers_attributes_N_answer_selected_value

/* Combobox-style dropdowns */
[role="combobox"]
[role="listbox"]
[role="option"]
```

### Submit Button
```css
input[type="submit"][value="Submit Application"]
button[type="submit"]
input[type="submit"]
```

### Navigation Buttons
```css
/* Next page */
button:has-text("Next")
a:has-text("Next")

/* Previous page */
button:has-text("Back")
a:has-text("Back")
```

---

## File Upload Method

Greenhouse hides the actual `<input type="file">` element behind a styled "Attach" or "Upload" button.

### Playwright
```typescript
// Method 1: Direct file input (preferred)
await page.setInputFiles('input[type="file"]', '/path/to/resume.pdf');

// Method 2: If file input is hidden, force visibility first
await page.evaluate(() => {
  document.querySelector('input[type="file"]').style.display = 'block';
});
await page.setInputFiles('input[type="file"]', '/path/to/resume.pdf');
```

### OpenClaw Browser Agent
```
browser upload /path/to/resume.pdf --ref <attach_button_ref>
```

### Verification

After upload, verify the file name appears next to the upload button. Look for:
```css
/* File name display */
.file-name
span:has-text(".pdf")
[data-testid="file-name"]
```

---

## CAPTCHA Handling

### Detection

Greenhouse uses **Invisible reCAPTCHA Enterprise** on the submit step. Detect it with:

```css
script[src*="recaptcha"]
div.grecaptcha-badge
iframe[src*="recaptcha"]
```

### Behavior

- **In most cases, invisible reCAPTCHA passes silently** for real browser sessions with normal mouse movements and typing patterns.
- The CAPTCHA fires when the submit button is clicked — there is no visible challenge unless the risk score is high.

### If CAPTCHA Blocks Submission

1. **Pause the automation** and alert the user.
2. The user can manually solve the CAPTCHA challenge.
3. Resume automation after the CAPTCHA is cleared.

### Mitigation Tips

- Use a real browser (not headless) to reduce CAPTCHA risk.
- Add natural delays between field interactions (200-500ms).
- Move the mouse naturally (not teleporting between fields).
- Avoid submitting more than 5 applications per hour from the same IP.

---

## Email Verification (Some Companies)

Some Greenhouse companies trigger an email verification step after form submission:

1. After clicking submit, a modal appears asking for a security code.
2. An 8-character alphanumeric code is emailed from `no-reply@us.greenhouse-mail.io`.
3. The code must be entered one character per input box (8 separate inputs).
4. After entering the code, click "Verify" or "Submit" again.

### Handling

```
1. After submit, SNAPSHOT the page
2. If a verification modal appears:
   a. Alert the user to check email for code from greenhouse-mail.io
   b. Wait for user to provide the code
   c. Type one character into each of the 8 input boxes
   d. Click the verify/submit button
3. If no modal appears, check for confirmation page
```

---

## Step-by-Step Application Procedure

### PHASE 1: OPEN & DETECT

```
1. Navigate to the application URL:
   https://boards.greenhouse.io/{slug}/jobs/{job_id}
   OR
   https://job-boards.greenhouse.io/embed/job_app?for={slug}&token={job_id}

2. Wait for the form to fully load:
   - Wait for selector: input#first_name OR input[name*="first_name"]
   - Timeout: 10 seconds

3. SNAPSHOT the page to identify all form fields and their current state
```

### PHASE 2: TEXT FIELDS

```
4. Fill First Name:
   - Selector: input#first_name
   - Action: clear, then type value

5. Fill Last Name:
   - Selector: input#last_name
   - Action: clear, then type value

6. Fill Email:
   - Selector: input#email
   - Action: clear, then type value

7. Fill Phone:
   - Selector: input#phone
   - Action: clear, then type value
   - Format: include country code, e.g., "+1 (555) 123-4567"

8. Fill LinkedIn URL (if field exists):
   - Selector: input[name*="linkedin"] or input[name*="urls[LinkedIn]"]
   - Action: clear, then type full URL

9. Fill Website/Portfolio (if field exists):
   - Selector: input[name*="website"] or input[name*="urls[Portfolio]"]
   - Action: clear, then type full URL
```

### PHASE 3: RESUME UPLOAD

```
10. Upload Resume:
    - Locate the "Attach" button or file input near "Resume/CV" label
    - Use setInputFiles or browser upload command
    - File: /path/to/resume.pdf

11. Verify Upload:
    - SNAPSHOT the page
    - Confirm the file name (e.g., "resume.pdf") appears near the upload area
    - If no file name visible, retry upload
```

### PHASE 4: DROPDOWNS (Comboboxes)

For each combobox/dropdown field, follow the combobox interaction pattern:

```
12. Country (if present):
    - Click combobox -> Snapshot -> Click "United States" option

13. Work Authorization (if present):
    - Click combobox -> Snapshot -> Click "Yes" option

14. Sponsorship Required (if present):
    - Click combobox -> Snapshot -> Click "Yes" option
    (Set to "Yes" if user requires H-1B sponsorship)

15. How Did You Hear About Us? (if present):
    - Click combobox -> Snapshot -> Click "LinkedIn" or "Job Board" option

16. Other custom dropdowns:
    - For each: Click -> Snapshot -> Select appropriate option
    - If unsure which option, SNAPSHOT and present choices to user
```

### PHASE 5: LOCATION (if present)

```
17. Location / City:
    - Click the location input
    - Type the city name (e.g., "San Francisco, CA")
    - Wait 500ms for Google Places suggestions
    - SNAPSHOT to see suggestions
    - Click the first matching suggestion
```

### PHASE 6: EEO (if present, always optional)

```
18. Gender:
    - Click combobox -> Snapshot -> Click "Decline to self-identify"

19. Race/Ethnicity:
    - Click combobox -> Snapshot -> Click "Decline to self-identify"

20. Veteran Status:
    - Click combobox -> Snapshot -> Click "I don't wish to answer"

21. Disability Status:
    - Click combobox -> Snapshot -> Click "Decline to self-identify"
```

### PHASE 7: VALIDATE

```
22. SNAPSHOT the entire form
23. Check each required field has a value:
    - First Name: non-empty
    - Last Name: non-empty
    - Email: valid email format
    - Phone: non-empty
    - Resume: file name visible
24. If any required field is empty, go back and fill it
```

### PHASE 8: CAPTCHA CHECK

```
25. Check for reCAPTCHA elements:
    - Look for: script[src*="recaptcha"], div.grecaptcha-badge
    - If found: proceed (invisible reCAPTCHA will fire on submit)
    - If visible challenge appears: PAUSE and alert user
```

### PHASE 9: SUBMIT

```
26. Take a pre-submission screenshot for records
27. Click submit:
    - Selector: input[type="submit"][value="Submit Application"]
    - OR: button[type="submit"]
28. Wait for navigation or confirmation (timeout: 15 seconds)
29. SNAPSHOT the result page
30. Check for:
    - Success: "Application submitted" or "Thank you" message
    - Email verification: Modal asking for security code
    - Error: Red text indicating missing/invalid fields
    - CAPTCHA challenge: Visible reCAPTCHA widget
31. Take a post-submission screenshot for records
```

---

## Known Quirks and Workarounds

### 1. React Combobox Value Clearing
After selecting a combobox option, the displayed value may momentarily clear. This is React re-rendering. Do NOT attempt to re-select. Verify by checking for a "selected" log element instead.

### 2. Phone Field Country Code
Some Greenhouse forms have a separate country code dropdown next to the phone field. If present, select the country code first, then type only the local number.

### 3. Custom Questions with Free Text
Some custom questions accept free-text answers. These typically use `<textarea>` elements:
```css
textarea[name*="job_application[answers_attributes]"]
```

### 4. Multi-Select Questions
Some questions allow multiple selections. These use checkboxes:
```css
input[type="checkbox"][name*="job_application[answers_attributes]"]
```

### 5. Conditional Fields
Some fields only appear after a previous field is filled. For example, selecting "Yes" for sponsorship may reveal a follow-up question. Always SNAPSHOT after filling dropdowns to detect new fields.

### 6. Application URL Formats
Different companies may use slightly different URL formats:
- `https://boards.greenhouse.io/{slug}/jobs/{job_id}`
- `https://job-boards.greenhouse.io/embed/job_app?for={slug}&token={job_id}`
- `https://{custom_domain}/jobs/{job_id}` (custom career domains that redirect to Greenhouse)

### 7. Rate Limiting
The Greenhouse API and application forms may rate-limit aggressive bots. Recommended:
- API: max 10 requests/second
- Applications: max 5 per hour per IP
- Add 200-500ms delay between field interactions

### 8. Session Expiry
Greenhouse application forms have session timeouts (typically 30 minutes). If the form takes too long to fill, the session may expire and the form will need to be reloaded.

### 9. Draft Saving
Greenhouse does NOT save drafts. If the page is refreshed, all entered data is lost. Complete the form in one session.

### 10. Duplicate Application Detection
Greenhouse tracks applications by email. Submitting the same email to the same job will either be rejected or create a duplicate entry (behavior varies by company configuration).
