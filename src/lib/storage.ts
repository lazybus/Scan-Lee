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

const assistantSampleDirectoryName = "assistant-samples";

type OwnedStorageOptions = {
  directory?: string;
  ownerUserId?: string;
  timestamped?: boolean;
};

function buildOwnedStoragePrefix(userId: string, directory?: string) {
  return directory ? `${userId}/${directory}` : userId;
}

async function requireCurrentUserId() {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  return {
    supabase,
    userId: user.id,
  };
}

async function saveFileForCurrentUser(file: File, options: OwnedStorageOptions = {}): Promise<StoredFile> {
  const { directory, ownerUserId, timestamped } = options;
  const session = ownerUserId
    ? {
        supabase: await createSupabaseServerComponentClient(),
        userId: ownerUserId,
      }
    : await requireCurrentUserId();
  const { supabase, userId } = session;
  const extension = extname(file.name) || ".bin";
  const prefix = buildOwnedStoragePrefix(userId, directory);
  const fileName = timestamped
    ? `${Date.now()}-${crypto.randomUUID()}${extension.toLowerCase()}`
    : `${crypto.randomUUID()}${extension.toLowerCase()}`;
  const objectPath = `${prefix}/${fileName}`;
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

export async function saveUploadedFile(file: File, ownerUserId?: string): Promise<StoredFile> {
  return saveFileForCurrentUser(file, {
    ownerUserId,
  });
}

export async function saveAssistantSample(file: File): Promise<StoredFile> {
  return saveFileForCurrentUser(file, {
    directory: assistantSampleDirectoryName,
    timestamped: true,
  });
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

export function isOwnedAssistantSamplePath(userId: string, filePath: string): boolean {
  const normalizedPath = filePath.trim().replace(/\\/g, "/");
  const ownedPrefix = `${buildOwnedStoragePrefix(userId, assistantSampleDirectoryName)}/`;

  return (
    normalizedPath.length > ownedPrefix.length &&
    normalizedPath.startsWith(ownedPrefix) &&
    !normalizedPath.includes("..")
  );
}

export function assertOwnedAssistantSamplePath(userId: string, filePath: string): string {
  if (!isOwnedAssistantSamplePath(userId, filePath)) {
    throw new Error("Assistant sample was not found.");
  }

  return filePath.trim().replace(/\\/g, "/");
}

export async function deleteAssistantSample(userId: string, filePath: string): Promise<void> {
  await deleteStoredFile(assertOwnedAssistantSamplePath(userId, filePath));
}

export async function sweepStaleAssistantSamples(userId: string, maxAgeMs = 6 * 60 * 60 * 1000): Promise<void> {
  const { supabase } = await requireCurrentUserId();
  const bucketName = getSupabaseStorageBucket();
  const prefix = buildOwnedStoragePrefix(userId, assistantSampleDirectoryName);
  const { data, error } = await supabase.storage.from(bucketName).list(prefix, {
    limit: 100,
    sortBy: {
      column: "name",
      order: "asc",
    },
  });

  if (error || !data) {
    return;
  }

  const cutoff = Date.now() - maxAgeMs;
  const stalePaths = data
    .map((entry) => {
      const timestamp = Number.parseInt(entry.name.split("-")[0] ?? "", 10);

      if (!Number.isFinite(timestamp) || timestamp > cutoff) {
        return null;
      }

      return `${prefix}/${entry.name}`;
    })
    .filter((value): value is string => Boolean(value));

  if (stalePaths.length === 0) {
    return;
  }

  await supabase.storage.from(bucketName).remove(stalePaths);
}

export function getAbsoluteDataDirectory(): string {
  return process.cwd();
}