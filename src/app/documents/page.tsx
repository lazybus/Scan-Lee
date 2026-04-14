import { DocumentsWorkbench } from "@/components/documents-workbench-client";
import { listDocumentTypes } from "@/lib/document-types";
import { listDocuments } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const [documentTypes, documents] = await Promise.all([
    listDocumentTypes(),
    listDocuments(),
  ]);

  return (
    <DocumentsWorkbench
      initialDocumentTypes={documentTypes}
      initialDocuments={documents}
    />
  );
}