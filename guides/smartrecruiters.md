# SmartRecruiters ATS — Agent Navigation Guide

## Overview

| Field           | Value                                                  |
|-----------------|--------------------------------------------------------|
| Platform        | SmartRecruiters                                        |
| Difficulty      | Medium                                                 |
| Form Type       | Multi-page (typically 2 pages)                         |
| Account Required| No (but email confirmation required)                   |
| API Available   | Limited public API                                     |
| CAPTCHA         | Sometimes                                              |
| Prevalence      | Common among mid-to-large enterprises                  |

SmartRecruiters is used by many large enterprises. It has two URL formats and a notable requirement for email confirmation during the application process. The forms can be multi-page with screening questions on a second page.

---

## URLs

### Two URL Formats

**1. Listing page (standard):**
```
https://careers.smartrecruiters.com/{company}/{job_id}
https://jobs.smartrecruiters.com/{company}/{job_id}
```

**2. One-click apply form (preferred for automation):**
```
https://jobs.smartrecruiters.com/oneclick-ui/company/{company}/posting/{job_id}
```

> **Agent tip:** The one-click apply URL bypasses maintenance pages and loads the form directly. Always prefer this format.

### Job Search API
```
GET https://api.smartrecruiters.com/v1/companies/{company_id}/postings?offset=0&limit=100
```

---

## Application Form Structure

### Page 1: Personal Information

| Field               | Type          | Required | Selector Pattern                              |
|---------------------|---------------|----------|------------------------------------------------|
| First Name          | text input    | Yes      | `input[name="firstName"]`                      |
| Last Name           | text input    | Yes      | `input[name="lastName"]`                       |
| Email               | email input   | Yes      | `input[name="email"]`                          |
| Confirm Email       | email input   | Yes      | `input[name="emailConfirmation"]`              |
| Phone               | tel input     | Sometimes| `input[name="phoneNumber"]`                    |
| Location / City     | autocomplete  | Sometimes| Combobox with city autocomplete                |
| Resume/CV           | file input    | Yes      | `input[type="file"]`                           |
| Cover Letter        | file/textarea | No       | `input[type="file"]` or `textarea`             |
| LinkedIn            | text input    | No       | `input[name*="linkedin"]`                      |

### Page 2: Screening Questions (if present)

| Common Field        | Type          | Notes                                         |
|---------------------|---------------|-----------------------------------------------|
| Work Authorization  | dropdown/radio| "Are you authorized to work in [country]?"    |
| Sponsorship Need    | dropdown/radio| "Do you require visa sponsorship?"            |
| Years of Experience | dropdown      | Ranges                                        |
| Salary Expectations | text input    | Sometimes numeric                             |
| Custom Questions    | varies        | Company-specific                              |

---

## CRITICAL: Email Confirmation

SmartRecruiters requires you to **type your email address TWICE**. The second field is a confirmation:

```
1. Fill email field: input[name="email"]
2. Fill confirmation field: input[name="emailConfirmation"]
3. BOTH must match exactly
```

> **Warning:** Copy-paste detection may be active. Type the email into each field separately rather than pasting.

---

## Selector Patterns

### Core Fields
```css
input[name="firstName"]
input[name="lastName"]
input[name="email"]
input[name="emailConfirmation"]
input[name="phoneNumber"]
```

### File Upload
```css
input[type="file"]
input[type="file"][name*="resume"]
button:has-text("Upload")
button:has-text("Attach")
```

### City Autocomplete
```css
/* City field is typically an autocomplete combobox */
input[name*="location"]
input[name*="city"]
[role="combobox"]
```

### Navigation
```css
button:has-text("Next")
button:has-text("Apply")
button:has-text("Submit")
button[type="submit"]
```

---

## City Autocomplete Combobox

SmartRecruiters uses an autocomplete combobox for the city/location field:

```
1. Click the city input field
2. Type the city name (e.g., "San Francisco")
3. Wait 500ms for autocomplete suggestions
4. SNAPSHOT to see suggestion list
5. Click the desired suggestion
6. Verify the city is populated
```

> **Note:** The autocomplete searches globally, so typing "San" may return cities from multiple countries. Type enough characters to narrow results.

---

## File Upload Method

### Playwright
```typescript
await page.setInputFiles('input[type="file"]', '/path/to/resume.pdf');
```

