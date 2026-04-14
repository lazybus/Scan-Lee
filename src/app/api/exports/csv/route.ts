import * as XLSX from "xlsx";

import { getExportRows } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const documentTypeId = searchParams.get("documentTypeId") ?? undefined;
  const rows = await getExportRows(documentTypeId);

  if (rows.length === 0) {
    return Response.json({ error: "No extracted rows are available for export." }, { status: 404 });
  }

  const worksheet = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(worksheet);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="scanlee-export.csv"',
    },
  });
}