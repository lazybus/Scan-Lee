import { mkdirSync } from "node:fs";
import { join } from "node:path";

import Database from "better-sqlite3";

const dataDirectory = join(process.cwd(), "data");
const databasePath = join(dataDirectory, "scanlee.sqlite");

let database: Database.Database | undefined;

function seedDefaultDocumentTypes(db: Database.Database) {
  const defaults = [
    {
      id: crypto.randomUUID(),
      name: "Invoice",
      slug: "invoice",
      description:
        "General vendor invoice extraction with core header fields and payment totals.",
      promptTemplate:
        "Extract the invoice into strict JSON only. Preserve vendor names and invoice numbers exactly as written. Use null when a value is not visible.",
      fields: JSON.stringify([
        {
          key: "vendor_name",
          label: "Vendor Name",
          kind: "text",
          required: true,
          aliases: ["supplier", "from", "bill from"],
          description: "Company or person issuing the invoice.",
        },
        {
          key: "invoice_number",
          label: "Invoice Number",
          kind: "text",
          required: true,
          aliases: ["invoice #", "reference"],
          description: "The invoice identifier.",
        },
        {
          key: "invoice_date",
          label: "Invoice Date",
          kind: "date",
          required: true,
          aliases: ["date issued", "invoice date"],
          description: "Date the invoice was created.",
        },
        {
          key: "due_date",
          label: "Due Date",
          kind: "date",
          required: false,
          aliases: ["payment due", "due on"],
          description: "Date payment is due.",
        },
        {
          key: "total_amount",
          label: "Total Amount",
          kind: "currency",
          required: true,
          aliases: ["amount due", "balance due", "total"],
          description: "Final total after taxes and discounts.",
        },
      ]),
    },
    {
      id: crypto.randomUUID(),
      name: "Cheque",
      slug: "cheque",
      description:
        "Cheque extraction for payee, amount, cheque number, and issued date.",
      promptTemplate:
        "Extract the cheque into strict JSON only. Keep payee text as written. If handwritten text is unclear, return null for the field rather than guessing.",
      fields: JSON.stringify([
        {
          key: "payee",
          label: "Payee",
          kind: "text",
          required: true,
          aliases: ["pay to the order of"],
          description: "Person or business receiving the cheque.",
        },
        {
          key: "cheque_number",
          label: "Cheque Number",
          kind: "text",
          required: true,
          aliases: ["check number", "serial"],
          description: "Printed cheque identifier.",
        },
        {
          key: "issue_date",
          label: "Issue Date",
          kind: "date",
          required: true,
          aliases: ["date"],
          description: "The date written on the cheque.",
        },
        {
          key: "amount_numeric",
          label: "Amount Numeric",
          kind: "currency",
          required: true,
          aliases: ["amount", "numeric amount"],
          description: "The boxed numeric amount.",
        },
        {
          key: "amount_written",
          label: "Amount Written",
          kind: "text",
          required: false,
          aliases: ["amount in words"],
          description: "The written-out amount line.",
        },
      ]),
    },
  ];

  const existingCount = db
    .prepare("SELECT COUNT(*) as count FROM document_types")
    .get() as { count: number };

  if (existingCount.count > 0) {
    return;
  }

  const insertStatement = db.prepare(`
    INSERT INTO document_types (
      id,
      name,
      slug,
      description,
      prompt_template,
      field_definitions,
      created_at,
      updated_at
    ) VALUES (
      @id,
      @name,
      @slug,
      @description,
      @promptTemplate,
      @fields,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    )
  `);

  const transaction = db.transaction((records: typeof defaults) => {
    for (const record of records) {
      insertStatement.run(record);
    }
  });

  transaction(defaults);
}

function initializeDatabase(db: Database.Database) {
  db.pragma("journal_mode = WAL");

  db.exec(`
    CREATE TABLE IF NOT EXISTS document_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      prompt_template TEXT NOT NULL,
      field_definitions TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      document_type_id TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      file_path TEXT NOT NULL,
      sha256 TEXT NOT NULL,
      status TEXT NOT NULL,
      model_name TEXT,
      extracted_data TEXT,
      reviewed_data TEXT,
      raw_response TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (document_type_id) REFERENCES document_types(id)
    );

    CREATE INDEX IF NOT EXISTS idx_documents_document_type
      ON documents(document_type_id);

    CREATE INDEX IF NOT EXISTS idx_documents_status
      ON documents(status);
  `);

  seedDefaultDocumentTypes(db);
}

export function getDatabase(): Database.Database {
  if (database) {
    return database;
  }

  mkdirSync(dataDirectory, { recursive: true });
  database = new Database(databasePath);
  initializeDatabase(database);
  return database;
}

export function getDatabasePath(): string {
  return databasePath;
}