import {
  buildFieldPromptSnippet,
  getMissingRequiredFields,
  normalizeExtractedData,
  type DocumentType,
  type ExtractedRecord,
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
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
          images: [imageBase64],
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

  console.info(
    [
      "[ollama] Extraction response",
      `model=${modelName}`,
      "json >>>",
      rawResponse,
      "<<< json",
    ].join("\n"),
  );

  const sanitizedResponse = stripJsonCodeFence(rawResponse);

  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(sanitizedResponse) as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown JSON parse error.";
    throw new OllamaExtractionError(
      `Ollama returned invalid JSON: ${detail}. Response: ${summarizeResponseSnippet(sanitizedResponse)}`,
      rawResponse,
    );
  }

  const extractedData = normalizeExtractedData(input.documentType.fields, parsed);

  return {
    extractedData,
    rawResponse,
    modelName,
    missingRequiredFields: getMissingRequiredFields(input.documentType.fields, extractedData),
  };
}