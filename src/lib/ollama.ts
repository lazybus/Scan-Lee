import {
  buildFieldPromptSnippet,
  getMissingRequiredFields,
  normalizeExtractedData,
  type DocumentType,
  type ExtractedRecord,
  type TableFieldDefinition,
} from "@/lib/domain";
import { readStoredFileAsBase64 } from "@/lib/storage";

const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434";
const modelName = process.env.OLLAMA_MODEL ?? "gemma4:26b";

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
  done?: boolean;
};

export class OllamaExtractionError extends Error {
  rawResponse: string | null;

  constructor(message: string, rawResponse?: string | null) {
    super(message);
    this.name = "OllamaExtractionError";
    this.rawResponse = rawResponse ?? null;
  }
}

function stripJsonCodeFence(input: string): string {
  return input.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
}

function summarizeResponseSnippet(input: string): string {
  const normalized = input.replace(/\s+/g, " ").trim();

  if (normalized.length <= 240) {
    return normalized;
  }

  return `${normalized.slice(0, 237)}...`;
}

function buildPrompt(documentType: DocumentType): string {
  return [
    documentType.promptTemplate,
    "Return one JSON object only.",
    "Do not wrap the JSON in markdown.",
    "Use these exact keys and set missing values to null.",
    buildFieldPromptSnippet(documentType.fields),
  ].join("\n\n");
}

function buildProductsFallbackPrompt(field: TableFieldDefinition): string {
  const columnSnippet = field.columns
    .map((column) => {
      const aliases = column.aliases.length > 0 ? ` aliases: ${column.aliases.join(", ")}.` : "";
      const detail = column.description ? ` ${column.description}` : "";

      return `- ${column.key}: ${column.label} (${column.kind}). Required: ${column.required}.${aliases}${detail}`;
    })
    .join("\n");

  return [
    `Extract only the ${field.label} table field from this document image.`,
    "Return one JSON object only.",
    "Do not wrap the JSON in markdown.",
    `Return this exact shape: {"${field.key}": []} when no rows are present.`,
    `Each item in ${field.key} must be one complete row object from the repeating table.`,
    "Use the exact keys below for every row object:",
    columnSnippet,
  ].join("\n\n");
}

export async function getOllamaStatus() {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
      method: "GET",
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        connected: false,
        modelName,
        reason: `HTTP ${response.status}`,
      };
    }

    const data = (await response.json()) as {
      models?: Array<{ name?: string }>;
    };
    const availableModels = data.models?.map((model) => model.name).filter(Boolean) ?? [];

    return {
      connected: true,
      modelName,
      available: availableModels.includes(modelName),
      availableModels,
    };
  } catch (error) {
    return {
      connected: false,
      modelName,
      reason: error instanceof Error ? error.message : "Unknown connection error.",
    };
  }
}

export async function extractDocumentWithOllama(input: {
  documentType: DocumentType;
  filePath: string;
}): Promise<{
  extractedData: ExtractedRecord;
  rawResponse: string;
  modelName: string;
  missingRequiredFields: string[];
}> {
  const imageBase64 = readStoredFileAsBase64(input.filePath);
  const systemPrompt =
    "You extract structured business document data from images. Return JSON only.";
  const userPrompt = buildPrompt(input.documentType);

 /* console.info(
    [
      "[ollama] Extraction request",
      `model=${modelName}`,
      `documentType=${input.documentType.name}`,
      "system prompt >>>",
      systemPrompt,
      "<<< system prompt",
      "user prompt >>>",
      userPrompt,
      "<<< user prompt",
      `image bytes(base64)=${imageBase64.length}`,
    ].join("\n"),
  ); */

  const rawResponse = await requestOllamaJsonResponse({
    imageBase64,
    systemPrompt,
    userPrompt,
  });

  console.info(
    [
      "[ollama] Extraction response",
      `model=${modelName}`,
      "json >>>",
      rawResponse,
      "<<< json",
    ].join("\n"),
  );

  const parsed = parseOllamaJsonObject(rawResponse);
  const fallbackResponses: Record<string, unknown> = {};

  for (const field of input.documentType.fields) {
    if (field.kind !== "table") {
      continue;
    }

    if (!needsProductsFallback(parsed[field.key])) {
      continue;
    }

    const fallbackResponse = await requestOllamaJsonResponse({
      imageBase64,
      systemPrompt,
      userPrompt: buildProductsFallbackPrompt(field),
    });
    const fallbackParsed = parseOllamaJsonObject(fallbackResponse);

    if (Array.isArray(fallbackParsed[field.key])) {
      parsed[field.key] = fallbackParsed[field.key];
      fallbackResponses[field.key] = fallbackParsed[field.key];
    }
  }

  const extractedData = normalizeExtractedData(input.documentType.fields, parsed);

  return {
    extractedData,
    rawResponse:
      Object.keys(fallbackResponses).length === 0
        ? rawResponse
        : JSON.stringify(
            {
              primary: parsed,
              fallback: fallbackResponses,
            },
            null,
            2,
          ),
    modelName,
    missingRequiredFields: getMissingRequiredFields(input.documentType.fields, extractedData),
  };
}

async function requestOllamaJsonResponse(input: {
  imageBase64: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    cache: "no-store",
    body: JSON.stringify({
      model: modelName,
      stream: false,
      format: "json",
      messages: [
        {
          role: "system",
          content: input.systemPrompt,
        },
        {
          role: "user",
          content: input.userPrompt,
          images: [input.imageBase64],
        },
      ],
      options: {
        temperature: 0.1,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new OllamaExtractionError(
      `Ollama request failed: ${response.status} ${text}`,
      text,
    );
  }

  const payload = (await response.json()) as OllamaChatResponse;
  const rawResponse = payload.message?.content?.trim();

  if (!rawResponse) {
    throw new OllamaExtractionError(
      "Ollama returned an empty response.",
      JSON.stringify(payload),
    );
  }

  return rawResponse;
}

function parseOllamaJsonObject(rawResponse: string) {
  const sanitizedResponse = stripJsonCodeFence(rawResponse);

  try {
    const parsed = JSON.parse(sanitizedResponse) as unknown;

    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("Top-level JSON must be an object.");
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new OllamaExtractionError(
      `Ollama returned invalid JSON: ${detail}. Response: ${summarizeResponseSnippet(sanitizedResponse)}`,
      rawResponse,
    );
  }
}

function needsProductsFallback(value: unknown): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (Array.isArray(value)) {
    return false;
  }

  if (typeof value !== "string") {
    return true;
  }

  try {
    return !Array.isArray(JSON.parse(value));
  } catch {
    return true;
  }
}