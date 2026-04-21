import { extractStoredDocument } from "@/lib/document-extraction";
import { getDocumentById } from "@/lib/documents";
import { checkRateLimit, getRateLimitSource } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
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

  const rateLimit = checkRateLimit({
    key: `extract:document:${getRateLimitSource(request.headers)}:${user.id}:${id}`,
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Too many extraction attempts. Try again in ${rateLimit.retryAfterSeconds} seconds.` },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      },
    );
  }

  const result = await extractStoredDocument(document);

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