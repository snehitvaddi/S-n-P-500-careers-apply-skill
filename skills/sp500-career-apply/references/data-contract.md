# LLM Careers Dataset Contract

## File

- `data/llm-careers-dataset.json`

## Top-Level

- `generated_at` (ISO timestamp)
- `total_companies` (number)
- `schema_version` (string)
- `fields` (flat list of exported field paths)
- `companies` (array of records)

## Company Record

- `ticker`
- `company`
- `sector`
- `sub_industry`
- `hq`
- `careers_url`
- `careers_url_final`
- `ats`
- `ats_source` (`crawl` | `seed`)

### `application_profile`

- `requires_account` (boolean)
- `search_filters` (string[])
- `apply_links` (`{ text, url }[]`)
- `form_fields` (`{ label, type, required, selector?, options? }[]`)

### `crawl`

- `status`
- `last_crawled_at`
- `redirect_detected`
- `error` (optional)

## Usage Guidance

- Route apply flow by `ats` first.
- Start navigation from `careers_url_final`.
- Use `apply_links` when present; otherwise query jobs from landing page search.
- Use `form_fields` as seed selectors, then re-read live DOM on final apply step.
- For `ats=unknown`, use custom fallback heuristics.
