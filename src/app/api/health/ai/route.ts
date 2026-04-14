import { getGoogleAiStatus } from "@/lib/google-ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getGoogleAiStatus();
  return Response.json(status, { status: status.connected ? 200 : 503 });
}