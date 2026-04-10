import { getDocumentTypeById } from "@/lib/document-types";
import {
  completeDocumentExtraction,
  failDocumentExtractionWithResponse,
  getDocumentById,
  setDocumentProcessing,
} from "@/lib/documents";
import type { DocumentRecord } from "@/lib/domain";
import { extractDocumentWithOllama, OllamaExtractionError } from "@/lib/ollama";

export type DocumentExtractionResult = {
  documentId: string;
  item: DocumentRecord | null;
  ok: boolean;
  warning?: string;
  error?: string;
};

export async function extractStoredDocument(
  document: DocumentRecord,
): Promise<DocumentExtractionResult> {
  const documentType = getDocumentTypeById(document.documentTypeId);

  if (!documentType) {
    return {
      documentId: document.id,
      item: document,
      ok: false,
      error: "Document type was not found.",
    };
  }

  setDocumentProcessing(document.id);

  try {
    const result = await extractDocumentWithOllama({
      documentType,
      filePath: document.filePath,
    });

    completeDocumentExtraction({
      id: document.id,
      extractedData: result.extractedData,
      rawResponse: result.rawResponse,
      modelName: result.modelName,
    });

    return {
      documentId: document.id,
      item: getDocumentById(document.id),
      ok: true,
      warning:
        result.missingRequiredFields.length > 0
          ? `Missing required fields: ${result.missingRequiredFields.join(", ")}`
          : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed.";
    const rawResponse = error instanceof OllamaExtractionError ? error.rawResponse : null;

    console.error("Document extraction failed", {
      documentId: document.id,
      documentName: document.originalName,
      documentTypeId: document.documentTypeId,
      documentTypeName: documentType.name,
      modelName: process.env.OLLAMA_MODEL ?? "gemma4:26b",
      filePath: document.filePath,
      message,
      rawResponse,
    });

    failDocumentExtractionWithResponse({
      id: document.id,
      errorMessage: message,
      rawResponse,
    });

    return {
      documentId: document.id,
      item: getDocumentById(document.id),
      ok: false,
      error: message,
    };
  }
}

export async function extractStoredDocumentById(
  id: string,
): Promise<DocumentExtractionResult> {
  const document = getDocumentById(id);

  if (!document) {
    return {
      documentId: id,
      item: null,
      ok: false,
      error: "Document was not found.",
    };
  }

  return extractStoredDocument(document);
}