import { notFound } from "next/navigation";

import { DocumentTypeEditor } from "@/components/document-type-editor";
import { getDocumentTypeById } from "@/lib/document-types";

export const dynamic = "force-dynamic";

export default async function EditDocumentTypePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const documentType = getDocumentTypeById(id);

  if (!documentType) {
    notFound();
  }

  return <DocumentTypeEditor initialDocumentType={documentType} />;
}