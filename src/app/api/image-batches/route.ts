import { createImageBatch, listImageBatches } from "@/lib/image-batches";
import { imageBatchInputSchema } from "@/lib/domain";
import { requireRouteUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const routeUser = await requireRouteUser();

  if (routeUser instanceof Response) {
    return routeUser;
  }

  return Response.json({ items: await listImageBatches() });
}

export async function POST(request: Request) {
  const routeUser = await requireRouteUser();

  if (routeUser instanceof Response) {
    return routeUser;
  }

  try {
    const payload = imageBatchInputSchema.parse(await request.json());
    const item = await createImageBatch(payload);

    return Response.json({ item }, { status: 201 });
  } catch (error) {
    return Response.json(
      {
        error: error instanceof Error ? error.message : "Invalid image batch payload.",
      },
      { status: 400 },
    );
  }
}