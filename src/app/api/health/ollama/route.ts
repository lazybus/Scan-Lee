import { getOllamaStatus } from "@/lib/ollama";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const status = await getOllamaStatus();
  return Response.json(status, { status: status.connected ? 200 : 503 });
}