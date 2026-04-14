import { createHash } from "node:crypto";
import { extname } from "node:path";

import { getSupabaseStorageBucket } from "@/lib/supabase/config";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";

export type StoredFile = {
  bucketName: string;
  filePath: string;
  mimeType: string;
  originalName: string;
  sha256: string;
};

export async function saveUploadedFile(file: File): Promise<StoredFile> {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const extension = extname(file.name) || ".bin";
  const objectPath = `${user.id}/${crypto.randomUUID()}${extension.toLowerCase()}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const bucketName = getSupabaseStorageBucket();

  const { error } = await supabase.storage.from(bucketName).upload(objectPath, buffer, {
    contentType: file.type || "application/octet-stream",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    bucketName,
    filePath: objectPath,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name,
    sha256,
  };
}

export async function readStoredFileAsBase64(
  filePath: string,
  bucketName = getSupabaseStorageBucket(),
): Promise<string> {
  const buffer = await readStoredFileBuffer(filePath, bucketName);
  return buffer.toString("base64");
}

export async function readStoredFileBuffer(
  filePath: string,
  bucketName = getSupabaseStorageBucket(),
): Promise<Buffer> {
  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase.storage.from(bucketName).download(filePath);

  if (error || !data) {
    throw new Error(error?.message ?? "Stored file could not be read.");
  }

  return Buffer.from(await data.arrayBuffer());
}

export async function deleteStoredFile(
  filePath: string,
  bucketName = getSupabaseStorageBucket(),
): Promise<void> {
  const supabase = await createSupabaseServerComponentClient();
  const { error } = await supabase.storage.from(bucketName).remove([filePath]);

  if (error) {
    throw new Error(error.message);
  }
}

export function getAbsoluteDataDirectory(): string {
  return process.cwd();
}