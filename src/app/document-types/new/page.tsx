import { DocumentTypeEditor } from "@/components/document-type-editor";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewDocumentTypePage() {
  const user = await requireUser("/document-types/new");

  return <DocumentTypeEditor currentUserId={user.id} />;
}