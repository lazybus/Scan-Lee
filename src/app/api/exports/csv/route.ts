import { getExportRows } from "@/lib/documents";
import { getImageBatchById } from "@/lib/image-batches";
import { requireRouteUser } from "@/lib/supabase/server";

function escapeCsvValue(value: unknown) {
  if (value == null) {
    return "";
  }

  const stringValue =
    typeof value === "string"
      ? value
      : typeof value === "number" || typeof value === "boolean"
        ? String(value)
        : JSON.stringify(value);

  if (/[,"\r\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

function toCsv(rows: Array<Record<string, unknown>>) {
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const lines = [headers.map((header) => escapeCsvValue(header)).join(",")];

  for (const row of rows) {
    lines.push(headers.map((header) => escapeCsvValue(row[header])).join(","));
  }

  return `${lines.join("\r\n")}\r\n`;
}

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
  const documentTypeId = searchParams.get("documentTypeId") ?? undefined;

  if (!batchId) {
    return Response.json({ error: "A batchId query parameter is required." }, { status: 400 });
  }

  const imageBatch = await getImageBatchById(batchId);

  if (!imageBatch || imageBatch.ownerUserId !== user.id) {
    return Response.json({ error: "Image batch was not found." }, { status: 404 });
  }

  const rows = await getExportRows({ batchId, documentTypeId });

  if (rows.length === 0) {
    return Response.json({ error: "No extracted rows are available for export." }, { status: 404 });
  }

  const csv = toCsv(rows);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scanlee-batch-export.csv"',
    },
  });
}