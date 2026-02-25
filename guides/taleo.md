# Taleo (Oracle) ATS — Agent Navigation Guide

## Overview

| Field           | Value                                                  |
|-----------------|--------------------------------------------------------|
| Platform        | Taleo (Oracle Talent Cloud)                            |
| Difficulty      | Hard                                                   |
| Form Type       | Multi-page wizard                                      |
| Account Required| Yes                                                    |
| API Available   | No public API                                          |
| CAPTCHA         | Sometimes (on account creation)                        |
| Prevalence      | Declining — being phased out for Oracle HCM / Workday  |

Taleo is Oracle's legacy ATS platform. It was once the dominant ATS for large enterprises but is gradually being replaced by Oracle HCM Cloud, Workday, and other modern platforms. Taleo forms are notoriously complex, with multi-page wizards, required account creation, and older UI patterns.

---

## URLs

| URL Type        | Pattern                                                       |
|-----------------|---------------------------------------------------------------|
| Career site     | `https://{company}.taleo.net/careersection/`                  |
| Job search      | `https://{company}.taleo.net/careersection/{section}/jobsearch.ftl` |
| Job detail      | `https://{company}.taleo.net/careersection/{section}/jobdetail.ftl?job={job_id}` |
| Application     | `https://{company}.taleo.net/careersection/{section}/jobapply.ftl?job={job_id}` |

> **Note:** `{section}` varies by company and may be values like `2`, `external`, `jobboard`, etc.

---

## Account Creation

Taleo requires account creation before applying. Unlike Workday, Taleo accounts are **company-specific** (not global).

### Registration Fields
| Field               | Type          | Required |
|---------------------|---------------|----------|
| Email               | email input   | Yes      |
| Password            | password      | Yes      |
| Confirm Password    | password      | Yes      |
| First Name          | text input    | Yes      |
| Last Name           | text input    | Yes      |
| Country             | dropdown      | Yes      |
| Security Question   | dropdown      | Sometimes|
| Security Answer     | text input    | Sometimes|

### Password Requirements (typical)
- Minimum 8 characters
- At least one uppercase letter
- At least one number
- No spaces

---

## Selector Strategy

Taleo uses a mix of generated IDs and name-based selectors. The most reliable approach:

### Label-Based (most reliable)
```css
label:has-text("First Name") ~ input
label:has-text("Last Name") ~ input
label:has-text("Email") ~ input
```

### ID Patterns (semi-reliable)
```css
/* Taleo IDs often follow this pattern */
input[id*="firstName"]
input[id*="lastName"]
input[id*="email"]
input[id*="phone"]
input[id*="resume"]
```

### Name Attributes
```css
input[name*="firstName"]
input[name*="lastName"]
input[name*="email"]
```

---

## Application Form: Multi-Page Wizard

### Page 1: Login / Create Account

```
1. If redirected to login:
   - Enter email and password
   - Click "Log In"
2. If new user:
   - Click "New User" or "Create Account"
   - Fill registration form
   - Submit and verify email (if required)
   - Log in with new credentials
```

### Page 2: Personal Information

```
Fields:
  - First Name
  - Middle Name
  - Last Name
  - Address
  - City
  - State / Province
  - Zip / Postal Code
  - Country
  - Phone (Primary)
  - Phone (Secondary)
  - Email (pre-filled from account)

Click Next / Continue
```

### Page 3: Experience & Education

```
Work Experience:
  - Add entries manually or from resume parse
  - Employer Name
  - Job Title
  - Start Date / End Date
  - Description

Education:
  - School Name
  - Degree
  - Major / Field of Study
  - Graduation Date / Expected

Click Next / Continue
```

### Page 4: Resume & Cover Letter

```
1. Upload Resume:
   - Click "Attach Resume" or "Upload"
   - Select file
   - Wait for upload to complete

2. Cover Letter (optional):
   - Upload file or paste text

3. Some companies have resume parsing:
   - Upload may trigger auto-fill of previous pages
   - Review and correct parsed data

Click Next / Continue
```

### Page 5: Screening Questions

```
Company-specific questions:
  - Work authorization
  - Sponsorship requirements
  - Salary expectations
  - Start date availability
  - Years of experience
  - Technical skills
  - Custom questions

Click Next / Continue
```

### Page 6: EEO / Voluntary Disclosures

