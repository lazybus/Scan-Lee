import { imageBatchInputSchema } from "@/lib/domain";
import { getImageBatchById, updateImageBatch } from "@/lib/image-batches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const item = await getImageBatchById(id);

  if (!item) {
    return Response.json({ error: "Image batch was not found." }, { status: 404 });
  }

  return Response.json({ item });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  try {
    const payload = imageBatchInputSchema.partial().parse(await request.json());
    const item = await updateImageBatch(id, payload);

    if (!item) {
      return Response.json({ error: "Image batch was not found." }, { status: 404 });
    }

    return Response.json({ item });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid image batch payload.",
      },
      { status: 400 },
    );
  }
}