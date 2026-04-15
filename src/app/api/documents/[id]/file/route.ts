import { getDocumentById } from "@/lib/documents";
import { readStoredFileBuffer } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const document = await getDocumentById(id);

  if (!document) {
    return Response.json({ error: "Document was not found." }, { status: 404 });
  }

  try {
    const etag = `"${document.sha256}"`;

    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, {
        status: 304,
        headers: {
          "Cache-Control": "private, max-age=31536000, immutable",
          ETag: etag,
          Vary: "Cookie",
        },
      });
    }

    const buffer = await readStoredFileBuffer(document.filePath, document.storageBucket);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Cache-Control": "private, max-age=31536000, immutable",
        "Content-Disposition": `inline; filename="${document.originalName}"`,
        "Content-Type": document.mimeType,
        ETag: etag,
        Vary: "Cookie",
      },
    });
  } catch {
    return Response.json({ error: "Stored file could not be read." }, { status: 500 });
  }
}