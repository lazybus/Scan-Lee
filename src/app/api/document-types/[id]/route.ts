import { getDocumentTypeById, updateDocumentType } from "@/lib/document-types";
import { documentTypeInputSchema, slugify } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const item = getDocumentTypeById(id);

  if (!item) {
    return Response.json({ error: "Document type was not found." }, { status: 404 });
  }

  return Response.json({ item });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  if (!getDocumentTypeById(id)) {
    return Response.json({ error: "Document type was not found." }, { status: 404 });
  }

  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const parsed = documentTypeInputSchema.parse({
      ...payload,
      slug: slugify(String(payload.slug ?? payload.name ?? "")),
    });
    const item = updateDocumentType(id, parsed);

    if (!item) {
      return Response.json({ error: "Document type was not found." }, { status: 404 });
    }

    return Response.json({ item });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid document type payload.",
      },
      { status: 400 },
    );
  }
}