```
  - Gender: "Decline to self-identify"
  - Race/Ethnicity: "Decline to self-identify"
  - Veteran Status: "I don't wish to answer"
  - Disability: "Decline to self-identify"

Click Next / Continue
```

### Page 7: Review & Submit

```
1. Review all entered data
2. Check acknowledgment/consent boxes
3. Digital signature (type full name)
4. Click Submit
5. Wait for confirmation page
```

---

## File Upload

### Taleo Upload Pattern
```
1. Click "Attach" or "Upload Resume" button
2. A file dialog or upload widget appears
3. Select the file
4. Wait for upload progress to complete
5. Verify file name appears in the upload area
```

### Playwright
```typescript
// Taleo may use a standard file input or a Flash/JS uploader
const fileInput = await page.locator('input[type="file"]');
await fileInput.setInputFiles('/path/to/resume.pdf');

// If file input is not directly accessible, try:
await page.click('button:has-text("Attach Resume")');
// Then handle the file dialog
```

---

## Date Fields

Taleo date fields typically use text inputs with specific format requirements:

```
Format: MM/DD/YYYY (US) or DD/MM/YYYY (international)

1. Click the date field
2. Clear existing value
3. Type the date in the required format
4. Tab to the next field to trigger validation
```

Some Taleo instances use a calendar popup:
```
1. Click the calendar icon next to the date field
2. Navigate to the target month/year
3. Click the target day
```

---

## Step-by-Step Application Procedure

### PHASE 1: NAVIGATE

```
1. Navigate to the job application URL
2. Wait for page to load (timeout: 20 seconds)
3. SNAPSHOT the page
4. Determine if login/account creation is needed
```

### PHASE 2: AUTHENTICATION

```
5. If login required:
   a. Try logging in with existing credentials
   b. If no account, create one
   c. Handle email verification if needed
```

### PHASE 3: FILL EACH WIZARD PAGE

```
6. For each page of the wizard:
   a. SNAPSHOT to identify all fields
   b. Fill all visible required fields
   c. Fill optional fields if data is available
   d. Click Next / Continue
   e. Wait for next page to load
   f. Check for validation errors
   g. If errors, fix and retry
```

### PHASE 4: RESUME UPLOAD

```
7. On the resume/documents page:
   a. Upload resume PDF
   b. Wait for upload to complete
   c. Upload cover letter if desired
   d. Verify uploads appear
```

### PHASE 5: SCREENING & EEO

```
8. Answer screening questions
9. Default EEO to "Decline to self-identify"
```

### PHASE 6: REVIEW & SUBMIT

```
10. On review page, verify all data
11. Check consent boxes
12. Type digital signature if required
13. Click Submit
14. Wait for confirmation
15. SNAPSHOT and screenshot for records
```

---

## Known Quirks and Workarounds

### 1. Being Phased Out
Taleo is being actively retired by Oracle. Many companies that used Taleo have migrated or are migrating to:
- Oracle HCM Cloud (Oracle's modern replacement)
- Workday
- Greenhouse
If a Taleo URL returns a redirect or different UI, the company may have migrated.

### 2. Very Slow Page Loads
Taleo pages are notoriously slow. Use 20-30 second timeouts for page loads and form submissions.

### 3. Session Expiry
Taleo sessions expire quickly (10-15 minutes). Long multi-page forms may time out mid-application.

### 4. Java/Flash Dependencies (Legacy)
Older Taleo instances may have remnants of Java applets or Flash components (especially for file upload). These are non-functional in modern browsers. Look for fallback HTML upload options.

### 5. URL Changes After Actions
Taleo URLs use `.ftl` extensions and query parameters that change after each action. Do not bookmark or cache intermediate URLs.

### 6. Back Button Issues
The browser back button may not work correctly with Taleo's wizard. Always use in-page navigation buttons.

### 7. Dropdown Population Delays
Dropdowns may take 1-2 seconds to populate their options after the page loads. Wait for options to appear before selecting.

### 8. Required Field Asterisks
Required fields are marked with a red asterisk (*). Check for:
```css
.required
.mandatory
span.asterisk
```

### 9. Company-Specific Accounts
Unlike Workday's global account system, each Taleo instance requires a separate account. An account created on `companyA.taleo.net` will NOT work on `companyB.taleo.net`.

### 10. Character Limits
Text fields often have strict character limits (e.g., 500 chars for job descriptions). Taleo may silently truncate text that exceeds the limit rather than showing an error.
