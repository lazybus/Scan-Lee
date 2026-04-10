import { DocumentsWorkbench } from "@/components/documents-workbench-client";
import { listDocumentTypes } from "@/lib/document-types";
import { listDocuments } from "@/lib/documents";

export const dynamic = "force-dynamic";

export default function DocumentsPage() {
  const documentTypes = listDocumentTypes();
  const documents = listDocuments();

  return (
    <DocumentsWorkbench
      initialDocumentTypes={documentTypes}
      initialDocuments={documents}
    />
  );
}