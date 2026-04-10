import { extractStoredDocumentById } from "@/lib/document-extraction";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const result = await extractStoredDocumentById(id);

  if (!result.item && result.error === "Document was not found.") {
    return Response.json({ error: "Document was not found." }, { status: 404 });
  }

  if (!result.item && result.error === "Document type was not found.") {
    return Response.json({ error: "Document type was not found." }, { status: 404 });
  }

  if (!result.ok) {
    return Response.json(
      { error: result.error ?? "Extraction failed.", item: result.item },
      { status: 500 },
    );
  }

  return Response.json({ item: result.item, warning: result.warning });
}