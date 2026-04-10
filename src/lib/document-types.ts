import { getDatabase } from "@/lib/db";
import {
  documentTypeInputSchema,
  documentTypeSchema,
  type DocumentType,
  type DocumentTypeInput,
  type FieldDefinition,
} from "@/lib/domain";

type DocumentTypeRow = {
  id: string;
  name: string;
  slug: string;
  description: string;
  prompt_template: string;
  field_definitions: string;
  created_at: string;
  updated_at: string;
};

function mapRow(row: DocumentTypeRow): DocumentType {
  return documentTypeSchema.parse({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    promptTemplate: row.prompt_template,
    fields: JSON.parse(row.field_definitions) as FieldDefinition[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

export function listDocumentTypes(): DocumentType[] {
  const db = getDatabase();
  const rows = db
    .prepare(
      `
        SELECT id, name, slug, description, prompt_template, field_definitions, created_at, updated_at
        FROM document_types
        ORDER BY name ASC
      `,
    )
    .all() as DocumentTypeRow[];

  return rows.map(mapRow);
}

export function getDocumentTypeById(id: string): DocumentType | null {
  const db = getDatabase();
  const row = db
    .prepare(
      `
        SELECT id, name, slug, description, prompt_template, field_definitions, created_at, updated_at
        FROM document_types
        WHERE id = ?
      `,
    )
    .get(id) as DocumentTypeRow | undefined;

  return row ? mapRow(row) : null;
}

export function createDocumentType(input: DocumentTypeInput): DocumentType {
  const parsed = documentTypeInputSchema.parse(input);
  const db = getDatabase();
  const id = crypto.randomUUID();

  db.prepare(
    `
      INSERT INTO document_types (
        id,
        name,
        slug,
        description,
        prompt_template,
        field_definitions,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `,
  ).run(
    id,
    parsed.name,
    parsed.slug,
    parsed.description,
    parsed.promptTemplate,
    JSON.stringify(parsed.fields),
  );

  const created = getDocumentTypeById(id);

  if (!created) {
    throw new Error("Document type was not created.");
  }

  return created;
}

export function updateDocumentType(
  id: string,
  input: DocumentTypeInput,
): DocumentType | null {
  const parsed = documentTypeInputSchema.parse(input);
  const db = getDatabase();

  const result = db.prepare(
    `
      UPDATE document_types
      SET
        name = ?,
        slug = ?,
        description = ?,
        prompt_template = ?,
        field_definitions = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `,
  ).run(
    parsed.name,
    parsed.slug,
    parsed.description,
    parsed.promptTemplate,
    JSON.stringify(parsed.fields),
    id,
  );

  if (result.changes === 0) {
    return null;
  }

  return getDocumentTypeById(id);
}