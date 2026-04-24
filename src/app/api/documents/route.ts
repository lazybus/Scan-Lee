import { getDocumentTypeById } from "@/lib/document-types";
import { createDocument, listDocuments } from "@/lib/documents";
import { getImageBatchById } from "@/lib/image-batches";
import { saveUploadedFile } from "@/lib/storage";
import { requireRouteUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const routeUser = await requireRouteUser();

  if (routeUser instanceof Response) {
    return routeUser;
  }

  const user = routeUser;

  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId") ?? undefined;

  if (batchId) {
    const imageBatch = await getImageBatchById(batchId);

    if (!imageBatch || imageBatch.ownerUserId !== user.id) {
      return Response.json({ error: "Image batch was not found." }, { status: 404 });
    }
  }

  return Response.json({ items: await listDocuments({ batchId }) });
}

export async function POST(request: Request) {
  const routeUser = await requireRouteUser();

  if (routeUser instanceof Response) {
    return routeUser;
  }

  const user = routeUser;

  const formData = await request.formData();
  const fallbackDocumentTypeId = String(formData.get("documentTypeId") ?? "");
  const imageBatchId = String(formData.get("imageBatchId") ?? "");
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

  if (!imageBatchId) {
    return Response.json({ error: "Image batch is required." }, { status: 400 });
  }

  const imageBatch = await getImageBatchById(imageBatchId);

  if (!imageBatch || imageBatch.ownerUserId !== user.id) {
    return Response.json({ error: "Image batch was not found." }, { status: 404 });
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

    const storedFile = await saveUploadedFile(file, user.id);
    const item = await createDocument({ imageBatchId, documentTypeId, ownerUserId: user.id, storedFile });

    items.push(item);
  }

  return Response.json({ item: items[0], items }, { status: 201 });
}