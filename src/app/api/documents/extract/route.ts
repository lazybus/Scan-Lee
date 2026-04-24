import { extractStoredDocument } from "@/lib/document-extraction";
import { listDocuments } from "@/lib/documents";
import { getImageBatchById } from "@/lib/image-batches";
import { checkRateLimit, getRateLimitSource } from "@/lib/rate-limit";
import { requireRouteUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const routeUser = await requireRouteUser();

    if (routeUser instanceof Response) {
      return routeUser;
    }

    const user = routeUser;

    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId") ?? undefined;

    if (!batchId) {
      return Response.json(
        { error: "A batchId query parameter is required for batch extraction." },
        { status: 400 },
      );
    }

    const rateLimit = checkRateLimit({
      key: `extract:batch:${getRateLimitSource(request.headers)}:${user.id}:${batchId}`,
      limit: 3,
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

    const imageBatch = await getImageBatchById(batchId);

    if (!imageBatch || imageBatch.ownerUserId !== user.id) {
      return Response.json({ error: "Image batch was not found." }, { status: 404 });
    }

    const documents = await listDocuments({ batchId });
    const queuedDocuments = documents.filter((document) => document.status !== "processing");

    if (queuedDocuments.length === 0) {
      return Response.json(
        { error: "No stored documents are available for extraction in this batch." },
        { status: 400 },
      );
    }

    const results = [];

    for (const document of queuedDocuments) {
      results.push(await extractStoredDocument(document));
    }

    return Response.json({
      results,
      processedCount: queuedDocuments.length,
      successCount: results.filter((result) => result.ok).length,
      failureCount: results.filter((result) => !result.ok).length,
      skippedCount: documents.length - queuedDocuments.length,
    });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Batch extraction failed.",
      },
      { status: 500 },
    );
  }
}