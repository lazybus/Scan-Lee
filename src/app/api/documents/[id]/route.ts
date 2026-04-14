import { z } from "zod";

import { getDocumentTypeById } from "@/lib/document-types";
import { extractedRecordSchema, normalizeExtractedData, type ExtractedRecord } from "@/lib/domain";
import { deleteDocument, getDocumentById, updateDocumentReview } from "@/lib/documents";
import { deleteStoredFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewRequestSchema = z.object({
  reviewedData: extractedRecordSchema,
  status: z.enum(["reviewed", "completed"]).optional(),
});

function normalizeReviewedData(
  values: ExtractedRecord,
  documentTypeId: string,
) {
  return getDocumentTypeById(documentTypeId).then((documentType) => {
    if (!documentType) {
      return null;
    }

    const normalizedData = normalizeExtractedData(documentType.fields, values);
    const knownKeys = new Set(documentType.fields.map((field) => field.key));
    const extraEntries = Object.entries(values)
      .filter(([key]) => !knownKeys.has(key))
      .map(([key, value]) => [key, value] as const);

    return {
      ...normalizedData,
      ...Object.fromEntries(extraEntries),
    };
  });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = await getDocumentById(id);

  if (!document) {
    return Response.json({ error: "Document was not found." }, { status: 404 });
  }

  const body = reviewRequestSchema.safeParse(await request.json());

  if (!body.success) {
    return Response.json({ error: "Reviewed data is invalid." }, { status: 400 });
  }

  const reviewedData = await normalizeReviewedData(body.data.reviewedData, document.documentTypeId);

  if (!reviewedData) {
    return Response.json({ error: "Document type was not found." }, { status: 404 });
  }

  const updated = await updateDocumentReview({
    id,
    reviewedData,
    status: body.data.status,
  });

  if (!updated) {
    return Response.json({ error: "Document was not found." }, { status: 404 });
  }

  return Response.json({ item: updated });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = await getDocumentById(id);

  if (!document) {
    return Response.json({ error: "Document was not found." }, { status: 404 });
  }

  try {
    const deleted = await deleteDocument(id);

    if (!deleted) {
      return Response.json({ error: "Document was not found." }, { status: 404 });
    }

    await deleteStoredFile(deleted.filePath, deleted.storageBucket);

    return Response.json({ item: deleted });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Document deletion failed.",
      },
      { status: 500 },
    );
  }
}