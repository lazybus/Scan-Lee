import {
  imageBatchInputSchema,
  imageBatchRecordSchema,
  type BatchStatus,
  type ImageBatchInput,
  type ImageBatchRecord,
} from "@/lib/domain";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ImageBatchRow = Database["public"]["Tables"]["image_batches"]["Row"];
type DocumentStatusRow = Pick<
  Database["public"]["Tables"]["documents"]["Row"],
  "image_batch_id" | "status"
>;

export class ImageBatchesUnavailableError extends Error {
  constructor() {
    super("Image batches are unavailable until the latest database migration is applied.");
    this.name = "ImageBatchesUnavailableError";
  }
}

function isMissingImageBatchesSchemaError(error: { code?: string; message: string }) {
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.message.includes("Could not find the table 'public.image_batches' in the schema cache")
  );
}

function mapRow(
  row: ImageBatchRow,
  summary?: { documentCount: number; processedDocumentCount: number },
): ImageBatchRecord {
  return imageBatchRecordSchema.parse({
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    documentCount: summary?.documentCount,
    processedDocumentCount: summary?.processedDocumentCount,
  });
}

async function loadBatchSummaries(batchIds: string[]) {
  if (batchIds.length === 0) {
    return new Map<string, { documentCount: number; processedDocumentCount: number }>();
  }

  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("documents")
    .select("image_batch_id, status")
    .in("image_batch_id", batchIds);

  if (error) {
    if (isMissingImageBatchesSchemaError(error) || error.code === "42703") {
      return new Map<string, { documentCount: number; processedDocumentCount: number }>();
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as DocumentStatusRow[];
  const processedStatuses = new Set<BatchStatus | string>(["extracted", "reviewed", "completed"]);
  const counts = new Map<string, { documentCount: number; processedDocumentCount: number }>();

  for (const row of rows) {
    const current = counts.get(row.image_batch_id) ?? {
      documentCount: 0,
      processedDocumentCount: 0,
    };

    current.documentCount += 1;

    if (processedStatuses.has(row.status)) {
      current.processedDocumentCount += 1;
    }

    counts.set(row.image_batch_id, current);
  }

  return counts;
}

export async function listImageBatches(): Promise<ImageBatchRecord[]> {
  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("image_batches")
    .select("id, owner_user_id, name, description, status, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingImageBatchesSchemaError(error)) {
      throw new ImageBatchesUnavailableError();
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as ImageBatchRow[];
  const summaries = await loadBatchSummaries(rows.map((row) => row.id));

  return rows.map((row) => mapRow(row, summaries.get(row.id)));
}

export async function getImageBatchById(id: string): Promise<ImageBatchRecord | null> {
  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("image_batches")
    .select("id, owner_user_id, name, description, status, created_at, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingImageBatchesSchemaError(error)) {
      throw new ImageBatchesUnavailableError();
    }

    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as ImageBatchRow;
  const summaries = await loadBatchSummaries([row.id]);

  return mapRow(row, summaries.get(row.id));
}

export async function createImageBatch(input: ImageBatchInput): Promise<ImageBatchRecord> {
  const parsed = imageBatchInputSchema.parse(input);
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const id = crypto.randomUUID();
  const payload: Database["public"]["Tables"]["image_batches"]["Insert"] = {
    id,
    owner_user_id: user.id,
    name: parsed.name,
    description: parsed.description,
    status: parsed.status,
  };

  const { error } = await supabase.from("image_batches").insert(payload as never);

  if (error) {
    if (isMissingImageBatchesSchemaError(error)) {
      throw new ImageBatchesUnavailableError();
    }

    throw new Error(error.message);
  }

  const created = await getImageBatchById(id);

  if (!created) {
    throw new Error("Image batch was not created.");
  }

  return created;
}

export async function updateImageBatch(
  id: string,
  input: Partial<ImageBatchInput>,
): Promise<ImageBatchRecord | null> {
  const current = await getImageBatchById(id);

  if (!current) {
    return null;
  }

  const parsed = imageBatchInputSchema.partial().parse(input);
  const supabase = await createSupabaseServerComponentClient();
  const payload: Database["public"]["Tables"]["image_batches"]["Update"] = {
    name: parsed.name,
    description: parsed.description,
    status: parsed.status,
  };

  const { error } = await supabase.from("image_batches").update(payload as never).eq("id", id);

  if (error) {
    if (isMissingImageBatchesSchemaError(error)) {
      throw new ImageBatchesUnavailableError();
    }

    throw new Error(error.message);
  }

  return getImageBatchById(id);
}