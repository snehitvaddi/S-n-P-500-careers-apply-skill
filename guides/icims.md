# iCIMS ATS — Agent Navigation Guide

## Overview

| Field           | Value                                                  |
|-----------------|--------------------------------------------------------|
| Platform        | iCIMS                                                  |
| Difficulty      | Hard                                                   |
| Form Type       | Multi-step, iframe-heavy                               |
| Account Required| Often yes                                              |
| API Available   | No public API                                          |
| CAPTCHA         | Sometimes                                              |
| Prevalence      | Common among large enterprises and healthcare          |

iCIMS is an enterprise ATS known for its iframe-heavy architecture and inconsistent UI across different company implementations. The forms frequently embed content in nested iframes, requiring context switching during automation. Field IDs are dynamic, making reliable selector patterns more challenging.

---

## URLs

| URL Type        | Pattern                                                |
|-----------------|--------------------------------------------------------|
| Career site     | `https://careers-{company}.icims.com/`                 |
| Job search      | `https://careers-{company}.icims.com/jobs/search`      |
| Job detail      | `https://careers-{company}.icims.com/jobs/{job_id}/job` |
| Application     | `https://careers-{company}.icims.com/jobs/{job_id}/login` |

> **Note:** URL patterns vary significantly. Some companies use custom domains that proxy to iCIMS.

---

## Architecture: Iframe-Heavy

**CRITICAL:** iCIMS embeds application forms inside one or more `<iframe>` elements. Automation agents must switch context into the iframe before interacting with form fields.

### Iframe Detection
```css
iframe[src*="icims.com"]
iframe#icims_content_iframe
iframe.icims-embed
```

### Context Switching (Playwright)
```typescript
// Find the iframe
const frameLocator = page.frameLocator('iframe#icims_content_iframe');

// Interact with elements inside the iframe
await frameLocator.locator('input[name="firstName"]').fill('...');
```

### Nested Iframes
Some iCIMS implementations have **nested iframes** (iframe within iframe):
```typescript
const outerFrame = page.frameLocator('iframe#outer');
const innerFrame = outerFrame.frameLocator('iframe#inner');
await innerFrame.locator('input[name="firstName"]').fill('...');
```

---

## Selector Strategy

### Dynamic Field IDs

iCIMS field IDs are **dynamic** and change between page loads. Do NOT rely on specific IDs like `input#field-12345`. Instead, use:

1. **Label-based selection** (most reliable):
```css
label:has-text("First Name") + input
label:has-text("Email") + input
```

2. **Name attributes** (when available):
```css
input[name="firstName"]
input[name="lastName"]
input[name="email"]
input[name="phone"]
```

3. **Aria labels**:
```css
input[aria-label="First Name"]
input[aria-label="Email Address"]
```

4. **Data attributes** (varies by implementation):
```css
[data-field="firstName"]
[data-field-name="email"]
```

---

## Application Form Structure

### Account Creation / Login

Many iCIMS implementations require account creation before applying:

```
1. Navigate to the job's /login page
2. IF account exists:
   - Enter email and password
   - Click "Sign In"
3. IF new account:
   - Click "Create Account" or "New User"
   - Enter email, password, confirm password
   - May require email verification
   - After verification, proceed to application
```

### Form Fields (typical)

| Field               | Type          | Required | Notes                                      |
|---------------------|---------------|----------|--------------------------------------------|
| First Name          | text input    | Yes      | Inside iframe                              |
| Last Name           | text input    | Yes      | Inside iframe                              |
| Email               | email input   | Yes      | Often pre-filled from account              |
| Phone               | tel input     | Sometimes| May have country code dropdown             |
| Address             | text input    | Sometimes| Street address                             |
| City                | text input    | Sometimes|                                            |
| State               | dropdown      | Sometimes| Appears after country selection            |
| Zip Code            | text input    | Sometimes|                                            |
| Resume              | file upload   | Yes      | Inside iframe                              |
| Cover Letter        | file/textarea | No       |                                            |
| Work Authorization  | dropdown/radio| Sometimes|                                            |
| Sponsorship Need    | dropdown/radio| Sometimes|                                            |
| EEO fields          | dropdowns     | No       |                                            |

---

## File Upload

### Inside Iframe
```typescript
const frame = page.frameLocator('iframe#icims_content_iframe');
const fileInput = frame.locator('input[type="file"]');
await fileInput.setInputFiles('/path/to/resume.pdf');
```

### Upload Button Variants
```css
/* Different implementations use different upload patterns */
input[type="file"]
button:has-text("Upload Resume")
button:has-text("Choose File")
a:has-text("Attach")
```

---

## Step-by-Step Application Procedure

### PHASE 1: NAVIGATE & DETECT IFRAME

```
1. Navigate to application URL
2. Wait for page to load (timeout: 15 seconds)
3. SNAPSHOT the page
4. Detect iframe:
   - Look for iframe[src*="icims"] or iframe#icims_content_iframe
   - If iframe found, switch context into it
   - If nested iframe, switch into innermost iframe
5. SNAPSHOT inside iframe to identify form fields
```

### PHASE 2: ACCOUNT (if required)

```
6. If login/account creation form is shown:
   a. Check if account exists (try login first)
   b. If not, create account with email + password
   c. Handle email verification if triggered
   d. After login, navigate to application form
```

### PHASE 3: FILL FORM FIELDS

```
7. Inside the correct iframe context:
   - Fill First Name
   - Fill Last Name
   - Fill Email (may be pre-filled)
   - Fill Phone
   - Fill Address fields (if required)
```

### PHASE 4: RESUME UPLOAD

```
8. Inside iframe, locate file upload:
   - input[type="file"] or upload button
9. Upload resume file
10. Verify upload (file name appears)
```

### PHASE 5: SCREENING QUESTIONS

```
11. SNAPSHOT to identify any screening questions
12. Fill dropdowns and text fields as needed
13. Work authorization and sponsorship questions
```

### PHASE 6: EEO (if present)

```
14. Default all to "Decline to self-identify"
```

### PHASE 7: SUBMIT

```
15. SNAPSHOT and verify all fields
16. Take pre-submission screenshot
17. Click Submit (inside iframe context)
18. Wait for confirmation
19. SNAPSHOT result
20. Take post-submission screenshot
```

---

## Known Quirks and Workarounds

### 1. Iframe Context Loss
After page navigation (e.g., going to next step), the iframe context may need to be re-acquired:
```typescript
// After navigation, re-locate the iframe
const frame = page.frameLocator('iframe#icims_content_iframe');
```

### 2. Inconsistent Implementations
iCIMS gives companies significant customization options. Two companies using iCIMS may have completely different:
- Form layouts
- Required fields
- Iframe nesting depth
- Selector patterns

Always SNAPSHOT first and adapt.

### 3. Pop-up Blockers
Some iCIMS implementations open the application form in a popup window. Ensure the browser allows popups from the domain.

### 4. Slow Form Rendering
iCIMS forms render slowly, especially inside iframes. Use generous timeouts (15-30 seconds) and wait for specific elements rather than using fixed delays.

### 5. Required Field Indicators
iCIMS uses various indicators for required fields:
```css
.required
span:has-text("*")
[aria-required="true"]
```

### 6. Form Validation Messages
Validation errors appear inline next to fields. After submission failure:
```css
.error-message
.validation-error
span.field-error
[role="alert"]
```

### 7. Session Management
iCIMS sessions are tied to cookies. If cookies are cleared between steps, the session will be lost and the application will need to restart.

### 8. Mobile User Agent Issues
Some iCIMS implementations serve different (often broken) forms to mobile user agents. Always use a desktop user agent string.
