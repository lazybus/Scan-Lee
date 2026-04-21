import { getDocumentById } from "@/lib/documents";
import { readStoredFileBuffer } from "@/lib/storage";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ error: "Authentication required." }, { status: 401 });
  }

  const { id } = await context.params;
  const document = await getDocumentById(id);

  if (!document || document.ownerUserId !== user.id) {
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