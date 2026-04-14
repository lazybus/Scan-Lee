import { getDocumentTypeById } from "@/lib/document-types";
import {
  completeDocumentExtraction,
  failDocumentExtractionWithResponse,
  getDocumentById,
  setDocumentProcessing,
} from "@/lib/documents";
import type { DocumentRecord } from "@/lib/domain";
import {
  extractDocumentWithGoogleAi,
  GoogleAiExtractionError,
} from "@/lib/google-ai";

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
  const documentType = await getDocumentTypeById(document.documentTypeId);

  if (!documentType) {
    return {
      documentId: document.id,
      item: document,
      ok: false,
      error: "Document type was not found.",
    };
  }

  await setDocumentProcessing(document.id);

  try {
    const result = await extractDocumentWithGoogleAi({
      documentType,
      filePath: document.filePath,
      mimeType: document.mimeType,
      storageBucket: document.storageBucket,
    });

    await completeDocumentExtraction({
      id: document.id,
      extractedData: result.extractedData,
      rawResponse: result.rawResponse,
      modelName: result.modelName,
    });

    return {
      documentId: document.id,
      item: await getDocumentById(document.id),
      ok: true,
      warning:
        result.missingRequiredFields.length > 0
          ? `Missing required fields: ${result.missingRequiredFields.join(", ")}`
          : undefined,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed.";
    const rawResponse = error instanceof GoogleAiExtractionError ? error.rawResponse : null;

    console.error("Document extraction failed", {
      documentId: document.id,
      documentName: document.originalName,
      documentTypeId: document.documentTypeId,
      documentTypeName: documentType.name,
      modelName: process.env.GEMINI_MODEL ?? "gemini-2.5-flash",
      filePath: document.filePath,
      message,
      rawResponse,
    });

    await failDocumentExtractionWithResponse({
      id: document.id,
      errorMessage: message,
      rawResponse,
    });

    return {
      documentId: document.id,
      item: await getDocumentById(document.id),
      ok: false,
      error: message,
    };
  }
}

export async function extractStoredDocumentById(
  id: string,
): Promise<DocumentExtractionResult> {
  const document = await getDocumentById(id);

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