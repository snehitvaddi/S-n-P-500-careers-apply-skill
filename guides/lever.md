# Lever ATS — Agent Navigation Guide

## Overview

| Field           | Value                                               |
|-----------------|-----------------------------------------------------|
| Platform        | Lever                                               |
| Difficulty      | Easy                                                |
| Form Type       | Single page                                         |
| Account Required| No                                                  |
| API Available   | No public API                                       |
| CAPTCHA         | None (most companies)                               |
| Prevalence      | Declining — many companies migrating to Greenhouse   |

Lever is the simplest ATS to automate. It uses a single-page form with standard HTML inputs, no comboboxes, and rarely has CAPTCHA. However, many companies are migrating away from Lever, so some job board URLs may return 404.

---

## URLs

| URL Type        | Pattern                                              |
|-----------------|------------------------------------------------------|
| Job listing     | `https://jobs.lever.co/{company}`                    |
| Job detail      | `https://jobs.lever.co/{company}/{job_id}`           |
| Application form| `https://jobs.lever.co/{company}/{job_id}/apply`     |

> **Note:** Some companies use custom domains that redirect to Lever (e.g., `careers.example.com/jobs/123` redirecting to `jobs.lever.co/example/123`).

---

## Application Form Structure

Lever uses a **single-page form** with no pagination. All fields are visible at once.

| Field               | Type          | Required | Selector Pattern                          |
|---------------------|---------------|----------|-------------------------------------------|
| Full Name           | text input    | Yes      | `input[name="name"]`                      |
| Email               | email input   | Yes      | `input[name="email"]`                     |
| Phone               | tel input     | Sometimes| `input[name="phone"]`                     |
| Current Company     | text input    | No       | `input[name="org"]`                       |
| Current Title       | text input    | No       | `input[name="current_title"]`             |
| LinkedIn URL        | text input    | No       | `input[name="urls[LinkedIn]"]`            |
| GitHub URL          | text input    | No       | `input[name="urls[GitHub]"]`              |
| Portfolio URL       | text input    | No       | `input[name="urls[Portfolio]"]`           |
| Other URL           | text input    | No       | `input[name="urls[Other]"]`              |
| Resume/CV           | file input    | Yes      | `input[type="file"][name="resume"]`       |
| Cover Letter        | textarea      | No       | `textarea[name="comments"]`              |
| Additional Info     | textarea      | No       | `textarea[name="additional"]`            |
| Work Authorization  | radio buttons | Sometimes| `input[type="radio"][name*="cards"]`      |
| How Did You Hear?   | text/select   | Sometimes| `input[name*="cards"]`, `select[name*="cards"]` |

### Key Differences from Greenhouse

- **Full Name is ONE field** — not separate first/last name fields
- **Work authorization uses radio buttons** — not dropdowns
- **No EEO section** on the main application page
- **No comboboxes** — all dropdowns are native `<select>` elements or radio buttons

---

## Selector Patterns

### Core Fields
```css
input[name="name"]             /* Full Name */
input[name="email"]            /* Email */
input[name="phone"]            /* Phone */
input[name="org"]              /* Current Company */
input[name="current_title"]    /* Current Title */
```

### URL Fields
```css
input[name="urls[LinkedIn]"]
input[name="urls[GitHub]"]
input[name="urls[Portfolio]"]
input[name="urls[Other]"]
```

### File Upload
```css
input[type="file"][name="resume"]
input[type="file"]
```

### Custom Questions (Cards)
```css
/* Radio buttons for yes/no questions */
input[type="radio"][name*="cards"]

/* Text inputs for open-ended questions */
input[type="text"][name*="cards"]
textarea[name*="cards"]

/* Select dropdowns */
select[name*="cards"]
```

### Submit Button
```css
button[type="submit"]
button.postings-btn
button:has-text("Submit application")
```

---

## File Upload Method

Lever uses a straightforward file input for resume upload.

### Playwright
```typescript
await page.setInputFiles('input[type="file"][name="resume"]', '/path/to/resume.pdf');
```

