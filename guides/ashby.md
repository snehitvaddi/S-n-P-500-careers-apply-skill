# Ashby ATS — Agent Navigation Guide

## Overview

| Field           | Value                                               |
|-----------------|-----------------------------------------------------|
| Platform        | Ashby                                               |
| Difficulty      | Easy                                                |
| Form Type       | Single page                                         |
| Account Required| No                                                  |
| API Available   | No public API for job listings                      |
| CAPTCHA         | Rare                                                |
| Prevalence      | Growing — popular with startups and mid-stage cos    |

Ashby is a modern ATS with clean React-based forms. It is similar to Lever in simplicity but uses a slightly different form structure. Ashby forms are generally well-structured and easy to automate.

---

## URLs

| URL Type        | Pattern                                               |
|-----------------|-------------------------------------------------------|
| Job board       | `https://jobs.ashbyhq.com/{company}`                  |
| Job detail      | `https://jobs.ashbyhq.com/{company}/{job_id}`         |
| Application form| `https://jobs.ashbyhq.com/{company}/{job_id}/application` |

Some companies use custom domains that embed Ashby forms. The underlying form structure remains the same.

---

## Application Form Structure

Ashby uses a **single-page form** with all fields visible at once.

| Field               | Type          | Required | Selector Pattern                                   |
|---------------------|---------------|----------|-----------------------------------------------------|
| First Name          | text input    | Yes      | `input[name="firstName"]`, `input#_systemfield_name` |
| Last Name           | text input    | Yes      | `input[name="lastName"]`                             |
| Email               | email input   | Yes      | `input[name="email"]`, `input#_systemfield_email`    |
| Phone               | tel input     | Sometimes| `input[name="phone"]`, `input#_systemfield_phone`    |
| Resume/CV           | file input    | Yes      | `input#_systemfield_resume`, `input[type="file"]`    |
| LinkedIn            | text input    | No       | `input[name*="linkedin"]`                            |
| Location            | combobox      | Sometimes| Combobox with autocomplete                           |
| Current Company     | text input    | No       | `input[name*="company"]`                             |
| Custom Questions    | varies        | Varies   | Dynamic per company                                  |

---

## Selector Patterns

### System Fields
```css
/* These use the _systemfield_ prefix and are consistent across companies */
input#_systemfield_name          /* Name (sometimes combined) */
input#_systemfield_email         /* Email */
input#_systemfield_phone         /* Phone */
input#_systemfield_resume        /* Resume file input */
input#_systemfield_location      /* Location */
```

### Standard Name Fields
```css
input[name="firstName"]
input[name="lastName"]
input[name="email"]
input[name="phone"]
```

### Custom Question Fields
```css
/* Custom questions have dynamic IDs */
input[name*="customField"]
select[name*="customField"]
textarea[name*="customField"]
```

### Submit Button
```css
button[type="submit"]
button:has-text("Submit Application")
button:has-text("Submit")
```

---

## File Upload Method

### Resume Upload

Ashby uses a standard file input, sometimes hidden behind a styled button.

```css
input#_systemfield_resume
input[type="file"]
```

### Playwright
```typescript
await page.setInputFiles('#_systemfield_resume', '/path/to/resume.pdf');
```

### OpenClaw
```
browser upload /path/to/resume.pdf --ref <upload_button_ref>
```

### Verification
After upload, the filename appears near the upload area. Look for:
```css
span:has-text(".pdf")
.file-name
[data-testid="uploaded-file"]
```

---

## Location Combobox

Ashby's location field is a combobox that requires a specific interaction pattern:

```
1. Click the location input field
2. Type the city/location name
3. Wait for autocomplete suggestions to appear
4. Press ENTER to commit the first suggestion
   OR click the desired suggestion from the list
```

> **CRITICAL:** You must press **Enter** or click a suggestion to commit the location selection. Simply typing the location text is NOT sufficient — the value will not be saved.

---

## Step-by-Step Application Procedure

### PHASE 1: OPEN

```
1. Navigate to: https://jobs.ashbyhq.com/{company}/{job_id}/application
2. Wait for form to load:
   - Wait for selector: input#_systemfield_name OR input[name="firstName"]
   - Timeout: 10 seconds
3. SNAPSHOT the page to identify all fields
```

### PHASE 2: TEXT FIELDS

```
4. Fill First Name:
   - Selector: input[name="firstName"] or input#_systemfield_name
   - Action: clear, then type

5. Fill Last Name:
   - Selector: input[name="lastName"]

6. Fill Email:
   - Selector: input[name="email"] or input#_systemfield_email

7. Fill Phone (if present):
   - Selector: input[name="phone"] or input#_systemfield_phone

8. Fill LinkedIn (if present):
   - Selector: input[name*="linkedin"]
```

### PHASE 3: RESUME UPLOAD

```
9. Upload Resume:
   - Selector: input#_systemfield_resume
   - File: /path/to/resume.pdf

10. Verify file name appears
```

### PHASE 4: LOCATION (if present)

```
11. Click the location input
12. Type the city name
13. Wait for suggestions
14. Press Enter to commit the selection
15. Verify the location value is saved
```

### PHASE 5: CUSTOM QUESTIONS

```
16. SNAPSHOT to identify all custom questions
17. For each custom question:
    - Dropdowns: select the appropriate option
    - Text fields: type the answer
    - Radio buttons: click the appropriate option
    - Checkboxes: check/uncheck as needed
```

### PHASE 6: VALIDATE & SUBMIT

```
18. SNAPSHOT the form to verify all required fields are filled
19. Take pre-submission screenshot
20. Click Submit:
    - Selector: button[type="submit"]
21. Wait for response (timeout: 10 seconds)
22. SNAPSHOT the result
23. Check for:
    - Success: confirmation message
    - Error: alert at the top of the page listing missing fields
24. Take post-submission screenshot
```

---

## Error Handling

### Submit Failure Alert

If the form submission fails, Ashby displays an **alert at the top of the page** listing the fields that need attention. This is a key differentiator from other ATS platforms:

```
1. After clicking Submit, SNAPSHOT the page
2. Look for alert/error elements at the top:
   - [role="alert"]
   - .alert
   - div:has-text("Please fill")
3. Read the error message to identify missing fields
4. Fill the missing fields
5. Re-submit
```

---

## Known Quirks and Workarounds

### 1. Location Combobox Enter-to-Commit
The location field MUST be committed with Enter or by clicking a suggestion. This is the most common failure point for Ashby automation.

### 2. React Hydration Delay
Ashby forms are React-based and may have a brief hydration delay after initial page load. Wait 1-2 seconds after the page appears loaded before interacting with form fields.

### 3. Combined vs. Separate Name Fields
Some companies configure Ashby with a single "Full Name" field (`_systemfield_name`), while others use separate first/last name fields. Always SNAPSHOT first to determine the configuration.

### 4. Custom Domain Embedding
Some companies embed Ashby forms in an iframe on their own domain. If the form is in an iframe:
```typescript
const frame = page.frameLocator('iframe[src*="ashbyhq"]');
await frame.locator('input[name="firstName"]').fill('...');
```

### 5. No Duplicate Protection
Unlike some ATS platforms, Ashby may accept multiple applications from the same email to the same job. This means agents should track which jobs have been applied to externally.

### 6. File Size Limits
Ashby typically limits file uploads to 10MB. Ensure resume PDFs are under this limit.
