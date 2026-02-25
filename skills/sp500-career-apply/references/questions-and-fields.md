# Questions and Fields Playbook

## Goal

Fill application forms deterministically while minimizing wrong answers on screening questions.

## Field Fill Order

1. Identity: first name, last name
2. Contact: email, phone, city/state/country
3. Links: LinkedIn, portfolio, GitHub
4. Resume/CV upload
5. Work authorization and sponsorship
6. Compensation and start date
7. Voluntary disclosures (if required)

## Screening Question Categories

- Work authorization:
  - "Are you authorized to work in <country>?"
- Sponsorship:
  - "Do you now or in the future require visa sponsorship?"
- Relocation / location:
  - "Are you willing to relocate?" / "Preferred location"
- Compensation:
  - "Expected salary" / "Compensation expectations"
- Experience:
  - "Years of experience with X" / "Have you used Y technology?"
- Notice period:
  - "When can you start?" / "Current notice period"

## Deterministic Answering Rules

1. Map each question to one category before answering.
2. Use user profile source-of-truth values only.
3. If category cannot be inferred with confidence, stop and request human confirmation.
4. Preserve original wording in logs for auditability.

## Required Field Handling

1. Check `required=true` when available in `application_profile.form_fields`.
2. Re-check required markers in live DOM because requirements can change per job posting.
3. Fail fast with a structured error if any required field is unmapped.

## Safe Defaults

- Prefer explicit values over inferred values.
- Prefer skip + ask over guessing when the prompt is legal/compliance related.
- Never submit if required legal/work-authorization answers are ambiguous.
