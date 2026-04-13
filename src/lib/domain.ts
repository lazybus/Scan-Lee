import { z } from "zod";

export const scalarFieldKindValues = [
  "text",
  "number",
  "date",
  "currency",
  "boolean",
] as const;

export const fieldKindValues = [...scalarFieldKindValues, "table"] as const;

export const extractionStatusValues = [
  "uploaded",
  "processing",
  "extracted",
  "reviewed",
  "completed",
  "failed",
] as const;

const baseFieldDefinitionSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .regex(/^[a-z0-9_]+$/, "Use lowercase letters, numbers, and underscores only."),
  label: z.string().trim().min(1),
  required: z.boolean().default(false),
  aliases: z.array(z.string().trim().min(1)).default([]),
  description: z.string().trim().default(""),
});

export const productColumnDefinitionSchema = baseFieldDefinitionSchema.extend({
  kind: z.enum(scalarFieldKindValues),
});

const scalarFieldDefinitionSchema = baseFieldDefinitionSchema.extend({
  kind: z.enum(scalarFieldKindValues),
});

const tableFieldDefinitionSchema = baseFieldDefinitionSchema
  .extend({
    kind: z.union([z.literal("table"), z.literal("products")]),
    columns: z.array(productColumnDefinitionSchema).min(1, "Add at least one table column."),
  })
  .transform((field) => ({
    ...field,
    kind: "table" as const,
  }));

export const fieldDefinitionSchema = z.union([
  scalarFieldDefinitionSchema,
  tableFieldDefinitionSchema,
]);

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

export type ExtractedValue =
  | string
  | number
  | boolean
  | null
  | ExtractedValue[]
  | { [key: string]: ExtractedValue };

export type ExtractedRecord = Record<string, ExtractedValue>;

export const extractedValueSchema: z.ZodType<ExtractedValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(extractedValueSchema),
    z.record(z.string(), extractedValueSchema),
  ]),
);

export const extractedRecordSchema: z.ZodType<ExtractedRecord> = z.record(
  z.string(),
  extractedValueSchema,
);

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
export type ProductColumnDefinition = z.infer<typeof productColumnDefinitionSchema>;
export type DocumentTypeInput = z.infer<typeof documentTypeInputSchema>;
export type DocumentType = z.infer<typeof documentTypeSchema>;
export type ScalarFieldKind = (typeof scalarFieldKindValues)[number];
export type ExtractionStatus = (typeof extractionStatusValues)[number];
export type DocumentRecord = z.infer<typeof documentRecordSchema>;

export type TableFieldDefinition = Extract<FieldDefinition, { kind: "table" }>;
export type ProductsFieldDefinition = TableFieldDefinition;

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
    let normalizedValue: ExtractedValue = null;

    if (rawValue === undefined || rawValue === null || rawValue === "") {
      return [field.key, null] as const;
    }

    switch (field.kind) {
      case "table":
        normalizedValue = normalizeProductsValue(field.columns, rawValue);
        break;
      case "number":
      case "currency": {
        normalizedValue = normalizeScalarValue(field.kind, rawValue);
        break;
      }
      case "boolean": {
        normalizedValue = normalizeScalarValue(field.kind, rawValue);
        break;
      }
      case "date":
      case "text":
      default:
        normalizedValue = normalizeScalarValue(field.kind, rawValue);
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
    .filter((field) => {
      const value = record[field.key];

      if (field.kind === "table") {
        return !Array.isArray(value) || value.length === 0;
      }

      return value === null || value === "";
    })
    .map((field) => field.key);
}

export function buildFieldPromptSnippet(fields: FieldDefinition[]): string {
  return fields
    .map((field) => {
      const aliases = field.aliases.length > 0 ? ` aliases: ${field.aliases.join(", ")}.` : "";
      const detail = field.description ? ` ${field.description}` : "";

      if (field.kind === "table") {
        const columnSnippet = field.columns
          .map((column) => {
            const columnAliases =
              column.aliases.length > 0 ? ` aliases: ${column.aliases.join(", ")}.` : "";
            const columnDetail = column.description ? ` ${column.description}` : "";

            return `${column.key} (${column.kind}, required: ${column.required})${columnAliases}${columnDetail}`;
          })
          .join("; ");

        return `- ${field.key}: ${field.label} (table). Required: ${field.required}.${aliases}${detail} Each array item must be one table row object with these keys: ${columnSnippet}. Return [] when no rows are present.`;
      }

      return `- ${field.key}: ${field.label} (${field.kind}). Required: ${field.required}.${aliases}${detail}`;
    })
    .join("\n");
}

function normalizeScalarValue(kind: ScalarFieldKind, rawValue: unknown): ExtractedValue {
  switch (kind) {
    case "number":
    case "currency": {
      const numberValue =
        typeof rawValue === "number"
          ? rawValue
          : Number.parseFloat(String(rawValue).replace(/[^0-9.-]/g, ""));

      return Number.isFinite(numberValue)
        ? Number.parseFloat(numberValue.toFixed(2))
        : null;
    }
    case "boolean": {
      if (typeof rawValue === "boolean") {
        return rawValue;
      }

      const lowered = String(rawValue).trim().toLowerCase();
      if (["true", "yes", "y", "1", "checked"].includes(lowered)) {
        return true;
      }

      if (["false", "no", "n", "0", "unchecked"].includes(lowered)) {
        return false;
      }

      return null;
    }
    case "date":
    case "text":
    default:
      return String(rawValue).trim();
  }
}

function normalizeProductsValue(
  columns: ProductColumnDefinition[],
  rawValue: unknown,
): ExtractedValue {
  const productRows = coerceProductRows(rawValue);

  if (!productRows) {
    return null;
  }

  const normalizedRows = productRows
    .map((row) =>
      Object.fromEntries(
        columns.map((column) => [
          column.key,
          normalizeScalarValue(column.kind, row[column.key]),
        ]),
      ),
    )
    .filter((row) => Object.values(row).some((value) => value !== null && value !== ""));

  return normalizedRows;
}

function coerceProductRows(rawValue: unknown): Record<string, unknown>[] | null {
  if (Array.isArray(rawValue)) {
    return rawValue.filter(isRecordLike);
  }

  if (typeof rawValue !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isRecordLike) : null;
  } catch {
    return null;
  }
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}