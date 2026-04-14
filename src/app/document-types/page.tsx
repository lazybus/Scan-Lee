import { DocumentTypesManager } from "@/components/document-types-manager";
import { listDocumentTypes } from "@/lib/document-types";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DocumentTypesPage() {
  const user = await requireUser("/document-types");
  const documentTypes = await listDocumentTypes();

  return (
    <DocumentTypesManager
      currentUserId={user.id}
      initialDocumentTypes={documentTypes}
    />
  );
}