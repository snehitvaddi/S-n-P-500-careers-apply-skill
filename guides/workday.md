# Workday ATS — Agent Navigation Guide

## Overview

| Field           | Value                                                  |
|-----------------|--------------------------------------------------------|
| Platform        | Workday                                                |
| Difficulty      | Hard                                                   |
| Form Type       | 6-7 step wizard                                        |
| Account Required| Yes (global Workday account)                           |
| API Available   | No public API                                          |
| CAPTCHA         | Sometimes (on account creation)                        |
| Prevalence      | Most common for Fortune 500 / large enterprises        |

Workday is the most difficult ATS to automate. It requires account creation, uses a multi-step wizard with dynamic form fields, and has several anti-automation patterns including honeypot fields and unpredictable selectors.

---

## URLs

| URL Type        | Pattern                                                |
|-----------------|--------------------------------------------------------|
| Career site     | `https://{company}.wd{n}.myworkdayjobs.com/`          |
| Job search      | `https://{company}.wd{n}.myworkdayjobs.com/{board}`   |
| Job detail      | `https://{company}.wd{n}.myworkdayjobs.com/{board}/job/{job_id}` |
| Apply           | `https://{company}.wd{n}.myworkdayjobs.com/{board}/job/{job_id}/apply` |

- `{company}` — company identifier (e.g., `salesforce`, `nvidia`)
- `{n}` — Workday instance number (1-5, varies by company)
- `{board}` — career board name (e.g., `en-US`, `External`, `careers`)

> **Important:** The `wd{n}` number varies by company. Common values are `wd1`, `wd3`, and `wd5`.

---

## Key Concept: Global Workday Account

Workday accounts are **global across all companies**. One account (email + password) works on every Workday-powered career site. This means:

- Create the account once, then reuse it everywhere.
- If you already have a Workday account from a previous application, sign in instead of creating a new one.
- Your resume and profile data may auto-populate from previous applications.

### Password Requirements
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

---

## Selector Strategy: `data-automation-id`

**CRITICAL:** Do NOT rely on CSS IDs or class names in Workday. They are dynamically generated and change between page loads. Instead, use `data-automation-id` attributes, which are stable:

```css
/* GOOD - stable selectors */
[data-automation-id="firstName"]
[data-automation-id="lastName"]
[data-automation-id="email"]
[data-automation-id="phone"]
[data-automation-id="addressLine1"]
[data-automation-id="city"]
[data-automation-id="countryDropdown"]
[data-automation-id="stateDropdown"]
[data-automation-id="postalCode"]
[data-automation-id="resume"]
[data-automation-id="bottom-navigation-next-button"]
[data-automation-id="bottom-navigation-previous-button"]

/* BAD - unstable selectors */
#input-12345  /* changes on every load */
.css-abc123   /* changes on every build */
```

---

## Application Form: 7-Step Wizard

### Step 1: Create Account / Sign In

```
URL: Appears as modal or redirect after clicking "Apply"

IF account exists:
  1. Click "Sign In"
  2. Enter email: [data-automation-id="email"]
  3. Enter password: [data-automation-id="password"]
  4. Click sign in button

IF new account:
  1. Click "Create Account"
  2. Enter email: [data-automation-id="createAccount-email"]
  3. Enter password (meeting all requirements)
  4. Confirm password
  5. Accept terms checkbox
  6. Click create account button
  7. May need email verification
```

### Step 2: My Information

```
Fields:
  - Source / How Did You Hear About Us?
    * TWO-LEVEL multi-select (Category -> Source)
    * First select category (e.g., "Job Board")
    * Then select specific source (e.g., "LinkedIn")
  - Country: [data-automation-id="countryDropdown"]
  - First Name: [data-automation-id="firstName"] (may auto-populate)
  - Last Name: [data-automation-id="lastName"] (may auto-populate)
  - Address Line 1: [data-automation-id="addressLine1"]
  - City: [data-automation-id="city"]
  - State: [data-automation-id="stateDropdown"]
  - Postal Code: [data-automation-id="postalCode"]
  - Phone: [data-automation-id="phone"]
  - Phone Type: dropdown (Mobile/Home/Work)
  - Email: usually pre-filled from account

Click Next: [data-automation-id="bottom-navigation-next-button"]
```

### Step 3: My Experience

```
This step handles resume upload and parsed experience.

1. Upload Resume:
   - Selector: [data-automation-id="resume"] or file input
   - Upload the PDF file

2. WAIT 5-10 seconds for auto-parse
   - Workday attempts to parse the resume
   - Fields may auto-populate with extracted data
   - DO NOT start filling fields until parsing completes

3. Review parsed data:
   - Work Experience entries (may be pre-filled)
   - Education entries (may be pre-filled)
   - Skills

4. If parsed data is incorrect:
   - Delete auto-populated entries
   - Manually add correct information

5. Work Experience (for each entry):
   - Job Title: [data-automation-id="jobTitle"]
   - Company: [data-automation-id="company"]
   - Currently Work Here: checkbox
   - Start Date / End Date: date pickers
   - Description: textarea

6. Education (for each entry):
   - School: [data-automation-id="school"]
   - Degree: dropdown
   - Field of Study: text input
   - GPA (optional)
   - Start Date / End Date: date pickers

Click Next: [data-automation-id="bottom-navigation-next-button"]
```

### Step 4: Application Questions

