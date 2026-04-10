import { z } from "zod";

import { getDocumentTypeById } from "@/lib/document-types";
import { normalizeExtractedData } from "@/lib/domain";
import { deleteDocument, getDocumentById, updateDocumentReview } from "@/lib/documents";
import { deleteStoredFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reviewRequestSchema = z.object({
  reviewedData: z.record(z.string(), z.union([z.string(), z.null()])),
  status: z.enum(["reviewed", "completed"]).optional(),
});

function normalizeReviewedData(
  values: Record<string, string | null>,
  documentTypeId: string,
) {
  const documentType = getDocumentTypeById(documentTypeId);

  if (!documentType) {
    return null;
  }

  const normalizedData = normalizeExtractedData(documentType.fields, values);
  const knownKeys = new Set(documentType.fields.map((field) => field.key));
  const extraEntries = Object.entries(values)
    .filter(([key]) => !knownKeys.has(key))
    .map(([key, value]) => [key, value === null ? null : value.trim() || null] as const);

  return {
    ...normalizedData,
    ...Object.fromEntries(extraEntries),
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = getDocumentById(id);

  if (!document) {
    return Response.json({ error: "Document was not found." }, { status: 404 });
  }

  const body = reviewRequestSchema.safeParse(await request.json());

  if (!body.success) {
    return Response.json({ error: "Reviewed data is invalid." }, { status: 400 });
  }

  const reviewedData = normalizeReviewedData(body.data.reviewedData, document.documentTypeId);

  if (!reviewedData) {
    return Response.json({ error: "Document type was not found." }, { status: 404 });
  }

  const updated = updateDocumentReview({
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
  const document = getDocumentById(id);

  if (!document) {
    return Response.json({ error: "Document was not found." }, { status: 404 });
  }

  try {
    const deleted = deleteDocument(id);

    if (!deleted) {
      return Response.json({ error: "Document was not found." }, { status: 404 });
    }

    await deleteStoredFile(deleted.filePath);

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