import { imageBatchInputSchema } from "@/lib/domain";
import { getImageBatchById, updateImageBatch } from "@/lib/image-batches";
import { requireRouteUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const routeUser = await requireRouteUser();

  if (routeUser instanceof Response) {
    return routeUser;
  }

  const user = routeUser;

  const { id } = await context.params;
  const item = await getImageBatchById(id);

  if (!item || item.ownerUserId !== user.id) {
    return Response.json({ error: "Image batch was not found." }, { status: 404 });
  }

  return Response.json({ item });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const routeUser = await requireRouteUser();

  if (routeUser instanceof Response) {
    return routeUser;
  }

  const user = routeUser;

  const { id } = await context.params;
  const existing = await getImageBatchById(id);

  if (!existing || existing.ownerUserId !== user.id) {
    return Response.json({ error: "Image batch was not found." }, { status: 404 });
  }

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