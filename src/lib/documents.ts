import { getDatabase } from "@/lib/db";
import { getDocumentTypeById } from "@/lib/document-types";
import {
  documentRecordSchema,
  extractedRecordSchema,
  type DocumentRecord,
  type ExtractedRecord,
  type ExtractedValue,
} from "@/lib/domain";
import type { StoredFile } from "@/lib/storage";

type DocumentRow = {
  id: string;
  document_type_id: string;
  document_type_name: string;
  original_name: string;
  mime_type: string;
  file_path: string;
  sha256: string;
  status: string;
  model_name: string | null;
  extracted_data: string | null;
  reviewed_data: string | null;
  raw_response: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

function parseRecord(value: string | null): ExtractedRecord | null {
  if (!value) {
    return null;
  }

  return extractedRecordSchema.parse(JSON.parse(value));
}

function mapRow(row: DocumentRow): DocumentRecord {
  return documentRecordSchema.parse({
    id: row.id,
    documentTypeId: row.document_type_id,
    documentTypeName: row.document_type_name,
    originalName: row.original_name,
    mimeType: row.mime_type,
    filePath: row.file_path,
    sha256: row.sha256,
    status: row.status,
    modelName: row.model_name,
    extractedData: parseRecord(row.extracted_data),
    reviewedData: parseRecord(row.reviewed_data),
    rawResponse: row.raw_response,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function baseSelect() {
  return `
    SELECT
      documents.id,
      documents.document_type_id,
      document_types.name as document_type_name,
      documents.original_name,
      documents.mime_type,
      documents.file_path,
      documents.sha256,
      documents.status,
      documents.model_name,
      documents.extracted_data,
      documents.reviewed_data,
      documents.raw_response,
      documents.error_message,
      documents.created_at,
      documents.updated_at
    FROM documents
    INNER JOIN document_types ON document_types.id = documents.document_type_id
  `;
}

export function listDocuments(): DocumentRecord[] {
  const db = getDatabase();
  const rows = db
    .prepare(`${baseSelect()} ORDER BY documents.created_at DESC`)
    .all() as DocumentRow[];

  return rows.map(mapRow);
}

export function getDocumentById(id: string): DocumentRecord | null {
  const db = getDatabase();
  const row = db
    .prepare(`${baseSelect()} WHERE documents.id = ?`)
    .get(id) as DocumentRow | undefined;

  return row ? mapRow(row) : null;
}

export function createDocument(input: {
  documentTypeId: string;
  storedFile: StoredFile;
}): DocumentRecord {
  const db = getDatabase();
  const id = crypto.randomUUID();

  db.prepare(
    `
      INSERT INTO documents (
        id,
        document_type_id,
        original_name,
        mime_type,
        file_path,
        sha256,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'uploaded', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
  ).run(
    id,
    input.documentTypeId,
    input.storedFile.originalName,
    input.storedFile.mimeType,
    input.storedFile.filePath,
    input.storedFile.sha256,
  );

  const created = getDocumentById(id);

  if (!created) {
    throw new Error("Document was not created.");
  }

  return created;
}

export function deleteDocument(id: string): DocumentRecord | null {
  const existing = getDocumentById(id);

  if (!existing) {
    return null;
  }

  const db = getDatabase();
  db.prepare("DELETE FROM documents WHERE id = ?").run(id);

  return existing;
}

export function setDocumentProcessing(id: string) {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE documents
      SET status = 'processing', error_message = NULL, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(id);
}

export function completeDocumentExtraction(input: {
  id: string;
  extractedData: ExtractedRecord;
  rawResponse: string;
  modelName: string;
}) {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE documents
      SET
        status = 'extracted',
        reviewed_data = NULL,
        model_name = ?,
        extracted_data = ?,
        raw_response = ?,
        error_message = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(
    input.modelName,
    JSON.stringify(input.extractedData),
    input.rawResponse,
    input.id,
  );
}

export function updateDocumentReview(input: {
  id: string;
  reviewedData: ExtractedRecord;
  status?: "reviewed" | "completed";
}): DocumentRecord | null {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE documents
      SET
        status = ?,
        reviewed_data = ?,
        error_message = NULL,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(input.status ?? "reviewed", JSON.stringify(input.reviewedData), input.id);

  return getDocumentById(input.id);
}

export function failDocumentExtraction(id: string, errorMessage: string) {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE documents
      SET
        status = 'failed',
        error_message = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(errorMessage, id);
}

export function failDocumentExtractionWithResponse(input: {
  id: string;
  errorMessage: string;
  rawResponse?: string | null;
}) {
  const db = getDatabase();
  db.prepare(
    `
      UPDATE documents
      SET
        status = 'failed',
        error_message = ?,
        raw_response = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(input.errorMessage, input.rawResponse ?? null, input.id);
}

export function getDashboardSummary() {
  const db = getDatabase();
  const counts = db
    .prepare(
      `
        SELECT
          (SELECT COUNT(*) FROM document_types) as documentTypeCount,
          (SELECT COUNT(*) FROM documents) as documentCount,
          (SELECT COUNT(*) FROM documents WHERE status IN ('extracted', 'reviewed', 'completed')) as extractedCount
      `,
    )
    .get() as {
      documentTypeCount: number;
      documentCount: number;
      extractedCount: number;
    };

  return counts;
}

export function getExportRows(documentTypeId?: string) {
  const documents = documentTypeId
    ? listDocuments().filter((document) => document.documentTypeId === documentTypeId)
    : listDocuments();

  return documents
    .filter((document) => document.extractedData || document.reviewedData)
    .flatMap((document) => {
      const values = document.reviewedData ?? document.extractedData ?? {};
      const documentType = getDocumentTypeById(document.documentTypeId);
      const baseRow = {
        documentId: document.id,
        documentType: document.documentTypeName,
        fileName: document.originalName,
        status: document.status,
        capturedAt: document.createdAt,
      };

      if (!documentType) {
        return [
          {
            ...baseRow,
            ...flattenRecordValues(values),
          },
        ];
      }

      const productFields = documentType.fields.filter((field) => field.kind === "table");

      if (productFields.length === 0) {
        return [
          {
            ...baseRow,
            ...flattenRecordValues(values),
          },
        ];
      }

      const scalarValues = Object.fromEntries(
        Object.entries(values).filter(
          ([key]) => !productFields.some((field) => field.key === key),
        ),
      );
      const flattenedScalarValues = flattenRecordValues(scalarValues);
      const productRows = productFields.flatMap((field) => {
        const rows = getArrayRecordValues(values[field.key]);

        return rows.map((row) => ({
          ...baseRow,
          ...flattenedScalarValues,
          productsField: field.key,
          ...flattenRecordValues(row),
        }));
      });

      return productRows.length > 0
        ? productRows
        : [
            {
              ...baseRow,
              ...flattenedScalarValues,
            },
          ];
    });
}

function flattenRecordValues(values: Record<string, ExtractedValue>) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, flattenExportValue(value)]),
  );
}

function flattenExportValue(value: ExtractedValue): string | number | boolean | null {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  return JSON.stringify(value);
}

function getArrayRecordValues(value: ExtractedValue | undefined): Record<string, ExtractedValue>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (item): item is Record<string, ExtractedValue> =>
      typeof item === "object" && item !== null && !Array.isArray(item),
  );
}