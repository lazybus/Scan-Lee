"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  fieldKindValues,
  normalizeFieldKey,
  slugify,
  type DocumentType,
  type FieldDefinition,
} from "@/lib/domain";

type FieldDraft = {
  id: string;
  key: string;
  label: string;
  kind: FieldDefinition["kind"];
  required: boolean;
  aliases: string;
  description: string;
};

const defaultPrompt =
  "Extract this document into one JSON object only. Use the configured keys exactly. If a field is not visible or not legible, return null rather than guessing.";

function buildFieldDraft(): FieldDraft {
  return {
    id: crypto.randomUUID(),
    key: "",
    label: "",
    kind: "text",
    required: false,
    aliases: "",
    description: "",
  };
}

function buildFieldDraftFromDefinition(field: FieldDefinition): FieldDraft {
  return {
    id: crypto.randomUUID(),
    key: field.key,
    label: field.label,
    kind: field.kind,
    required: field.required,
    aliases: field.aliases.join(", "),
    description: field.description,
  };
}

function applyDocumentTypeToForm(documentType: DocumentType) {
  return {
    name: documentType.name,
    slug: documentType.slug,
    description: documentType.description,
    promptTemplate: documentType.promptTemplate,
    fields: documentType.fields.map(buildFieldDraftFromDefinition),
  };
}