### Verification
After upload, the filename and size should appear. Look for:
```css
.file-name
span:has-text(".pdf")
.upload-success
```

---

## Step-by-Step Application Procedure

### PHASE 1: OPEN

```
1. Navigate to the one-click apply URL:
   https://jobs.smartrecruiters.com/oneclick-ui/company/{company}/posting/{job_id}

   OR if that fails, navigate to:
   https://careers.smartrecruiters.com/{company}/{job_id}
   and click "Apply"

2. Wait for form to load:
   - Wait for: input[name="firstName"]
   - Timeout: 15 seconds

3. SNAPSHOT to identify all form fields
```

### PHASE 2: PERSONAL INFORMATION

```
4. Fill First Name: input[name="firstName"]
5. Fill Last Name: input[name="lastName"]
6. Fill Email: input[name="email"]
7. Fill Confirm Email: input[name="emailConfirmation"]
   ** MUST match email exactly **
8. Fill Phone (if present): input[name="phoneNumber"]
```

### PHASE 3: LOCATION (if present)

```
9. Click city/location input
10. Type city name
11. Wait for suggestions
12. Click desired suggestion
13. Verify selection
```

### PHASE 4: RESUME UPLOAD

```
14. Upload resume: input[type="file"]
15. Verify file name appears
```

### PHASE 5: ADDITIONAL FIELDS

```
16. Fill LinkedIn URL (if present)
17. Fill any other visible fields on page 1
```

### PHASE 6: NAVIGATE TO PAGE 2 (if multi-page)

```
18. Click "Next" or "Continue"
19. Wait for page 2 to load
20. SNAPSHOT to identify screening questions
```

### PHASE 7: SCREENING QUESTIONS

```
21. For each question:
    - Dropdowns: select appropriate option
    - Radio buttons: click appropriate option
    - Text fields: type answer
22. Work authorization: "Yes" (if authorized)
23. Sponsorship: "Yes" (if needed)
```

### PHASE 8: VALIDATE & SUBMIT

```
24. SNAPSHOT to verify all fields
25. Take pre-submission screenshot
26. Click Submit: button[type="submit"] or button:has-text("Submit")
27. Wait for confirmation (timeout: 15 seconds)
28. SNAPSHOT result page
29. Verify success message
30. Take post-submission screenshot
```

---

## CAPTCHA Handling

SmartRecruiters sometimes uses CAPTCHA (varies by company configuration):

- **reCAPTCHA:** Similar to Greenhouse handling
- **hCaptcha:** Less common but possible

Detection:
```css
iframe[src*="recaptcha"]
iframe[src*="hcaptcha"]
div.g-recaptcha
div.h-captcha
```

If detected, pause and alert user.

---

## Known Quirks and Workarounds

### 1. One-Click Apply vs. Standard Apply
The one-click apply URL (`/oneclick-ui/...`) provides a cleaner, more consistent form. The standard apply flow may show a maintenance page or redirect unexpectedly. Always try one-click first.

### 2. Email Confirmation Anti-Paste
Some SmartRecruiters instances detect clipboard paste events on the email confirmation field. Use `page.fill()` (which simulates typing) rather than `page.evaluate()` to set the value.

### 3. Multi-Page Form State
If the form has multiple pages, state is preserved server-side. You can safely navigate between pages without losing data. However, refreshing the page will lose all data.

### 4. Location Field Variants
The location field may be a simple text input, an autocomplete combobox, or a combination of Country + City dropdowns. SNAPSHOT first to determine the type.

### 5. File Upload Size Limits
SmartRecruiters typically limits uploads to 5MB. Ensure resume PDFs are compressed.

### 6. Duplicate Application Detection
SmartRecruiters may detect duplicate applications by email. Behavior varies:
- Some companies block reapplication entirely
- Some allow reapplication after a cooling period (30-90 days)
- Some allow multiple applications to different positions

### 7. "Apply with LinkedIn" Button
Many SmartRecruiters forms show an "Apply with LinkedIn" button that auto-fills profile data. This requires OAuth authentication and is generally not suitable for automation. Use the standard form fields instead.

### 8. Mobile-Responsive Form
SmartRecruiters forms are responsive. At narrow viewport widths, the layout changes significantly. Use a standard desktop viewport (1280x720 or wider) for automation.
