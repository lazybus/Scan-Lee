import {
  documentTypeAssistantResultSchema,
  documentTypeInputSchema,
  normalizeFieldKey,
  slugify,
  type AssistantProvider,
  type DocumentTypeAssistantMessage,
  type DocumentTypeAssistantResult,
  type FieldDefinition,
  type ProductColumnDefinition,
  type ScalarFieldKind,
} from "@/lib/domain";
import {
  GoogleAiExtractionError,
  generateDocumentTypeDraftWithGoogleAi,
} from "@/lib/google-ai";
import {
  generateDocumentTypeDraftWithOllama,
} from "@/lib/ollama";

type GenerateAssistantDraftInput = {
  conversation: DocumentTypeAssistantMessage[];
  currentDraft?: unknown;
  instruction?: string;
  sampleFilePath?: string | null;
  sampleMimeType?: string | null;
  storageBucket?: string;
};

type NormalizedAssistantDraft = Pick<
  DocumentTypeAssistantResult,
  "analysisSummary" | "draft" | "warnings"
>;

type LooseRecord = Record<string, unknown>;

const scalarKindAliasMap: Record<string, ScalarFieldKind> = {
  amount: "currency",
  checkbox: "boolean",
  count: "number",
  currency: "currency",
  date: "date",
  datetime: "date",
  integer: "number",
  money: "currency",
  number: "number",
  price: "currency",
  string: "text",
  text: "text",
  total: "currency",
  truefalse: "boolean",
  yesno: "boolean",
  boolean: "boolean",
};

const tableKindAliases = new Set([
  "items",
  "line_items",
  "lineitems",
  "products",
  "rows",
  "services",
  "table",
]);

function isRecord(value: unknown): value is LooseRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asTrimmedString).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  return [];
}

function asBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    return ["1", "true", "yes", "required", "checked"].includes(value.trim().toLowerCase());
  }

  return false;
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function uniqueKey(baseKey: string, usedKeys: Set<string>, fallbackPrefix: string): string {
  const normalizedBaseKey =
    normalizeFieldKey(baseKey).replace(/^_+|_+$/g, "") ||
    `${fallbackPrefix}_${usedKeys.size + 1}`;
  let candidate = normalizedBaseKey;
  let suffix = 2;

  while (usedKeys.has(candidate)) {
    candidate = `${normalizedBaseKey}_${suffix}`;
    suffix += 1;
  }

  usedKeys.add(candidate);
  return candidate;
}

function normalizeScalarKind(value: unknown, warnings: string[], contextLabel: string): ScalarFieldKind {
  const normalizedValue = asTrimmedString(value).toLowerCase().replace(/[^a-z]+/g, "");

  if (normalizedValue in scalarKindAliasMap) {
    return scalarKindAliasMap[normalizedValue];
  }

  warnings.push(`${contextLabel} used unsupported kind "${String(value)}" and was converted to text.`);
  return "text";
}

function normalizeFieldKind(value: unknown, warnings: string[], contextLabel: string): FieldDefinition["kind"] {
  const rawKind = asTrimmedString(value).toLowerCase().replace(/[^a-z_]+/g, "_");
  const compactKind = rawKind.replace(/_/g, "");

  if (tableKindAliases.has(rawKind) || tableKindAliases.has(compactKind)) {
    return "table";
  }

  if (compactKind in scalarKindAliasMap) {
    return scalarKindAliasMap[compactKind];
  }

  warnings.push(`${contextLabel} used unsupported kind "${String(value)}" and was converted to text.`);
  return "text";
}

function buildDefaultDescription(name: string): string {
  return `AI-generated schema for ${name} with fields chosen from the provided sample or instructions.`;
}

function buildDefaultPromptTemplate(name: string): string {
  return [
    `Extract this ${name.toLowerCase()} into one JSON object only.`,
    "Use the configured keys exactly.",
    "Return null for any field that is missing or illegible rather than guessing.",
    "For repeating sections such as line items or entries, return one array row object per visible row.",
  ].join(" ");
}

