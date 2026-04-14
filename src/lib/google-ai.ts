import { extname } from "node:path";

import { GoogleGenAI, type Part } from "@google/genai";

import {
  buildFieldPromptSnippet,
  getMissingRequiredFields,
  normalizeExtractedData,
  type DocumentType,
  type ExtractedRecord,
  type TableFieldDefinition,
} from "@/lib/domain";
import { readStoredFileAsBase64 } from "@/lib/storage";

const apiKey = process.env.GEMINI_API_KEY ?? "";
const modelName = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export class GoogleAiExtractionError extends Error {
  rawResponse: string | null;

  constructor(message: string, rawResponse?: string | null) {
    super(message);
    this.name = "GoogleAiExtractionError";
    this.rawResponse = rawResponse ?? null;
  }
}

function createClient() {
  if (!apiKey) {
    throw new GoogleAiExtractionError("GEMINI_API_KEY is not configured.");
  }

  return new GoogleGenAI({ apiKey });
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
    `Return this exact shape: {\"${field.key}\": []} when no rows are present.`,
    `Each item in ${field.key} must be one complete row object from the repeating table.`,
    "Use the exact keys below for every row object:",
    columnSnippet,
  ].join("\n\n");
}

function inferMimeType(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".webp":
      return "image/webp";
    case ".gif":
      return "image/gif";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown Google AI error.";
}

function getErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null) {
    return null;
  }

  const maybeStatus = (error as { status?: unknown }).status;
  return typeof maybeStatus === "number" ? maybeStatus : null;
}

function classifyStatusError(error: unknown) {
  const message = getErrorMessage(error);
  const status = getErrorStatus(error);
  const isMissingModel =
    status === 404 || /model/i.test(message) && /not found|unsupported|unknown/i.test(message);

  if (isMissingModel) {
    return {
      connected: true,
      modelName,
      available: false,
      reason: message,
    };
  }

  return {
    connected: false,
    modelName,
    reason: message,
  };
}

export async function getGoogleAiStatus() {
  try {
    const client = createClient();
    await client.models.generateContent({
      model: modelName,
      contents: "Reply with the word ok.",
      config: {
        temperature: 0,
        maxOutputTokens: 8,
      },
    });

    return {
      connected: true,
      modelName,
      available: true,
    };
  } catch (error) {
    return classifyStatusError(error);
  }
}

export async function extractDocumentWithGoogleAi(input: {
  documentType: DocumentType;
  filePath: string;
  mimeType?: string;
  storageBucket?: string;
}): Promise<{
  extractedData: ExtractedRecord;
  rawResponse: string;
  modelName: string;
  missingRequiredFields: string[];
}> {
  const imageBase64 = await readStoredFileAsBase64(input.filePath, input.storageBucket);
  const rawMimeType = input.mimeType?.trim();
  const mimeType = rawMimeType && rawMimeType.length > 0 ? rawMimeType : inferMimeType(input.filePath);
  const systemPrompt =
    "You extract structured business document data from images. Return JSON only.";
  const userPrompt = buildPrompt(input.documentType);

  const rawResponse = await requestGoogleAiJsonResponse({
    imageBase64,
    mimeType,
    systemPrompt,
    userPrompt,
  });

  console.info(
    [
      "[google-ai] Extraction response",
      `model=${modelName}`,
      "json >>>",
      rawResponse,
      "<<< json",
    ].join("\n"),
  );

  const parsed = parseGoogleAiJsonObject(rawResponse);
  const fallbackResponses: Record<string, unknown> = {};

  for (const field of input.documentType.fields) {
    if (field.kind !== "table") {
      continue;
    }

    if (!needsProductsFallback(parsed[field.key])) {
      continue;
    }

    const fallbackResponse = await requestGoogleAiJsonResponse({
      imageBase64,
      mimeType,
      systemPrompt,
      userPrompt: buildProductsFallbackPrompt(field),
    });
    const fallbackParsed = parseGoogleAiJsonObject(fallbackResponse);

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

async function requestGoogleAiJsonResponse(input: {
  imageBase64: string;
  mimeType: string;
  systemPrompt: string;
  userPrompt: string;
}) {
  try {
    const client = createClient();
    const imagePart: Part = {
      inlineData: {
        data: input.imageBase64,
        mimeType: input.mimeType,
      },
    };
    const response = await client.models.generateContent({
      model: modelName,
      contents: [imagePart, input.userPrompt],
      config: {
        systemInstruction: input.systemPrompt,
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });
    const rawResponse = response.text?.trim();

    if (!rawResponse) {
      throw new GoogleAiExtractionError(
        "Google AI returned an empty response.",
        JSON.stringify(response),
      );
    }

    return rawResponse;
  } catch (error) {
    if (error instanceof GoogleAiExtractionError) {
      throw error;
    }

    throw new GoogleAiExtractionError(
      `Google AI request failed: ${getErrorMessage(error)}`,
      getErrorMessage(error),
    );
  }
}

function parseGoogleAiJsonObject(rawResponse: string) {
  const sanitizedResponse = stripJsonCodeFence(rawResponse);

  try {
    const parsed = JSON.parse(sanitizedResponse) as unknown;

    if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("Top-level JSON must be an object.");
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new GoogleAiExtractionError(
      `Google AI returned invalid JSON: ${detail}. Response: ${summarizeResponseSnippet(sanitizedResponse)}`,
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