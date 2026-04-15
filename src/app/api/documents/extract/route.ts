import { extractStoredDocument } from "@/lib/document-extraction";
import { listDocuments } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get("batchId") ?? undefined;

    if (!batchId) {
      return Response.json(
        { error: "A batchId query parameter is required for batch extraction." },
        { status: 400 },
      );
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