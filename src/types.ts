import { z } from "zod";

// ── ATS Platform Types ──────────────────────────────────────────────────────

export const ATSPlatformId = z.enum([
  "greenhouse",
  "lever",
  "workday",
  "ashby",
  "smartrecruiters",
  "icims",
  "taleo",
  "successfactors",
  "custom",
]);
export type ATSPlatformId = z.infer<typeof ATSPlatformId>;

export const DifficultyRating = z.enum(["easy", "moderate", "hard"]);
export type DifficultyRating = z.infer<typeof DifficultyRating>;

export const ATSPlatform = z.object({
  id: ATSPlatformId,
  name: z.string(),
  url_template: z.string(),
  api_available: z.boolean(),
  api_template: z.string().optional(),
  detection_patterns: z.object({
    url: z.array(z.string()),
    dom: z.array(z.string()).optional(),
  }),
  difficulty: DifficultyRating,
  notes: z.string().optional(),
});
export type ATSPlatform = z.infer<typeof ATSPlatform>;

// ── Company Types ───────────────────────────────────────────────────────────

export const CompanyStatus = z.enum(["active", "inactive", "removed", "pending"]);
export type CompanyStatus = z.infer<typeof CompanyStatus>;

export const Company = z.object({
  ticker: z.string(),
  name: z.string(),
  slug: z.string(),
  hq: z.string(),
  subsector: z.string(),
  careers_url: z.string().url(),
  ats_platform: ATSPlatformId,
  api_endpoint: z.string().optional(),
  h1b_sponsor: z.boolean(),
  added_date: z.string(),
  last_verified: z.string(),
  status: CompanyStatus,
});
export type Company = z.infer<typeof Company>;

// ── Playbook Types ──────────────────────────────────────────────────────────

export const FieldType = z.enum([
  "text",
  "email",
  "tel",
  "url",
  "textarea",
  "select",
  "combobox",
  "radio",
  "checkbox",
  "file",
  "date",
  "autocomplete",
]);
export type FieldType = z.infer<typeof FieldType>;

export const ApplicationStep = z.object({
  step: z.number(),
  action: z.string(),
  selector: z.string().optional(),
  field_type: FieldType.optional(),
  value_key: z.string().optional(),
  notes: z.string().optional(),
  required: z.boolean().optional(),
});
export type ApplicationStep = z.infer<typeof ApplicationStep>;

export const SearchFilter = z.object({
  name: z.string(),
  type: z.enum(["dropdown", "text", "checkbox", "url_param"]),
  selector: z.string().optional(),
  url_param: z.string().optional(),
  options: z.array(z.string()).optional(),
});
export type SearchFilter = z.infer<typeof SearchFilter>;

export const Quirk = z.object({
  id: z.string(),
  description: z.string(),
  workaround: z.string(),
  severity: z.enum(["info", "warning", "blocker"]),
});
export type Quirk = z.infer<typeof Quirk>;

export const Playbook = z.object({
  ticker: z.string(),
  company_name: z.string(),
  ats_platform: ATSPlatformId,
  careers_url: z.string().url(),
  application_url: z.string().optional(),
  api_endpoint: z.string().optional(),
  search_filters: z.array(SearchFilter).optional(),
  application_flow: z.array(ApplicationStep).optional(),
  quirks: z.array(Quirk).optional(),
  verified: z.boolean(),
  last_verified: z.string().optional(),
  notes: z.string().optional(),
});
export type Playbook = z.infer<typeof Playbook>;

// ── Changelog Types ─────────────────────────────────────────────────────────

export const ChangelogEntry = z.object({
  date: z.string(),
  type: z.enum([
    "company_added",
    "company_removed",
    "ats_changed",
    "url_changed",
    "url_broken",
    "url_fixed",
    "verified",
  ]),
  ticker: z.string(),
  details: z.string(),
  old_value: z.string().optional(),
  new_value: z.string().optional(),
});
export type ChangelogEntry = z.infer<typeof ChangelogEntry>;

// ── ATS Index Types ─────────────────────────────────────────────────────────

export const ATSIndex = z.object({
  platform: ATSPlatformId,
  count: z.number(),
  companies: z.array(
    z.object({
      ticker: z.string(),
      name: z.string(),
      slug: z.string(),
      careers_url: z.string(),
      api_endpoint: z.string().optional(),
    })
  ),
  last_updated: z.string(),
});
export type ATSIndex = z.infer<typeof ATSIndex>;

// ── Export Types ─────────────────────────────────────────────────────────────

export const SlugExport = z.object({
  platform: z.string(),
  slugs: z.array(
    z.object({
      slug: z.string(),
      ticker: z.string(),
      name: z.string(),
      api_endpoint: z.string().optional(),
    })
  ),
  generated: z.string(),
});
export type SlugExport = z.infer<typeof SlugExport>;
