import { getDocumentTypeById } from "@/lib/document-types";
import {
  documentRecordSchema,
  extractedRecordSchema,
  type DocumentRecord,
  type ExtractedRecord,
  type ExtractedValue,
} from "@/lib/domain";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { StoredFile } from "@/lib/storage";

type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

function parseRecord(value: Json | null): ExtractedRecord | null {
  if (!value) {
    return null;
  }

  return extractedRecordSchema.parse(value);
}

function mapRow(row: DocumentRow, documentTypeName: string): DocumentRecord {
  return documentRecordSchema.parse({
    id: row.id,
    ownerUserId: row.owner_user_id,
    documentTypeId: row.document_type_id,
    documentTypeName,
    originalName: row.original_name,
    mimeType: row.mime_type,
    storageBucket: row.storage_bucket,
    filePath: row.storage_object_path,
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

async function loadDocumentTypeNameMap(documentTypeIds: string[]) {
  if (documentTypeIds.length === 0) {
    return new Map<string, string>();
  }

  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("document_types")
    .select("id, name")
    .in("id", Array.from(new Set(documentTypeIds)));

  if (error) {
    throw new Error(error.message);
  }

  const rows = (data ?? []) as Array<{ id: string; name: string }>;
  return new Map(rows.map((item) => [item.id, item.name]));
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, owner_user_id, document_type_id, original_name, mime_type, storage_bucket, storage_object_path, sha256, status, model_name, extracted_data, reviewed_data, raw_response, error_message, created_at, updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as DocumentRow[];
  const documentTypeNames = await loadDocumentTypeNameMap(rows.map((row) => row.document_type_id));

  return rows.map((row) => mapRow(row, documentTypeNames.get(row.document_type_id) ?? "Unknown"));
}

export async function getDocumentById(id: string): Promise<DocumentRecord | null> {
  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, owner_user_id, document_type_id, original_name, mime_type, storage_bucket, storage_object_path, sha256, status, model_name, extracted_data, reviewed_data, raw_response, error_message, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return null;
    }

    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as DocumentRow;
  const documentType = await getDocumentTypeById(row.document_type_id);

  return mapRow(row, documentType?.name ?? "Unknown");
}

export async function createDocument(input: {
  documentTypeId: string;
  storedFile: StoredFile;
}): Promise<DocumentRecord> {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const id = crypto.randomUUID();
  const insertPayload: Database["public"]["Tables"]["documents"]["Insert"] = {
    id,
    owner_user_id: user.id,
    document_type_id: input.documentTypeId,
    original_name: input.storedFile.originalName,
    mime_type: input.storedFile.mimeType,
    storage_bucket: input.storedFile.bucketName,
    storage_object_path: input.storedFile.filePath,
    sha256: input.storedFile.sha256,
    status: "uploaded",
  };

  const { error } = await supabase.from("documents").insert(insertPayload as never);

  if (error) {
    throw new Error(error.message);
  }

  const created = await getDocumentById(id);

  if (!created) {
    throw new Error("Document was not created.");
  }

  return created;
}

export async function deleteDocument(id: string): Promise<DocumentRecord | null> {
  const existing = await getDocumentById(id);

  if (!existing) {
    return null;
  }

  const supabase = await createSupabaseServerComponentClient();
  const { error } = await supabase.from("documents").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  return existing;
}

export async function setDocumentProcessing(id: string) {
  const supabase = await createSupabaseServerComponentClient();
  const updatePayload: Database["public"]["Tables"]["documents"]["Update"] = {
    status: "processing",
    error_message: null,
  };
  const { error } = await supabase
    .from("documents")
    .update(updatePayload as never)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function completeDocumentExtraction(input: {
  id: string;
  extractedData: ExtractedRecord;
  rawResponse: string;
  modelName: string;
}) {
  const supabase = await createSupabaseServerComponentClient();
  const updatePayload: Database["public"]["Tables"]["documents"]["Update"] = {
    status: "extracted",
    reviewed_data: null,
    model_name: input.modelName,
    extracted_data: input.extractedData,
    raw_response: input.rawResponse,
    error_message: null,
  };
  const { error } = await supabase
    .from("documents")
    .update(updatePayload as never)
    .eq("id", input.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateDocumentReview(input: {
  id: string;
  reviewedData: ExtractedRecord;
  status?: "reviewed" | "completed";
}): Promise<DocumentRecord | null> {
  const supabase = await createSupabaseServerComponentClient();
  const updatePayload: Database["public"]["Tables"]["documents"]["Update"] = {
    status: input.status ?? "reviewed",
    reviewed_data: input.reviewedData,
    error_message: null,
  };
  const { error } = await supabase
    .from("documents")
    .update(updatePayload as never)
    .eq("id", input.id);

  if (error) {
    throw new Error(error.message);
  }

  return getDocumentById(input.id);
}

export async function failDocumentExtraction(id: string, errorMessage: string) {
  const supabase = await createSupabaseServerComponentClient();
  const updatePayload: Database["public"]["Tables"]["documents"]["Update"] = {
    status: "failed",
    error_message: errorMessage,
  };
  const { error } = await supabase
    .from("documents")
    .update(updatePayload as never)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function failDocumentExtractionWithResponse(input: {
  id: string;
  errorMessage: string;
  rawResponse?: string | null;
}) {
  const supabase = await createSupabaseServerComponentClient();
  const updatePayload: Database["public"]["Tables"]["documents"]["Update"] = {
    status: "failed",
    error_message: input.errorMessage,
    raw_response: input.rawResponse ?? null,
  };
  const { error } = await supabase
    .from("documents")
    .update(updatePayload as never)
    .eq("id", input.id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function getDashboardSummary() {
  const supabase = await createSupabaseServerComponentClient();
  const [documentTypesResult, documentCountResult, extractedCountResult] = await Promise.all([
    supabase.from("document_types").select("id", { count: "exact", head: true }),
    supabase.from("documents").select("id", { count: "exact", head: true }),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .in("status", ["extracted", "reviewed", "completed"]),
  ]);

  if (documentTypesResult.error && documentTypesResult.error.code !== "42P01") {
    throw new Error(documentTypesResult.error.message);
  }

  if (documentCountResult.error && documentCountResult.error.code !== "42P01") {
    throw new Error(documentCountResult.error.message);
  }

  if (extractedCountResult.error && extractedCountResult.error.code !== "42P01") {
    throw new Error(extractedCountResult.error.message);
  }

  return {
    documentTypeCount: documentTypesResult.count ?? 0,
    documentCount: documentCountResult.count ?? 0,
    extractedCount: extractedCountResult.count ?? 0,
  };
}

export async function getExportRows(documentTypeId?: string) {
  const documents = documentTypeId
    ? (await listDocuments()).filter((document) => document.documentTypeId === documentTypeId)
    : await listDocuments();

  const documentTypes = await Promise.all(
    Array.from(new Set(documents.map((document) => document.documentTypeId))).map(
      async (id) => [id, await getDocumentTypeById(id)] as const,
    ),
  );
  const documentTypeMap = new Map(documentTypes);

  return documents
    .filter((document) => document.extractedData || document.reviewedData)
    .flatMap((document) => {
      const values = document.reviewedData ?? document.extractedData ?? {};
      const documentType = documentTypeMap.get(document.documentTypeId) ?? null;
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