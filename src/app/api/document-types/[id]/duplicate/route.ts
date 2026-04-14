import { duplicateDocumentType } from "@/lib/document-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const item = await duplicateDocumentType(id);
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Document type duplication failed.";
    const status = message === "Document type was not found." ? 404 : 400;

    return Response.json({ error: message }, { status });
  }
}
