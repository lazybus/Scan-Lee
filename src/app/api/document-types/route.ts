import { createDocumentType, listDocumentTypes } from "@/lib/document-types";
import { documentTypeInputSchema, slugify } from "@/lib/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ items: listDocumentTypes() });
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;
    const parsed = documentTypeInputSchema.parse({
      ...payload,
      slug: slugify(String(payload.slug ?? payload.name ?? "")),
    });

    const item = createDocumentType(parsed);
    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid document type payload.",
      },
      { status: 400 },
    );
  }
}