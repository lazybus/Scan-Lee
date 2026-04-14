import { getDocumentTypeById } from "@/lib/document-types";
import { createDocument, listDocuments } from "@/lib/documents";
import { saveUploadedFile } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ items: await listDocuments() });
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const fallbackDocumentTypeId = String(formData.get("documentTypeId") ?? "");
  const documentTypeIds = formData
    .getAll("documentTypeIds")
    .map((entry) => String(entry ?? ""));
  const files = formData
    .getAll("files")
    .filter((entry): entry is File => entry instanceof File);

  if (files.length === 0) {
    const fallbackFile = formData.get("file");

    if (fallbackFile instanceof File) {
      files.push(fallbackFile);
    }
  }

  if (files.length === 0) {
    return Response.json({ error: "At least one image file is required." }, { status: 400 });
  }

  if (documentTypeIds.length > 0 && documentTypeIds.length !== files.length) {
    return Response.json(
      { error: "Each uploaded file must include a matching document type." },
      { status: 400 },
    );
  }

  const items = [];

  for (const [index, file] of files.entries()) {
    const documentTypeId = documentTypeIds[index] ?? fallbackDocumentTypeId;

    if (!documentTypeId) {
      return Response.json({ error: "Document type is required." }, { status: 400 });
    }

    const documentType = await getDocumentTypeById(documentTypeId);

    if (!documentType) {
      return Response.json({ error: "Document type was not found." }, { status: 404 });
    }

    const storedFile = await saveUploadedFile(file);
    const item = await createDocument({ documentTypeId, storedFile });

    items.push(item);
  }

  return Response.json({ item: items[0], items }, { status: 201 });
}