export function DocumentTypesManager({
  initialDocumentTypes,
}: {
  initialDocumentTypes: DocumentType[];
}) {
  const router = useRouter();
  const [documentTypes, setDocumentTypes] = useState(initialDocumentTypes);
  const [editingDocumentTypeId, setEditingDocumentTypeId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [promptTemplate, setPromptTemplate] = useState(defaultPrompt);
  const [fields, setFields] = useState<FieldDraft[]>([buildFieldDraft()]);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dropFieldId, setDropFieldId] = useState<string | null>(null);
  const isEditing = editingDocumentTypeId !== null;

  const suggestedSlug = useMemo(() => slugify(name), [name]);

  function updateField(id: string, patch: Partial<FieldDraft>) {
    setFields((currentFields) =>
      currentFields.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    );
  }

  function removeField(id: string) {
    setFields((currentFields) => currentFields.filter((field) => field.id !== id));
  }

  function moveField(fieldId: string, targetFieldId: string) {
    if (fieldId === targetFieldId) {
      return;
    }

    setFields((currentFields) => {
      const sourceIndex = currentFields.findIndex((field) => field.id === fieldId);
      const targetIndex = currentFields.findIndex((field) => field.id === targetFieldId);

      if (sourceIndex < 0 || targetIndex < 0) {
        return currentFields;
      }

      const nextFields = [...currentFields];
      const [movedField] = nextFields.splice(sourceIndex, 1);
      nextFields.splice(targetIndex, 0, movedField);
      return nextFields;
    });
  }

  function moveFieldByOffset(fieldId: string, offset: -1 | 1) {
    setFields((currentFields) => {
      const sourceIndex = currentFields.findIndex((field) => field.id === fieldId);
      const targetIndex = sourceIndex + offset;

      if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= currentFields.length) {
        return currentFields;
      }

      const nextFields = [...currentFields];
      const [movedField] = nextFields.splice(sourceIndex, 1);
      nextFields.splice(targetIndex, 0, movedField);
      return nextFields;
    });
  }

  function resetForm() {
    setEditingDocumentTypeId(null);
    setName("");
    setSlug("");
    setDescription("");
    setPromptTemplate(defaultPrompt);
    setFields([buildFieldDraft()]);
    setDraggingFieldId(null);
    setDropFieldId(null);
  }

  function startEditing(documentType: DocumentType) {
    const nextForm = applyDocumentTypeToForm(documentType);

    setEditingDocumentTypeId(documentType.id);
    setName(nextForm.name);
    setSlug(nextForm.slug);
    setDescription(nextForm.description);
    setPromptTemplate(nextForm.promptTemplate);
    setFields(nextForm.fields.length > 0 ? nextForm.fields : [buildFieldDraft()]);
    setError(null);
    setMessage(`Editing ${documentType.name}.`);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    const payload = {
      name,
      slug: slug || suggestedSlug,
      description,
      promptTemplate,
      fields: fields.map((field) => ({
        key: normalizeFieldKey(field.key),
        label: field.label,
        kind: field.kind,
        required: field.required,
        aliases: field.aliases
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
        description: field.description,
      })),
    };

    startTransition(async () => {
      try {
        const endpoint = editingDocumentTypeId
          ? `/api/document-types/${editingDocumentTypeId}`
          : "/api/document-types";
        const method = editingDocumentTypeId ? "PATCH" : "POST";
        const response = await fetch(endpoint, {
          method,
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = (await response.json()) as {
          item?: DocumentType;
          error?: string;
        };

        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Document type could not be created.");
        }

        const item = data.item;

        setDocumentTypes((current) => {
          const nextItems = editingDocumentTypeId
            ? current.map((documentType) =>
                documentType.id === item.id ? item : documentType,
              )
            : [...current, item];

          return nextItems.sort((a, b) => a.name.localeCompare(b.name));
        });
        setMessage(
          editingDocumentTypeId ? `Updated ${item.name}.` : `Created ${item.name}.`,
        );
        resetForm();
        router.refresh();
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : isEditing
              ? "Document type could not be updated."
              : "Document type could not be created.",
        );
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className="paper-panel p-6 sm:p-8">
        <p className="data-label">Schema Registry</p>
        <h1 className="mt-3 text-3xl font-semibold">Document type configuration</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
          Each document type stores its expected fields and its prompt template. The
          extraction pipeline uses the schema as the output contract for Ollama.
        </p>
        <div className="mt-8 space-y-4">
          {documentTypes.map((documentType) => (
            <article
              key={documentType.id}
              className="border-2 border-[var(--ink)] bg-[var(--panel-strong)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{documentType.name}</h2>
                  <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                    {documentType.slug}
                  </p>
                </div>
                <span className="status-pill" data-state="uploaded">
                  {documentType.fields.length} fields
                </span>
              </div>
              <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                {documentType.description}
              </p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {documentType.fields.map((field) => (
                  <div
                    key={`${documentType.id}-${field.key}`}
                    className="schema-field-card p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium">{field.label}</p>
                      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                        {field.kind}
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                      {field.key}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => startEditing(documentType)}
                >
                  Edit Type
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="paper-panel p-6 sm:p-8">
        <p className="data-label">{isEditing ? "Edit Type" : "Create Type"}</p>
        <h2 className="mt-3 text-2xl font-semibold">
          {isEditing ? "Update extraction schema" : "New extraction schema"}
        </h2>
        <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
          {isEditing
            ? "Changes apply to the stored document type definition and future extraction runs. Existing extracted records remain unchanged."
            : "Create a reusable schema for a document layout and define the fields Ollama should return."}
        </p>
        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="data-label">Name</span>
            <input
              className="input-base"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Purchase order"
            />
          </label>

          <label className="block space-y-2">
            <span className="data-label">Slug</span>
            <input
              className="input-base font-mono"
              value={slug}
              onChange={(event) => setSlug(slugify(event.target.value))}
              placeholder={suggestedSlug || "purchase-order"}
            />
          </label>

          <label className="block space-y-2">
            <span className="data-label">Description</span>
            <textarea
              className="textarea-base"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Describe the document layout and what makes it distinct."
            />
          </label>

          <label className="block space-y-2">
            <span className="data-label">Prompt Template</span>
            <textarea
              className="textarea-base"
              value={promptTemplate}
              onChange={(event) => setPromptTemplate(event.target.value)}
            />
          </label>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="data-label">Expected Fields</span>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setFields((currentFields) => [...currentFields, buildFieldDraft()])}
              >
                Add Field
              </button>
            </div>
            <p className="text-sm leading-7 text-[var(--muted)]">
              Drag by the handle to change the saved field order. That same order is used
              when reviewing extracted documents.
            </p>
            {fields.map((field, index) => (
              <div
                key={field.id}
                className={`space-y-3 border-2 bg-[var(--panel-strong)] p-4 ${
                  dropFieldId === field.id
                    ? "border-[var(--accent-strong)]"
                    : "border-[var(--ink)]"
                }`}
                onDragLeave={() => {
                  if (dropFieldId === field.id) {
                    setDropFieldId(null);
                  }
                }}
                onDragOver={(event) => {
                  if (!draggingFieldId || draggingFieldId === field.id) {
                    return;
                  }

                  event.preventDefault();
                  setDropFieldId(field.id);
                }}
                onDrop={(event) => {
                  event.preventDefault();

                  if (draggingFieldId) {
                    moveField(draggingFieldId, field.id);
                  }

                  setDraggingFieldId(null);
                  setDropFieldId(null);
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      className="secondary-button px-3 py-2"
                      draggable
                      onDragEnd={() => {
                        setDraggingFieldId(null);
                        setDropFieldId(null);
                      }}
                      onDragStart={(event) => {
                        setDraggingFieldId(field.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", field.id);
                      }}
                      type="button"
                    >
                      Drag
                    </button>
                    <p className="font-medium uppercase tracking-[0.14em]">Field {index + 1}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <button
                      className="secondary-button px-3 py-2"
                      disabled={index === 0}
                      onClick={() => moveFieldByOffset(field.id, -1)}
                      type="button"
                    >
                      Up
                    </button>
                    <button
                      className="secondary-button px-3 py-2"
                      disabled={index === fields.length - 1}
                      onClick={() => moveFieldByOffset(field.id, 1)}
                      type="button"
                    >
                      Down
                    </button>
                    {fields.length > 1 ? (
                      <button
                        className="danger-button"
                        type="button"
                        onClick={() => removeField(field.id)}
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="data-label">Key</span>
                    <input
                      className="input-base font-mono"
                      value={field.key}
                      onChange={(event) =>
                        updateField(field.id, {
                          key: normalizeFieldKey(event.target.value),
                        })
                      }
                      placeholder="invoice_number"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="data-label">Label</span>
                    <input
                      className="input-base"
                      value={field.label}
                      onChange={(event) => updateField(field.id, { label: event.target.value })}
                      placeholder="Invoice Number"
                    />
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block space-y-2">
                    <span className="data-label">Kind</span>
                    <select
                      className="select-base"
                      value={field.kind}
                      onChange={(event) =>
                        updateField(field.id, {
                          kind: event.target.value as FieldDefinition["kind"],
                        })
                      }
                    >
                      {fieldKindValues.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="schema-toggle">
                    <input
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={field.required}
                      onChange={(event) =>
                        updateField(field.id, { required: event.target.checked })
                      }
                      type="checkbox"
                    />
                    <span className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink)]">
                      Required field
                    </span>
                  </label>
                </div>
                <label className="block space-y-2">
                  <span className="data-label">Aliases</span>
                  <input
                    className="input-base"
                    value={field.aliases}
                    onChange={(event) => updateField(field.id, { aliases: event.target.value })}
                    placeholder="invoice #, ref, reference"
                  />
                </label>
                <label className="block space-y-2">
                  <span className="data-label">Description</span>
                  <textarea
                    className="textarea-base"
                    value={field.description}
                    onChange={(event) =>
                      updateField(field.id, { description: event.target.value })
                    }
                    placeholder="How the value should be interpreted by the model."
                  />
                </label>
              </div>
            ))}
          </div>

          {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

          <div className="flex flex-wrap gap-3">
            <button className="action-button flex-1" disabled={isPending} type="submit">
              {isPending ? "Saving…" : isEditing ? "Update Document Type" : "Save Document Type"}
            </button>
            {isEditing ? (
              <button
                className="secondary-button"
                disabled={isPending}
                onClick={resetForm}
                type="button"
              >
                Cancel Edit
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}