```
Company-specific questions. Common ones:

- Are you legally authorized to work in the US?
  * Dropdown or radio: Yes/No
- Will you require sponsorship?
  * Dropdown or radio: Yes/No
- Desired salary
  * Text input (numeric)
- Years of experience
  * Dropdown with ranges
- Do you have any relatives at this company?
  * Yes/No
- Have you previously worked at this company?
  * Yes/No

All selectors use [data-automation-id="..."] pattern.
Read each field's data-automation-id via SNAPSHOT.

Click Next: [data-automation-id="bottom-navigation-next-button"]
```

### Step 5: Voluntary Disclosures

```
Legal disclosures and agreements.

- Terms and conditions checkbox
- Privacy policy acknowledgment
- May include state-specific legal notices

Click Next: [data-automation-id="bottom-navigation-next-button"]
```

### Step 6: Self-Identify (EEO)

```
Equal Employment Opportunity fields (all optional):

- Gender: dropdown -> "Decline to Self-Identify"
- Race/Ethnicity: dropdown -> "Decline to Self-Identify"
- Veteran Status: dropdown -> "I don't wish to answer"
- Disability: radio -> "I do not want to answer"

Click Next: [data-automation-id="bottom-navigation-next-button"]
```

### Step 7: Review & Submit

```
1. Review page shows summary of all entered data
2. SNAPSHOT to verify all fields are correct
3. Check the final acknowledgment checkbox (if present)
4. Click Submit:
   - Selector: [data-automation-id="bottom-navigation-next-button"]
   - OR: button:has-text("Submit")
5. Wait for confirmation page
6. SNAPSHOT for records
```

---

## Date Fields

Workday date fields use a **spinbutton/calendar popup** combination. Do NOT try to type dates directly:

```
1. Click the date field to open the calendar popup
2. Use the month/year navigation to reach the target month
3. Click the target day

OR (alternative approach):
1. Click the date field
2. Clear the existing value
3. Type the date in MM/DD/YYYY format
4. Press Tab to commit
```

> **Warning:** The format depends on the company's locale setting. Some use DD/MM/YYYY.

---

## Honeypot Field

**CRITICAL:** Workday forms contain a **honeypot field** that is invisible to real users. It is a hidden input designed to catch bots.

```
NEVER fill any field that has:
  - display: none
  - visibility: hidden
  - opacity: 0
  - position: absolute with negative offsets (e.g., left: -9999px)
```

If a hidden field is detected, **skip it entirely**. Filling it will flag the application as bot-generated.

---

## "How Did You Hear About Us?" — Two-Level Multi-Select

This field is unique to Workday and is one of the trickiest elements:

```
1. Click the "How Did You Hear About Us?" field
2. A FIRST dropdown appears with categories:
   - Job Board
   - Social Media
   - Recruiter
   - Company Website
   - Employee Referral
   - Career Fair
   - Other

3. Select a category (e.g., "Job Board")

4. A SECOND dropdown appears with specific sources:
   - LinkedIn
   - Indeed
   - Glassdoor
   - etc.

5. Select the specific source (e.g., "LinkedIn")

6. The selection appears as a chip/tag
7. Click outside to close the dropdown
```

---

## File Upload Method

### Playwright
```typescript
// Workday file upload
const fileInput = await page.locator('[data-automation-id="resume"] input[type="file"]');
await fileInput.setInputFiles('/path/to/resume.pdf');

// Wait for parsing to complete
await page.waitForTimeout(10000);  // 10 seconds for resume parsing
```

### Verification
After upload, Workday displays:
- File name and size
- "Parsing..." indicator (wait for this to disappear)
- Parsed fields auto-populated (may need correction)

---

## Known Quirks and Workarounds

### 1. Slow Page Loads
Workday pages are notoriously slow. Use generous timeouts:
```typescript
await page.waitForSelector('[data-automation-id="firstName"]', { timeout: 30000 });
```

### 2. Resume Auto-Parse Errors
Workday's resume parser frequently makes mistakes. Common issues:
- Merging two jobs into one entry
- Wrong dates
- Missing education entries
- Garbled text from PDF formatting

Always review and correct parsed data.

### 3. Session Timeouts
Workday sessions expire after ~20 minutes of inactivity. If a form step takes too long, the session may expire and require re-login.

### 4. "Apply" Button Variations
The initial "Apply" button on job pages may be:
```css
[data-automation-id="applyButton"]
a:has-text("Apply")
button:has-text("Apply Now")
```

### 5. Multiple Career Boards
A single company may have multiple career boards (e.g., `en-US`, `External`, `University`). Jobs may appear on different boards with different URLs.

### 6. State/Province Dropdown
The State dropdown only appears after selecting a Country. You must:
1. Select Country first
2. Wait for State dropdown to appear (may take 1-2 seconds)
3. Then select State

### 7. Phone Number Format
Workday expects phone numbers WITHOUT the country code prefix if a separate country code field exists. If no separate field, include the full international format.

### 8. Back Button Caution
Using the browser back button can corrupt the wizard state. Always use the in-page "Previous" button:
```css
[data-automation-id="bottom-navigation-previous-button"]
```

### 9. Application Tracker
After submission, Workday provides an application tracker. The URL is:
```
https://{company}.wd{n}.myworkdayjobs.com/{board}/myApplications
```

### 10. Duplicate Applications
Workday prevents duplicate applications to the same job from the same account. If a previous application exists, it will show "Already Applied" and block resubmission.
