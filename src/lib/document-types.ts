import { PostgrestError } from "@supabase/supabase-js";

import {
  documentTypeInputSchema,
  documentTypeSchema,
  type DocumentType,
  type DocumentTypeInput,
  type FieldDefinition,
} from "@/lib/domain";
import { createSupabaseServerComponentClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type DocumentTypeMutationOptions = {
  isPublic?: boolean;
};

type DocumentTypeRow = Database["public"]["Tables"]["document_types"]["Row"];

function mapRow(row: DocumentTypeRow): DocumentType {
  return documentTypeSchema.parse({
    id: row.id,
    ownerUserId: row.owner_user_id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    promptTemplate: row.prompt_template,
    fields: row.field_definitions as FieldDefinition[],
    isPublic: row.is_public,
    isSystem: row.is_system,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function isMissingTableError(error: PostgrestError | null) {
  return error?.code === "42P01";
}

export async function listDocumentTypes(): Promise<DocumentType[]> {
  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("document_types")
    .select(
      "id, owner_user_id, name, slug, description, prompt_template, field_definitions, is_public, is_system, created_at, updated_at",
    )
    .order("is_system", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    if (isMissingTableError(error)) {
      return [];
    }

    throw new Error(error.message);
  }

  const rows = (data ?? []) as DocumentTypeRow[];
  return rows.map(mapRow);
}

export async function getDocumentTypeById(id: string): Promise<DocumentType | null> {
  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("document_types")
    .select(
      "id, owner_user_id, name, slug, description, prompt_template, field_definitions, is_public, is_system, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingTableError(error)) {
      return null;
    }

    throw new Error(error.message);
  }

  return data ? mapRow(data as DocumentTypeRow) : null;
}

async function requireDocumentTypeOwnerAccess(documentType: DocumentType) {
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  if (documentType.isSystem || documentType.ownerUserId !== user.id) {
    throw new Error("This template is read-only. Duplicate it to your account before editing.");
  }

  return user;
}

async function buildDuplicateSlug(baseSlug: string, ownerUserId: string) {
  const supabase = await createSupabaseServerComponentClient();
  const { data, error } = await supabase
    .from("document_types")
    .select("slug")
    .eq("owner_user_id", ownerUserId);

  if (error) {
    throw new Error(error.message);
  }

  const existingSlugs = new Set(
    ((data ?? []) as Array<{ slug: string }>).map((item) => item.slug),
  );
  let nextSlug = `${baseSlug}-copy`;
  let suffix = 2;

  while (existingSlugs.has(nextSlug)) {
    nextSlug = `${baseSlug}-copy-${suffix}`;
    suffix += 1;
  }

  return nextSlug;
}

export async function createDocumentType(
  input: DocumentTypeInput,
  options: DocumentTypeMutationOptions = {},
): Promise<DocumentType> {
  const parsed = documentTypeInputSchema.parse(input);
  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  const id = crypto.randomUUID();
  const insertPayload: Database["public"]["Tables"]["document_types"]["Insert"] = {
    id,
    owner_user_id: user.id,
    name: parsed.name,
    slug: parsed.slug,
    description: parsed.description,
    prompt_template: parsed.promptTemplate,
    field_definitions: parsed.fields,
    is_public: options.isPublic ?? false,
    is_system: false,
  };
  const { error } = await supabase.from("document_types").insert(insertPayload as never);

  if (error) {
    throw new Error(error.message);
  }

  const created = await getDocumentTypeById(id);

  if (!created) {
    throw new Error("Document type was not created.");
  }

  return created;
}

export async function updateDocumentType(
  id: string,
  input: DocumentTypeInput,
  options: DocumentTypeMutationOptions = {},
): Promise<DocumentType | null> {
  const parsed = documentTypeInputSchema.parse(input);
  const supabase = await createSupabaseServerComponentClient();
  const existing = await getDocumentTypeById(id);

  if (!existing) {
    return null;
  }

  await requireDocumentTypeOwnerAccess(existing);

  const updatePayload: Database["public"]["Tables"]["document_types"]["Update"] = {
    name: parsed.name,
    slug: parsed.slug,
    description: parsed.description,
    prompt_template: parsed.promptTemplate,
    field_definitions: parsed.fields,
    is_public: options.isPublic ?? existing.isPublic ?? false,
  };

  const { error } = await supabase
    .from("document_types")
    .update(updatePayload as never)
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  const updated = await getDocumentTypeById(id);

  if (!updated) {
    return null;
  }

  return updated;
}

export async function duplicateDocumentType(id: string): Promise<DocumentType> {
  const source = await getDocumentTypeById(id);

  if (!source) {
    throw new Error("Document type was not found.");
  }

  const supabase = await createSupabaseServerComponentClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Authentication required.");
  }

  if (!source.isSystem && source.ownerUserId === user.id) {
    throw new Error("This template already belongs to your account.");
  }

  const duplicatedName = source.name.endsWith("(Copy)")
    ? source.name
    : `${source.name} (Copy)`;
  const duplicatedSlug = await buildDuplicateSlug(source.slug, user.id);

  return createDocumentType(
    {
      name: duplicatedName,
      slug: duplicatedSlug,
      description: source.description,
      promptTemplate: source.promptTemplate,
      fields: source.fields,
    },
    { isPublic: false },
  );
}