import { getDocumentById } from "@/lib/documents";
import { readStoredFileBuffer } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = await getDocumentById(id);

  if (!document) {
    return Response.json({ error: "Document was not found." }, { status: 404 });
  }

  try {
    const buffer = await readStoredFileBuffer(document.filePath, document.storageBucket);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `inline; filename="${document.originalName}"`,
        "Content-Type": document.mimeType,
      },
    });
  } catch {
    return Response.json({ error: "Stored file could not be read." }, { status: 500 });
  }
}