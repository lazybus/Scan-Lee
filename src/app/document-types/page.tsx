import { DocumentTypesManager } from "@/components/document-types-manager";
import { listDocumentTypes } from "@/lib/document-types";

export const dynamic = "force-dynamic";

export default function DocumentTypesPage() {
  const documentTypes = listDocumentTypes();

  return <DocumentTypesManager initialDocumentTypes={documentTypes} />;
}