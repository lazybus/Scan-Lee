import { createHash } from "node:crypto";
import { mkdirSync, readFileSync } from "node:fs";
import { readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const dataDirectory = join(process.cwd(), "data");
const uploadDirectory = join(dataDirectory, "uploads");

function ensureUploadDirectory() {
  mkdirSync(uploadDirectory, { recursive: true });
}

export type StoredFile = {
  filePath: string;
  mimeType: string;
  originalName: string;
  sha256: string;
};

export async function saveUploadedFile(file: File): Promise<StoredFile> {
  ensureUploadDirectory();

  const extension = extname(file.name) || ".bin";
  const fileName = `${crypto.randomUUID()}${extension.toLowerCase()}`;
  const relativePath = `uploads/${fileName}`;
  const absolutePath = join(dataDirectory, ...relativePath.split("/"));
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");

  await writeFile(absolutePath, buffer);

  return {
    filePath: relativePath,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name,
    sha256,
  };
}

export function readStoredFileAsBase64(filePath: string): string {
  const absolutePath = join(dataDirectory, ...filePath.split("/"));
  return readFileSync(absolutePath).toString("base64");
}

export async function readStoredFileBuffer(filePath: string): Promise<Buffer> {
  const absolutePath = join(dataDirectory, ...filePath.split("/"));
  return readFile(absolutePath);
}

export async function deleteStoredFile(filePath: string): Promise<void> {
  const absolutePath = join(dataDirectory, ...filePath.split("/"));
  await rm(absolutePath, { force: true });
}

export function getAbsoluteDataDirectory(): string {
  return dataDirectory;
}