function normalizeColumnDefinition(
  value: unknown,
  index: number,
  warnings: string[],
  usedKeys: Set<string>,
): ProductColumnDefinition {
  const record = isRecord(value) ? value : {};
  const label = asTrimmedString(record.label) || titleCase(asTrimmedString(record.key)) || `Column ${index + 1}`;
  const key = uniqueKey(asTrimmedString(record.key) || label, usedKeys, "column");

  return {
    aliases: asStringArray(record.aliases),
    description: asTrimmedString(record.description),
    key,
    kind: normalizeScalarKind(record.kind, warnings, `Column ${label}`),
    label,
    required: asBoolean(record.required),
  };
}

function normalizeFieldDefinition(
  value: unknown,
  index: number,
  warnings: string[],
  usedKeys: Set<string>,
): FieldDefinition {
  const record = isRecord(value) ? value : {};
  const label = asTrimmedString(record.label) || titleCase(asTrimmedString(record.key)) || `Field ${index + 1}`;
  const key = uniqueKey(asTrimmedString(record.key) || label, usedKeys, "field");
  const kind = normalizeFieldKind(record.kind, warnings, `Field ${label}`);
  const baseDefinition = {
    aliases: asStringArray(record.aliases),
    description: asTrimmedString(record.description),
    key,
    label,
    required: asBoolean(record.required),
  };

  if (kind !== "table") {
    return {
      ...baseDefinition,
      kind,
    };
  }

  const rawColumns = Array.isArray(record.columns) ? record.columns : [];
  const usedColumnKeys = new Set<string>();
  const columns = rawColumns
    .map((column, columnIndex) =>
      normalizeColumnDefinition(column, columnIndex, warnings, usedColumnKeys),
    )
    .filter(Boolean);

  if (columns.length === 0) {
    warnings.push(`${label} was identified as a table but did not include any columns. Added a fallback Value column.`);
    columns.push({
      aliases: [],
      description: "Fallback column added because the AI response omitted table columns.",
      key: uniqueKey("value", usedColumnKeys, "column"),
      kind: "text",
      label: "Value",
      required: false,
    });
  }

  return {
    ...baseDefinition,
    columns,
    kind: "table",
  };
}

function normalizeAssistantDraft(rawDraft: unknown): NormalizedAssistantDraft {
  if (!isRecord(rawDraft)) {
    throw new Error("AI did not return a document type object.");
  }

  const warnings = Array.from(new Set(asStringArray(rawDraft.warnings)));
  const rawFields = Array.isArray(rawDraft.fields)
    ? rawDraft.fields
    : Array.isArray(rawDraft.fieldDefinitions)
      ? rawDraft.fieldDefinitions
      : [];

  if (rawFields.length === 0) {
    throw new Error("AI did not return any fields for the document type.");
  }

  const usedKeys = new Set<string>();
  const fields = rawFields.map((field, index) =>
    normalizeFieldDefinition(field, index, warnings, usedKeys),
  );
  const name =
    asTrimmedString(rawDraft.name) ||
    asTrimmedString(rawDraft.documentTypeName) ||
    titleCase(fields[0]?.key ?? "document");
  const description = asTrimmedString(rawDraft.description) || buildDefaultDescription(name);
  const promptTemplate =
    asTrimmedString(rawDraft.promptTemplate) || buildDefaultPromptTemplate(name);
  const analysisSummary =
    asTrimmedString(rawDraft.analysisSummary) ||
    asTrimmedString(rawDraft.summary) ||
    `Generated an ${name} schema with ${fields.length} top-level fields.`;

  const draft = documentTypeInputSchema.parse({
    description,
    fields,
    name,
    promptTemplate,
    slug: slugify(asTrimmedString(rawDraft.slug) || name),
  });

  return {
    analysisSummary,
    draft,
    warnings: Array.from(new Set(warnings)),
  };
}

