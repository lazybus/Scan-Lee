import * as XLSX from "xlsx";

import { getExportRows } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const batchId = searchParams.get("batchId") ?? undefined;
  const documentTypeId = searchParams.get("documentTypeId") ?? undefined;

  if (!batchId) {
    return Response.json({ error: "A batchId query parameter is required." }, { status: 400 });
  }

  const rows = await getExportRows({ batchId, documentTypeId });

  if (rows.length === 0) {
    return Response.json({ error: "No extracted rows are available for export." }, { status: 404 });
  }

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, "Records");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="scanlee-batch-export.xlsx"',
    },
  });
}