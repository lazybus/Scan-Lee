import { notFound } from "next/navigation";

import { DocumentTypeEditor } from "@/components/document-type-editor";
import { getDocumentTypeById } from "@/lib/document-types";
import { requireUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function EditDocumentTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser("/document-types");
  const { id } = await params;
  const documentType = await getDocumentTypeById(id);

  if (!documentType) {
    notFound();
  }

  return (
    <DocumentTypeEditor
      currentUserId={user.id}
      initialDocumentType={documentType}
    />
  );
}