function serializeContext(value: unknown, heading: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (Array.isArray(value) && value.length === 0) {
    return null;
  }

  if (typeof value === "string") {
    const trimmedValue = value.trim();
    return trimmedValue ? `${heading}\n${trimmedValue}` : null;
  }

  if (typeof value === "object") {
    return `${heading}\n${JSON.stringify(value, null, 2)}`;
  }

  return `${heading}\n${String(value)}`;
}

function buildAssistantPrompt(input: GenerateAssistantDraftInput): string {
  const sections = [
    "Create a reusable document extraction type for the provided business document.",
    "Infer the document category and propose the most useful fields for structured extraction.",
    "Use kind \"table\" for repeating rows such as invoice line items, cheque stubs, remittance rows, or product tables.",
    "Allowed scalar field kinds are: text, number, date, currency, boolean.",
    "Return one JSON object with this exact top-level shape: {\"name\": string, \"description\": string, \"promptTemplate\": string, \"analysisSummary\": string, \"warnings\": string[], \"fields\": Field[]}.",
    "Each Field must include key, label, kind, required, aliases, description. Table fields must also include columns, and each column must include key, label, kind, required, aliases, description.",
    "Field keys and column keys must be lowercase snake_case and should describe the extracted value, not the OCR label text.",
    "Do not include fields for decorative content, repeated logos, or generic instructions unless they are operationally useful.",
    "When a user asks for a subset of fields, prioritize that request over other possible fields.",
  ];

  const transcript = input.conversation
    .map((message) => `${message.role.toUpperCase()}: ${message.content.trim()}`)
    .join("\n\n");
  const transcriptSection = serializeContext(transcript, "Conversation so far:");
  const instructionSection = serializeContext(input.instruction, "Latest user request:");
  const currentDraftSection = serializeContext(
    input.currentDraft,
    "Current working draft to refine if helpful:",
  );

  return [
    ...sections,
    instructionSection,
    transcriptSection,
    currentDraftSection,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function shouldFallbackToOllamaForSchemaGeneration(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return [
    "gemini_api_key is not configured",
    "api key",
    "not found",
    "unsupported",
    "unknown",
    "timed out",
    "fetch failed",
    "econnrefused",
    "enotfound",
    "service unavailable",
    "quota",
    "429",
    "503",
  ].some((snippet) => message.includes(snippet));
}

async function generateWithProvider(
  provider: AssistantProvider,
  prompt: string,
  input: GenerateAssistantDraftInput,
) {
  if (provider === "google-ai") {
    return generateDocumentTypeDraftWithGoogleAi({
      filePath: input.sampleFilePath,
      mimeType: input.sampleMimeType,
      prompt,
      storageBucket: input.storageBucket,
    });
  }

  return generateDocumentTypeDraftWithOllama({
    filePath: input.sampleFilePath,
    prompt,
    storageBucket: input.storageBucket,
  });
}

export async function generateDocumentTypeAssistantResult(
  input: GenerateAssistantDraftInput,
): Promise<DocumentTypeAssistantResult> {
  const prompt = buildAssistantPrompt(input);

  try {
    const rawResponse = await generateWithProvider("google-ai", prompt, input);
    const normalized = normalizeAssistantDraft(rawResponse);

    return documentTypeAssistantResultSchema.parse({
      ...normalized,
      providerUsed: "google-ai",
      sampleFilePath: input.sampleFilePath ?? null,
    });
  } catch (error) {
    if (
      !(error instanceof GoogleAiExtractionError) ||
      !shouldFallbackToOllamaForSchemaGeneration(error)
    ) {
      throw error;
    }

    const rawResponse = await generateWithProvider("ollama", prompt, input);
    const normalized = normalizeAssistantDraft(rawResponse);

    return documentTypeAssistantResultSchema.parse({
      ...normalized,
      providerUsed: "ollama",
      sampleFilePath: input.sampleFilePath ?? null,
    });
  }
}

export {
  buildAssistantPrompt,
  normalizeAssistantDraft,
};

export type {
  GenerateAssistantDraftInput,
};