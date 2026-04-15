import Link from "next/link";
import { notFound } from "next/navigation";

import { DocumentsWorkbench } from "@/components/documents-workbench-client";
import { listDocumentTypes } from "@/lib/document-types";
import { listDocuments } from "@/lib/documents";
import { getImageBatchById } from "@/lib/image-batches";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireUser(`/batches/${id}`);

  const [batch, documentTypes, documents] = await Promise.all([
    getImageBatchById(id),
    listDocumentTypes(),
    listDocuments({ batchId: id }),
  ]);

  if (!batch) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <section className="paper-panel p-6 sm:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className="data-label">Image Batch</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{batch.name}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              {batch.description || "Add documents to this batch, run extraction, then export the full batch or one document type when review is complete."}
            </p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm text-[var(--muted)]">
              <span>{batch.documentCount ?? documents.length} documents</span>
              <span>{batch.processedDocumentCount ?? 0} processed</span>
              <span>Status: {batch.status}</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link className="secondary-button" href="/batches">
              Back to Batches
            </Link>
          </div>
        </div>
      </section>

      <DocumentsWorkbench
        activeBatch={batch}
        initialDocumentTypes={documentTypes}
        initialDocuments={documents}
      />
    </div>
  );
}