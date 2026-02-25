import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(__filename, "..");
const ROOT = join(__dirname, "..");

// ── JSON Schema Validator (lightweight, no external deps) ────────────────────

interface JsonSchema {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  items?: JsonSchema;
  enum?: (string | number | boolean)[];
  format?: string;
  additionalProperties?: boolean;
  [key: string]: unknown;
}

interface ValidationError {
  path: string;
  message: string;
}

function validateValue(
  value: unknown,
  schema: JsonSchema,
  path: string,
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Type check
  if (schema.type) {
    const actualType = Array.isArray(value) ? "array" : typeof value;
    if (schema.type === "integer") {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        errors.push({ path, message: `Expected integer, got ${actualType}` });
      }
    } else if (schema.type === "array") {
      if (!Array.isArray(value)) {
        errors.push({ path, message: `Expected array, got ${actualType}` });
        return errors;
      }
    } else if (schema.type === "object") {
      if (typeof value !== "object" || value === null || Array.isArray(value)) {
        errors.push({ path, message: `Expected object, got ${actualType}` });
        return errors;
      }
    } else if (actualType !== schema.type) {
      errors.push({ path, message: `Expected ${schema.type}, got ${actualType}` });
      return errors;
    }
  }

  // Enum check
  if (schema.enum && !schema.enum.includes(value as string | number | boolean)) {
    errors.push({
      path,
      message: `Value "${value}" not in enum [${schema.enum.join(", ")}]`,
    });
  }

  // Format check (basic URI validation)
  if (schema.format === "uri" && typeof value === "string" && value !== "") {
    try {
      new URL(value);
    } catch {
      errors.push({ path, message: `Invalid URI: "${value}"` });
    }
  }

  // Object validation
  if (schema.type === "object" && typeof value === "object" && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;

    // Required fields
    if (schema.required) {
      for (const field of schema.required) {
        if (!(field in obj)) {
          errors.push({ path: `${path}.${field}`, message: `Required field missing` });
        }
      }
    }

    // Property validation
    if (schema.properties) {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in obj) {
          errors.push(...validateValue(obj[key], propSchema, `${path}.${key}`));
        }
      }
    }

    // Additional properties check
    if (schema.additionalProperties === false && schema.properties) {
      const allowed = new Set(Object.keys(schema.properties));
      for (const key of Object.keys(obj)) {
        if (!allowed.has(key)) {
          errors.push({
            path: `${path}.${key}`,
            message: `Additional property not allowed`,
          });
        }
      }
    }
  }

  // Array validation
  if (Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i++) {
      errors.push(...validateValue(value[i], schema.items, `${path}[${i}]`));
    }
  }

  return errors;
}

// ── Core Logic ───────────────────────────────────────────────────────────────

export interface PlaybookValidationResult {
  file: string;
  ticker: string;
  valid: boolean;
  errors: ValidationError[];
}

export async function validatePlaybooks(): Promise<PlaybookValidationResult[]> {
  const schemaPath = join(ROOT, "playbooks", "_schema.json");
  const tickerDir = join(ROOT, "playbooks", "by-ticker");

  // Load schema
  let schema: JsonSchema;
  try {
    const raw = await readFile(schemaPath, "utf-8");
    schema = JSON.parse(raw);
  } catch (err) {
    console.error(`[validate] Could not read playbooks/_schema.json: ${err}`);
    process.exit(1);
  }

  // Read playbook files
  let files: string[];
  try {
    files = await readdir(tickerDir);
  } catch {
    console.log("[validate] No playbooks/by-ticker/ directory found. Nothing to validate.");
    return [];
  }

  const jsonFiles = files.filter((f) => f.endsWith(".json"));
  if (jsonFiles.length === 0) {
    console.log("[validate] No playbook files found.");
    return [];
  }

  const results: PlaybookValidationResult[] = [];

  for (const file of jsonFiles) {
    const filePath = join(tickerDir, file);
    const ticker = file.replace(".json", "");

    try {
      const raw = await readFile(filePath, "utf-8");
      const playbook = JSON.parse(raw);
      const errors = validateValue(playbook, schema, "$");

      results.push({
        file,
        ticker,
        valid: errors.length === 0,
        errors,
      });
    } catch (err) {
      results.push({
        file,
        ticker,
        valid: false,
        errors: [{ path: "$", message: `Parse error: ${err}` }],
      });
    }
  }

  return results;
}

// ── CLI Output ───────────────────────────────────────────────────────────────

function printResults(results: PlaybookValidationResult[]) {
  const valid = results.filter((r) => r.valid);
  const invalid = results.filter((r) => !r.valid);

  console.log("\n--- Playbook Validation ---\n");

  if (invalid.length > 0) {
    console.log(`INVALID (${invalid.length}):\n`);
    for (const r of invalid) {
      console.log(`  ${r.file}:`);
      for (const err of r.errors) {
        console.log(`    ${err.path}: ${err.message}`);
      }
      console.log();
    }
  }

  if (valid.length > 0) {
    console.log(`VALID (${valid.length}): ${valid.map((r) => r.ticker).join(", ")}`);
  }

  console.log(`\nTotal: ${results.length} | Valid: ${valid.length} | Invalid: ${invalid.length}`);
}

// ── CLI Entry Point ──────────────────────────────────────────────────────────

async function main() {
  const results = await validatePlaybooks();
  printResults(results);

  const invalid = results.filter((r) => !r.valid);
  if (invalid.length > 0) {
    process.exit(1);
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url).includes(process.argv[1]);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
