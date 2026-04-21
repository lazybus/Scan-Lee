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
    <DocumentsWorkbench
      activeBatch={batch}
      initialDocumentTypes={documentTypes}
      initialDocuments={documents}
    />
  );
}