### OpenClaw
```
browser upload /path/to/resume.pdf --ref <file_input_ref>
```

### Verification
After upload, the file name appears next to the input. Look for:
```css
.resume-upload-filename
span:has-text(".pdf")
```

---

## Step-by-Step Application Procedure

### PHASE 1: OPEN

```
1. Navigate to: https://jobs.lever.co/{company}/{job_id}/apply
2. Wait for form to load:
   - Wait for selector: input[name="name"]
   - Timeout: 10 seconds
3. SNAPSHOT the page to identify all fields
```

### PHASE 2: FILL TEXT FIELDS

```
4. Fill Full Name:
   - Selector: input[name="name"]
   - Value: "First Last" (combined, e.g., "Snehit Vaddi")

5. Fill Email:
   - Selector: input[name="email"]

6. Fill Phone (if present):
   - Selector: input[name="phone"]

7. Fill Current Company (if present):
   - Selector: input[name="org"]

8. Fill LinkedIn URL (if present):
   - Selector: input[name="urls[LinkedIn]"]

9. Fill GitHub URL (if present):
   - Selector: input[name="urls[GitHub]"]
```

### PHASE 3: UPLOAD RESUME

```
10. Upload resume:
    - Selector: input[type="file"][name="resume"]
    - File: /path/to/resume.pdf

11. Verify file name appears
```

### PHASE 4: CUSTOM QUESTIONS

```
12. For radio button questions (e.g., work authorization):
    - SNAPSHOT to see the question text and options
    - Click the appropriate radio button

13. For dropdown questions:
    - Select the appropriate option from the <select> element

14. For text questions:
    - Type the answer into the input or textarea
```

### PHASE 5: SUBMIT

```
15. SNAPSHOT and verify all required fields are filled
16. Take pre-submission screenshot
17. Click submit:
    - Selector: button[type="submit"]
18. Wait for confirmation (timeout: 10 seconds)
19. SNAPSHOT the result
20. Verify confirmation message: "Application submitted!" or similar
21. Take post-submission screenshot
```

---

## CAPTCHA Handling

Lever **typically does not use CAPTCHA**. However, some companies may add custom CAPTCHA solutions. If a CAPTCHA is detected:

1. SNAPSHOT the page to identify the CAPTCHA type.
2. Pause and alert the user.
3. Wait for manual CAPTCHA resolution.
4. Resume automation.

---

## Known Quirks and Workarounds

### 1. Companies Migrating Away from Lever
Many companies have migrated from Lever to Greenhouse or Workday. If a `jobs.lever.co` URL returns 404:
- The company may have changed ATS platforms.
- Check the company's careers page directly to find their new ATS.

### 2. Full Name Parsing
Lever expects a single "Full Name" field. When populating from separate first/last name data:
```
name = `${firstName} ${lastName}`
```

### 3. Custom Cards
Lever uses a "cards" system for custom questions. Each card has a unique ID. The selector pattern is:
```css
[name*="cards[{card_id}]"]
```
Card IDs are dynamic and vary by job posting. Always SNAPSHOT first to discover them.

### 4. Radio Button Groups
Work authorization and similar yes/no questions use radio buttons. To select:
```typescript
// Find the radio button with the desired value text
await page.click('text=Yes');  // or the label text
```

### 5. No Draft Saving
Like Greenhouse, Lever does not save form drafts. Complete the form in one session.

### 6. Duplicate Detection
Lever tracks applications by email. Submitting the same email to the same job will typically be silently accepted but flagged internally.

### 7. Cover Letter Field
The cover letter field (`textarea[name="comments"]`) supports plain text only, not file upload. Some companies may have a separate file upload for cover letters.

### 8. Apply Page vs. Job Page
The `/apply` suffix is required to reach the application form. Without it, you'll see the job description page:
- `jobs.lever.co/{company}/{job_id}` — job description (no form)
- `jobs.lever.co/{company}/{job_id}/apply` — application form
