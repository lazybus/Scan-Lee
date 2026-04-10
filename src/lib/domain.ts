import { z } from "zod";

export const fieldKindValues = [
  "text",
  "number",
  "date",
  "currency",
  "boolean",
] as const;

export const extractionStatusValues = [
  "uploaded",
  "processing",
  "extracted",
  "reviewed",
  "completed",
  "failed",
] as const;

export const fieldDefinitionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only."),
  label: z.string().trim().min(1),
  kind: z.enum(fieldKindValues),
  required: z.boolean().default(false),
  aliases: z.array(z.string().trim().min(1)).default([]),
  description: z.string().trim().default(""),
});

export const documentTypeInputSchema = z.object({
  name: z.string().trim().min(2),
  slug: z
    .string()
    .trim()
    .min(2)
    .regex(/^[a-z0-9-]+$/, "Slug must contain lowercase letters, numbers, and hyphens only."),
  description: z.string().trim().min(8),
  promptTemplate: z.string().trim().min(32),
  fields: z.array(fieldDefinitionSchema).min(1),
});

export const documentTypeSchema = documentTypeInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const extractedValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const extractedRecordSchema = z.record(z.string(), extractedValueSchema);

export const documentRecordSchema = z.object({
  id: z.string(),
  documentTypeId: z.string(),
  documentTypeName: z.string(),
  originalName: z.string(),
  mimeType: z.string(),
  filePath: z.string(),
  sha256: z.string(),
  status: z.enum(extractionStatusValues),
  modelName: z.string().nullable(),
  extractedData: extractedRecordSchema.nullable(),
  reviewedData: extractedRecordSchema.nullable(),
  rawResponse: z.string().nullable(),
  errorMessage: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type FieldDefinition = z.infer<typeof fieldDefinitionSchema>;
export type DocumentTypeInput = z.infer<typeof documentTypeInputSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type ExtractedRecord = z.infer<typeof extractedRecordSchema>;
export type ExtractionStatus = (typeof extractionStatusValues)[number];
export type DocumentRecord = z.infer<typeof documentRecordSchema>;

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function normalizeFieldKey(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_]+/g, "_");
}

export function normalizeExtractedData(
  fields: FieldDefinition[],
  payload: Record<string, unknown>,
): ExtractedRecord {
  const normalizedEntries = fields.map((field) => {
    const rawValue = payload[field.key];
    let normalizedValue: string | number | boolean | null = null;

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return [field.key, null] as const;
    }

    switch (field.kind) {
      case "number":
      case "currency": {
        const numberValue =
          typeof rawValue === "number"
            ? rawValue
            : Number.parseFloat(String(rawValue).replace(/[^0-9.-]/g, ""));

        normalizedValue = Number.isFinite(numberValue)
          ? Number.parseFloat(numberValue.toFixed(2))
          : null;
        break;
      }
      case "boolean": {
        if (typeof rawValue === "boolean") {
          normalizedValue = rawValue;
          break;
        }

        const lowered = String(rawValue).trim().toLowerCase();
        if (["true", "yes", "y", "1", "checked"].includes(lowered)) {
          normalizedValue = true;
        } else if (["false", "no", "n", "0", "unchecked"].includes(lowered)) {
          normalizedValue = false;
        } else {
          normalizedValue = null;
        }
        break;
      }
      case "date":
      case "text":
      default:
        normalizedValue = String(rawValue).trim();
        break;
    }

    return [field.key, normalizedValue] as const;
  });

  return Object.fromEntries(normalizedEntries);
}

export function getMissingRequiredFields(
  fields: FieldDefinition[],
  record: ExtractedRecord,
): string[] {
  return fields
    .filter((field) => field.required)
    .filter((field) => record[field.key] === null || record[field.key] === "")
    .map((field) => field.key);
}

export function buildFieldPromptSnippet(fields: FieldDefinition[]): string {
  return fields
    .map((field) => {
      const aliases = field.aliases.length > 0 ? ` aliases: ${field.aliases.join(", ")}.` : "";
      const detail = field.description ? ` ${field.description}` : "";

      return `- ${field.key}: ${field.label} (${field.kind}). Required: ${field.required}.${aliases}${detail}`;
    })
    .join("\n");
}