"use client";

import {
  faChevronDown,
  faChevronUp,
  faExpand,
  faList,
  faPlus,
  faTableColumns,
  faTrashCan,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { DocumentTypeAssistant } from "@/components/document-type-assistant";
import {
  fieldKindValues,
  normalizeFieldKey,
  scalarFieldKindValues,
  slugify,
  type DocumentType,
  type DocumentTypeInput,
  type FieldDefinition,
  type ProductColumnDefinition,
} from "@/lib/domain";

type ReorderState = {
  scope: string;
  itemId: string;
};

type DragPreviewState = {
  title: string;
  subtitle: string;
  x: number;
  y: number;
};

type ProductColumnDraft = {
  id: string;
  key: string;
  label: string;
  kind: ProductColumnDefinition["kind"];
  required: boolean;
  aliases: string;
  description: string;
};

type FieldDraft = {
  id: string;
  key: string;
  label: string;
  kind: FieldDefinition["kind"];
  required: boolean;
  aliases: string;
  description: string;
  columns: ProductColumnDraft[];
};

type FieldLayoutMode = "single" | "double";
type ColumnLayoutMode = "single" | "double";

const defaultPrompt =
  "Extract this document into one JSON object only. Use the configured keys exactly. If a field is not visible or not legible, return null rather than guessing.";

let draftIdSequence = 0;

function nextDraftId(prefix: "field" | "column") {
  draftIdSequence += 1;
  return `${prefix}-${draftIdSequence}`;
}

function buildProductColumnDraft(): ProductColumnDraft {
  return {
    id: nextDraftId("column"),
    key: "",
    label: "",
    kind: "text",
    required: false,
    aliases: "",
    description: "",
  };
}

function buildProductColumnDraftFromDefinition(
  column: ProductColumnDefinition,
): ProductColumnDraft {
  return {
    id: nextDraftId("column"),
    key: column.key,
    label: column.label,
    kind: column.kind,
    required: column.required,
    aliases: column.aliases.join(", "),
    description: column.description,
  };
}

function buildFieldDraft(): FieldDraft {
  return {
    id: nextDraftId("field"),
    key: "",
    label: "",
    kind: "text",
    required: false,
    aliases: "",
    description: "",
    columns: [buildProductColumnDraft()],
  };
}

function buildFieldDraftFromDefinition(field: FieldDefinition): FieldDraft {
  return {
    id: nextDraftId("field"),
    key: field.key,
    label: field.label,
    kind: field.kind,
    required: field.required,
    aliases: field.aliases.join(", "),
    description: field.description,
    columns:
      field.kind === "table"
        ? field.columns.map(buildProductColumnDraftFromDefinition)
        : [buildProductColumnDraft()],
  };
}

function buildFormState(documentType?: DocumentType | null) {
  if (!documentType) {
    return {
      name: "",
      slug: "",
      description: "",
      promptTemplate: defaultPrompt,
      isPublic: false,
      fields: [buildFieldDraft()],
    };
  }

  return {
    name: documentType.name,
    slug: documentType.slug,
    description: documentType.description,
    promptTemplate: documentType.promptTemplate,
    isPublic: documentType.isPublic ?? false,
    fields: documentType.fields.map(buildFieldDraftFromDefinition),
  };
}

function moveListItem<T>(items: T[], sourceIndex: number, targetIndex: number) {
  if (
    sourceIndex < 0 ||
    targetIndex < 0 ||
    sourceIndex >= items.length ||
    targetIndex >= items.length ||
    sourceIndex === targetIndex
  ) {
    return items;
  }

  const nextItems = [...items];
  const [movedItem] = nextItems.splice(sourceIndex, 1);
  nextItems.splice(targetIndex, 0, movedItem);
  return nextItems;
}

function getFieldDisplayLabel(field: FieldDraft, index: number) {
  const trimmedLabel = field.label.trim();
  return trimmedLabel || `Field ${index + 1}`;
}

function getColumnDisplayLabel(column: ProductColumnDraft, index: number) {
  const trimmedLabel = column.label.trim();
  return trimmedLabel || `Column ${index + 1}`;
}

function buildColumnReorderScope(fieldId: string) {
  return `columns:${fieldId}`;
}

export function DocumentTypeEditor({
  currentUserId,
  initialDocumentType,
}: {
  currentUserId?: string;
  initialDocumentType?: DocumentType | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeReorder, setActiveReorder] = useState<ReorderState | null>(null);
  const [dropTarget, setDropTarget] = useState<ReorderState | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);
  const [editingDocumentTypeId, setEditingDocumentTypeId] = useState<string | null>(
    initialDocumentType?.id ?? null,
  );
  const initialForm = useMemo(() => buildFormState(initialDocumentType), [initialDocumentType]);
  const [name, setName] = useState(initialForm.name);
  const [slug, setSlug] = useState(initialForm.slug);
  const [description, setDescription] = useState(initialForm.description);
  const [promptTemplate, setPromptTemplate] = useState(initialForm.promptTemplate);
  const [isPublic, setIsPublic] = useState(initialForm.isPublic);
  const [fields, setFields] = useState<FieldDraft[]>(initialForm.fields);
  const [fieldLayoutMode, setFieldLayoutMode] = useState<FieldLayoutMode>("double");
  const [columnLayoutModes, setColumnLayoutModes] = useState<Record<string, ColumnLayoutMode>>({});
  const [expandedFieldIds, setExpandedFieldIds] = useState<Set<string>>(() => new Set());
  const [expandedColumnIds, setExpandedColumnIds] = useState<Set<string>>(() => new Set());
  const [fullWidthFieldId, setFullWidthFieldId] = useState<string | null>(null);
  const [fullWidthColumnIds, setFullWidthColumnIds] = useState<Record<string, string | null>>({});
  const isEditing = editingDocumentTypeId !== null;
  const suggestedSlug = useMemo(() => slugify(name), [name]);
  const isOwnedByCurrentUser =
    currentUserId !== undefined && initialDocumentType?.ownerUserId === currentUserId;
  const isReadOnly = Boolean(isEditing && (!isOwnedByCurrentUser || initialDocumentType?.isSystem));
  const canDuplicate = Boolean(isEditing && isReadOnly);
  const ownershipLabel = initialDocumentType?.isSystem
    ? "Built-in default"
    : isOwnedByCurrentUser
      ? "Owned by you"
      : "Shared template";

  useEffect(() => {
    setEditingDocumentTypeId(initialDocumentType?.id ?? null);
    setName(initialForm.name);
    setSlug(initialForm.slug);
    setDescription(initialForm.description);
    setPromptTemplate(initialForm.promptTemplate);
    setIsPublic(initialForm.isPublic);
    setFields(initialForm.fields);
    setFieldLayoutMode("double");
    setColumnLayoutModes({});
    setExpandedFieldIds(new Set());
    setExpandedColumnIds(new Set());
    setFullWidthFieldId(null);
    setFullWidthColumnIds({});
    setMessage(null);
    setError(null);
    setActiveReorder(null);
    setDropTarget(null);
    setDragPreview(null);
  }, [initialDocumentType, initialForm]);

  useEffect(() => {
    if (!activeReorder) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      setDragPreview((currentPreview) =>
        currentPreview
          ? {
              ...currentPreview,
              x: event.clientX,
              y: event.clientY,
            }
          : currentPreview,
      );

      const targetElement = document.elementFromPoint(event.clientX, event.clientY);

      if (!(targetElement instanceof HTMLElement)) {
        setDropTarget(null);
        return;
      }

      const reorderTarget = targetElement.closest<HTMLElement>("[data-reorder-target='true']");

      if (!reorderTarget) {
        setDropTarget(null);
        return;
      }

      const targetScope = reorderTarget.dataset.reorderScope;
      const targetId = reorderTarget.dataset.reorderId;

      if (
        !targetScope ||
        !targetId ||
        targetScope !== activeReorder.scope ||
        targetId === activeReorder.itemId
      ) {
        setDropTarget(null);
        return;
      }

      setDropTarget({ scope: targetScope, itemId: targetId });
    };

    const handlePointerUp = () => {
      if (
        activeReorder.scope === dropTarget?.scope &&
        activeReorder.itemId !== dropTarget?.itemId &&
        dropTarget?.itemId
      ) {
        if (activeReorder.scope === "form") {
          setFields((currentFields) => {
            const sourceIndex = currentFields.findIndex(
              (field) => field.id === activeReorder.itemId,
            );
            const targetIndex = currentFields.findIndex(
              (field) => field.id === dropTarget.itemId,
            );

            return moveListItem(currentFields, sourceIndex, targetIndex);
          });
        } else {
          setFields((currentFields) =>
            currentFields.map((field) => {
              if (buildColumnReorderScope(field.id) !== activeReorder.scope) {
                return field;
              }

              const sourceIndex = field.columns.findIndex(
                (column) => column.id === activeReorder.itemId,
              );
              const targetIndex = field.columns.findIndex(
                (column) => column.id === dropTarget.itemId,
              );

              return {
                ...field,
                columns: moveListItem(field.columns, sourceIndex, targetIndex),
              };
            }),
          );
        }
      }

      setActiveReorder(null);
      setDropTarget(null);
      setDragPreview(null);
    };

    const handlePointerCancel = () => {
      setActiveReorder(null);
      setDropTarget(null);
      setDragPreview(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerCancel);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerCancel);
    };
  }, [activeReorder, dropTarget]);

  function updateField(id: string, patch: Partial<FieldDraft>) {
    setFields((currentFields) =>
      currentFields.map((field) =>
        field.id === id ? { ...field, ...patch } : field,
      ),
    );
  }

  function removeField(id: string) {
    const removedField = fields.find((field) => field.id === id);

    setFields((currentFields) => currentFields.filter((field) => field.id !== id));
    setExpandedFieldIds((currentExpandedIds) => {
      if (!currentExpandedIds.has(id)) {
        return currentExpandedIds;
      }

      const nextExpandedIds = new Set(currentExpandedIds);
      nextExpandedIds.delete(id);
      return nextExpandedIds;
    });
    setColumnLayoutModes((currentModes) => {
      if (!(id in currentModes)) {
        return currentModes;
      }

      const nextModes = { ...currentModes };
      delete nextModes[id];
      return nextModes;
    });
    setFullWidthColumnIds((currentIds) => {
      if (!(id in currentIds)) {
        return currentIds;
      }

      const nextIds = { ...currentIds };
      delete nextIds[id];
      return nextIds;
    });
    setFullWidthFieldId((currentFieldId) => (currentFieldId === id ? null : currentFieldId));
    if (!removedField) {
      return;
    }

    setExpandedColumnIds((currentExpandedIds) => {
      const nextExpandedIds = new Set(currentExpandedIds);

      removedField.columns.forEach((column) => {
        nextExpandedIds.delete(column.id);
      });

      return nextExpandedIds;
    });
  }

  function toggleFieldExpanded(id: string) {
    setExpandedFieldIds((currentExpandedIds) => {
      const nextExpandedIds = new Set(currentExpandedIds);

      if (nextExpandedIds.has(id)) {
        nextExpandedIds.delete(id);
      } else {
        nextExpandedIds.add(id);
      }

      return nextExpandedIds;
    });
  }

  function toggleFieldFullWidth(id: string) {
    setFullWidthFieldId((currentFieldId) => (currentFieldId === id ? null : id));
    setExpandedFieldIds((currentExpandedIds) => {
      if (currentExpandedIds.has(id)) {
        return currentExpandedIds;
      }

      const nextExpandedIds = new Set(currentExpandedIds);
      nextExpandedIds.add(id);
      return nextExpandedIds;
    });
  }

  function toggleProductColumnExpanded(columnId: string) {
    setExpandedColumnIds((currentExpandedIds) => {
      const nextExpandedIds = new Set(currentExpandedIds);

      if (nextExpandedIds.has(columnId)) {
        nextExpandedIds.delete(columnId);
      } else {
        nextExpandedIds.add(columnId);
      }

      return nextExpandedIds;
    });
  }

  function toggleProductColumnFullWidth(fieldId: string, columnId: string) {
    setFullWidthColumnIds((currentIds) => ({
      ...currentIds,
      [fieldId]: currentIds[fieldId] === columnId ? null : columnId,
    }));
    setExpandedColumnIds((currentExpandedIds) => {
      if (currentExpandedIds.has(columnId)) {
        return currentExpandedIds;
      }

      const nextExpandedIds = new Set(currentExpandedIds);
      nextExpandedIds.add(columnId);
      return nextExpandedIds;
    });
  }

  function updateProductColumn(
    fieldId: string,
    columnId: string,
    patch: Partial<ProductColumnDraft>,
  ) {
    setFields((currentFields) =>
      currentFields.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              columns: field.columns.map((column) =>
                column.id === columnId ? { ...column, ...patch } : column,
              ),
            }
          : field,
      ),
    );
  }

  function addProductColumn(fieldId: string) {
    const nextColumn = buildProductColumnDraft();

    setFields((currentFields) =>
      currentFields.map((field) =>
        field.id === fieldId
          ? { ...field, columns: [...field.columns, nextColumn] }
          : field,
      ),
    );
    setExpandedColumnIds((currentExpandedIds) => new Set(currentExpandedIds).add(nextColumn.id));
  }

  function removeProductColumn(fieldId: string, columnId: string) {
    setFields((currentFields) =>
      currentFields.map((field) =>
        field.id === fieldId
          ? {
              ...field,
              columns:
                field.columns.length > 1
                  ? field.columns.filter((column) => column.id !== columnId)
                  : field.columns,
            }
          : field,
      ),
    );
    setExpandedColumnIds((currentExpandedIds) => {
      if (!currentExpandedIds.has(columnId)) {
        return currentExpandedIds;
      }

      const nextExpandedIds = new Set(currentExpandedIds);
      nextExpandedIds.delete(columnId);
      return nextExpandedIds;
    });
    setFullWidthColumnIds((currentIds) => {
      if (currentIds[fieldId] !== columnId) {
        return currentIds;
      }

      return {
        ...currentIds,
        [fieldId]: null,
      };
    });
  }

  function beginFieldReorder(
    itemId: string,
    preview: Omit<DragPreviewState, "x" | "y"> & { x: number; y: number },
  ) {
    setActiveReorder({ scope: "form", itemId });
    setDropTarget(null);
    setDragPreview(preview);
  }

  function beginColumnReorder(
    fieldId: string,
    columnId: string,
    preview: Omit<DragPreviewState, "x" | "y"> & { x: number; y: number },
  ) {
    setActiveReorder({ scope: buildColumnReorderScope(fieldId), itemId: columnId });
    setDropTarget(null);
    setDragPreview(preview);
  }

  function resetForm() {
    if (initialDocumentType?.id) {
      router.push("/document-types");
      return;
    }

    const nextForm = buildFormState();
    setEditingDocumentTypeId(null);
    setName(nextForm.name);
    setSlug(nextForm.slug);
    setDescription(nextForm.description);
    setPromptTemplate(nextForm.promptTemplate);
    setFields(nextForm.fields);
    setFieldLayoutMode("double");
    setColumnLayoutModes({});
    setExpandedFieldIds(new Set());
    setExpandedColumnIds(new Set());
    setFullWidthFieldId(null);
    setFullWidthColumnIds({});
    setMessage(null);
    setError(null);
    setActiveReorder(null);
    setDropTarget(null);
    setDragPreview(null);
  }

  function buildDocumentTypePayload() {
    return {
      name,
      slug: slug || suggestedSlug,
      description,
      promptTemplate,
      isPublic,
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
        ...(field.kind === "table"
          ? {
              columns: field.columns.map((column) => ({
                key: normalizeFieldKey(column.key),
                label: column.label,
                kind: column.kind,
                required: column.required,
                aliases: column.aliases
                  .split(",")
                  .map((value) => value.trim())
                  .filter(Boolean),
                description: column.description,
              })),
            }
          : {}),
      })),
    };
  }

  function applyAssistantDraft(draft: DocumentTypeInput) {
    setName(draft.name);
    setSlug(draft.slug);
    setDescription(draft.description);
    setPromptTemplate(draft.promptTemplate);
    setFields(draft.fields.map(buildFieldDraftFromDefinition));
    setExpandedFieldIds(new Set());
    setExpandedColumnIds(new Set());
    setFullWidthFieldId(null);
    setFullWidthColumnIds({});
    setMessage(`Applied AI draft for ${draft.name}. Review the fields below, then save when ready.`);
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isReadOnly) {
      setError("This template is read-only. Duplicate it to your account before editing.");
      setMessage(null);
      return;
    }

    setError(null);
    setMessage(null);

    const payload = buildDocumentTypePayload();

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

        if (editingDocumentTypeId) {
          setMessage(`Updated ${data.item.name}.`);
          router.refresh();
          return;
        }

        setMessage(`Created ${data.item.name}.`);
        router.push(`/document-types/${data.item.id}`);
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

  function duplicateToAccount() {
    if (!editingDocumentTypeId) {
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/document-types/${editingDocumentTypeId}/duplicate`, {
          method: "POST",
        });
        const data = (await response.json()) as {
          item?: DocumentType;
          error?: string;
        };

        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Document type could not be duplicated.");
        }

        router.push(`/document-types/${data.item.id}`);
        router.refresh();
      } catch (duplicateError) {
        setError(
          duplicateError instanceof Error
            ? duplicateError.message
            : "Document type could not be duplicated.",
        );
      }
    });
  }

  return (
    <>
      <section className="paper-panel p-6 sm:p-8">
      <p className="data-label">{isEditing ? "Edit Type" : "Create Type"}</p>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {isReadOnly
              ? "View template schema"
              : isEditing
                ? "Update extraction schema"
                : "New extraction schema"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            {isReadOnly
              ? "This template is visible in your workspace but cannot be edited directly. Duplicate it to create a private version under your account."
              : isEditing
              ? "Changes apply to the stored document type definition and future extraction runs. Existing extracted records remain unchanged."
              : "Create a reusable schema for a document layout and define the fields Ollama should return."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {canDuplicate ? (
            <button className="action-button" disabled={isPending} onClick={duplicateToAccount} type="button">
              {isPending ? "Duplicating…" : "Duplicate to My Account"}
            </button>
          ) : null}
          <button className="secondary-button" onClick={() => router.push("/document-types")} type="button">
            Back to Types
          </button>
        </div>
      </div>
      {isEditing ? (
        <div className="mt-6 flex flex-wrap gap-3">
          <span className="inline-flex border border-[var(--line)] px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            {ownershipLabel}
          </span>
          <span className="inline-flex border border-[var(--line)] px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            {initialDocumentType?.isPublic ? "Public" : "Private"}
          </span>
          <span className="inline-flex border border-[var(--line)] px-3 py-2 font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
            {isReadOnly ? "Read-only" : "Editable"}
          </span>
        </div>
      ) : null}
      {isReadOnly ? (
        <div className="mt-6 border-2 border-[var(--line)] bg-[var(--panel)] p-4 text-sm leading-7 text-[var(--muted)]">
          Public and system templates are intentionally read-only. Duplicating creates a private copy that you can rename, share, and customize without affecting the original template.
        </div>
      ) : null}
      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <fieldset className="space-y-5" disabled={isPending || isReadOnly}>
        {!isReadOnly ? (
          <DocumentTypeAssistant
            currentDraftSnapshot={buildDocumentTypePayload()}
            disabled={isPending}
            onApplyDraft={applyAssistantDraft}
          />
        ) : null}

        <div className="grid gap-5 lg:grid-cols-2">
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
        </div>

        <label className="schema-toggle border-2 border-[var(--line)] bg-[var(--panel)] px-4 py-3">
          <input
            className="h-4 w-4 accent-[var(--accent)]"
            checked={isPublic}
            onChange={(event) => setIsPublic(event.target.checked)}
            type="checkbox"
          />
          <span className="space-y-1">
            <span className="block font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink)]">
              Share as public template
            </span>
            <span className="block text-sm leading-6 text-[var(--muted)]">
              Public templates stay visible to other users as read-only starting points that they must duplicate before editing.
            </span>
          </span>
        </label>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setFields((currentFields) => [...currentFields, buildFieldDraft()])}
              >
                <FontAwesomeIcon aria-hidden="true" icon={faPlus} />
                <span>Add Field</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <div
                aria-label="Field layout"
                className="inline-flex overflow-hidden border-2 border-[var(--line)]"
                role="group"
              >
                <button
                  aria-label="Single column field layout"
                  aria-pressed={fieldLayoutMode === "single"}
                  className={`inline-flex h-11 w-11 items-center justify-center transition ${
                    fieldLayoutMode === "single"
                      ? "bg-[var(--ink)] text-[var(--canvas)]"
                      : "bg-transparent text-[var(--ink)]"
                  }`}
                  onClick={() => setFieldLayoutMode("single")}
                  title="Single column"
                  type="button"
                >
                  <FontAwesomeIcon aria-hidden="true" icon={faList} />
                  <span className="sr-only">1 Column</span>
                </button>
                <button
                  aria-label="Two column field layout"
                  aria-pressed={fieldLayoutMode === "double"}
                  className={`inline-flex h-11 w-11 items-center justify-center border-l-2 border-[var(--line)] transition ${
                    fieldLayoutMode === "double"
                      ? "bg-[var(--ink)] text-[var(--canvas)]"
                      : "bg-transparent text-[var(--ink)]"
                  }`}
                  onClick={() => setFieldLayoutMode("double")}
                  title="Two columns"
                  type="button"
                >
                  <FontAwesomeIcon aria-hidden="true" icon={faTableColumns} />
                  <span className="sr-only">2 Columns</span>
                </button>
              </div>
            </div>
          </div>
          <p className="text-sm leading-7 text-[var(--muted)]">
            Drag by the handle to change the saved field order. That same order is used
            when reviewing extracted documents.
          </p>
          <div className={`grid items-start gap-4 ${fieldLayoutMode === "double" ? "xl:grid-cols-2" : "grid-cols-1"}`}>
            {fields.map((field, index) => {
              const isExpanded = expandedFieldIds.has(field.id);
              const fieldTitle = getFieldDisplayLabel(field, index);
              const contentId = `field-panel-${field.id}`;

              return (
                <div
                  key={field.id}
                  className={`relative ${fieldLayoutMode === "double" && fullWidthFieldId === field.id ? "xl:col-span-2" : ""}`}
                >
                  <div
                    className={`relative border-2 bg-[var(--panel-strong)] p-4 transition-[border-color,opacity,transform] ${
                      dropTarget?.scope === "form" && dropTarget.itemId === field.id
                        ? "border-[var(--accent-strong)]"
                        : "border-[var(--ink)]"
                    } ${
                      activeReorder?.scope === "form" && activeReorder.itemId === field.id
                        ? "opacity-65"
                        : "opacity-100"
                    }`}
                    data-reorder-id={field.id}
                    data-reorder-scope="form"
                    data-reorder-target="true"
                  >
                    <div className="relative min-h-[4.5rem] pl-16">
                      <button
                        aria-label={`Drag ${fieldTitle}`}
                        className="field-drag-handle"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          beginFieldReorder(field.id, {
                            title: fieldTitle,
                            subtitle: `${field.kind.toUpperCase()} · ${field.key || "new field"}`,
                            x: event.clientX,
                            y: event.clientY,
                          });
                        }}
                        type="button"
                      >
                        <span className="field-drag-handle__bars" aria-hidden="true">
                          <span />
                          <span />
                          <span />
                        </span>
                      </button>
                      {dropTarget?.scope === "form" && dropTarget.itemId === field.id ? (
                        <span className="reorder-drop-indicator" aria-hidden="true" />
                      ) : null}
                      <div className="flex items-start justify-between gap-3">
                        <button
                          aria-controls={contentId}
                          aria-expanded={isExpanded}
                          className="flex min-w-0 flex-1 items-start justify-between gap-3 py-1 pr-1 text-left transition hover:text-[var(--paper)]"
                          onClick={() => toggleFieldExpanded(field.id)}
                          type="button"
                        >
                          <span className="min-w-0">
                            <span className="block truncate font-medium uppercase tracking-[0.14em]">
                              {fieldTitle}
                            </span>
                            <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                              {field.kind}
                            </span>
                          </span>
                          <span className="mt-0.5 shrink-0 text-[var(--ink)]">
                            <FontAwesomeIcon
                              aria-hidden="true"
                              icon={isExpanded ? faChevronUp : faChevronDown}
                            />
                          </span>
                        </button>
                      </div>
                    </div>
                    <div id={contentId} className="mt-4 space-y-3" hidden={!isExpanded}>
                      <div className="divider" aria-hidden="true" />
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        <button
                          aria-label={
                            fullWidthFieldId === field.id
                              ? `Restore ${fieldTitle} to grid width`
                              : `Make ${fieldTitle} full width`
                          }
                          aria-pressed={fullWidthFieldId === field.id}
                          className={`inline-flex h-11 w-11 items-center justify-center border-2 px-0 py-0 transition ${
                            fullWidthFieldId === field.id
                              ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                              : "border-[var(--line)] bg-transparent text-[var(--ink)] hover:border-[var(--ink)]"
                          }`}
                          onClick={() => toggleFieldFullWidth(field.id)}
                          title={fullWidthFieldId === field.id ? "Restore grid width" : "Make full width"}
                          type="button"
                        >
                          <FontAwesomeIcon aria-hidden="true" icon={faExpand} />
                        </button>
                        {fields.length > 1 ? (
                          <button
                            aria-label={`Remove ${fieldTitle}`}
                            className="danger-button inline-flex h-11 w-11 items-center justify-center px-0 py-0"
                            type="button"
                            onClick={() => removeField(field.id)}
                          >
                            <FontAwesomeIcon aria-hidden="true" icon={faTrashCan} />
                          </button>
                        ) : null}
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
                                columns:
                                  event.target.value === "table" && field.columns.length === 0
                                    ? [buildProductColumnDraft()]
                                    : field.columns,
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

                      {field.kind === "table" ? (
                        <div className="space-y-4 border-t border-[color:var(--line)] pt-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="data-label">Table Columns</p>
                              <p className="mt-1 text-sm text-[var(--muted)]">
                                Define one row schema for repeating table data.
                              </p>
                            </div>
                            <div className="flex flex-wrap items-center justify-end gap-3">
                              <button
                                aria-label={
                                  fullWidthFieldId === field.id
                                    ? `Restore ${fieldTitle} to grid width`
                                    : `Make ${fieldTitle} full width`
                                }
                                aria-pressed={fullWidthFieldId === field.id}
                                className={`inline-flex h-11 w-11 items-center justify-center border-2 px-0 py-0 transition ${
                                  fullWidthFieldId === field.id
                                    ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                                    : "border-[var(--line)] bg-transparent text-[var(--ink)] hover:border-[var(--ink)]"
                                }`}
                                onClick={() => toggleFieldFullWidth(field.id)}
                                title={fullWidthFieldId === field.id ? "Restore grid width" : "Make full width"}
                                type="button"
                              >
                                <FontAwesomeIcon aria-hidden="true" icon={faExpand} />
                              </button>
                              <div
                                aria-label={`Column layout for ${fieldTitle}`}
                                className="inline-flex overflow-hidden border-2 border-[var(--line)]"
                                role="group"
                              >
                                <button
                                  aria-label="Single column card layout"
                                  aria-pressed={(columnLayoutModes[field.id] ?? "double") === "single"}
                                  className={`inline-flex h-11 w-11 items-center justify-center transition ${
                                    (columnLayoutModes[field.id] ?? "double") === "single"
                                      ? "bg-[var(--ink)] text-[var(--canvas)]"
                                      : "bg-transparent text-[var(--ink)]"
                                  }`}
                                  onClick={() =>
                                    setColumnLayoutModes((currentModes) => ({
                                      ...currentModes,
                                      [field.id]: "single",
                                    }))
                                  }
                                  title="Single column"
                                  type="button"
                                >
                                  <FontAwesomeIcon aria-hidden="true" icon={faList} />
                                  <span className="sr-only">1 Column</span>
                                </button>
                                <button
                                  aria-label="Two column card layout"
                                  aria-pressed={(columnLayoutModes[field.id] ?? "double") === "double"}
                                  className={`inline-flex h-11 w-11 items-center justify-center border-l-2 border-[var(--line)] transition ${
                                    (columnLayoutModes[field.id] ?? "double") === "double"
                                      ? "bg-[var(--ink)] text-[var(--canvas)]"
                                      : "bg-transparent text-[var(--ink)]"
                                  }`}
                                  onClick={() =>
                                    setColumnLayoutModes((currentModes) => ({
                                      ...currentModes,
                                      [field.id]: "double",
                                    }))
                                  }
                                  title="Two columns"
                                  type="button"
                                >
                                  <FontAwesomeIcon aria-hidden="true" icon={faTableColumns} />
                                  <span className="sr-only">2 Columns</span>
                                </button>
                              </div>
                              <button
                                className="secondary-button"
                                type="button"
                                onClick={() => addProductColumn(field.id)}
                              >
                                Add Column
                              </button>
                            </div>
                          </div>

                          <div
                            className={`grid gap-4 ${(columnLayoutModes[field.id] ?? "double") === "double" ? "xl:grid-cols-2" : "grid-cols-1"}`}
                          >
                            {field.columns.map((column, columnIndex) => {
                              const columnTitle = getColumnDisplayLabel(column, columnIndex);
                              const columnContentId = `field-${field.id}-column-${column.id}`;
                              const columnLayoutMode = columnLayoutModes[field.id] ?? "double";
                              const columnFormGridClass =
                                columnLayoutMode === "double"
                                  ? "grid gap-3 grid-cols-1"
                                  : "grid gap-3 sm:grid-cols-2";
                              const isColumnExpanded = expandedColumnIds.has(column.id);
                              const columnReorderScope = buildColumnReorderScope(field.id);
                              const isColumnFullWidth = fullWidthColumnIds[field.id] === column.id;
                              const isColumnDropTarget =
                                dropTarget?.scope === columnReorderScope &&
                                dropTarget.itemId === column.id;
                              const isColumnActiveDrag =
                                activeReorder?.scope === columnReorderScope &&
                                activeReorder.itemId === column.id;

                              return (
                                <div
                                  key={column.id}
                                  className={`relative ${columnLayoutMode === "double" && isColumnFullWidth ? "xl:col-span-2" : ""}`}
                                >
                                  <div
                                    className={`relative space-y-3 border bg-[var(--panel)] p-4 transition-[border-color,opacity,transform] ${
                                      isColumnDropTarget
                                        ? "border-[var(--accent-strong)]"
                                        : "border-[color:var(--line)]"
                                    } ${isColumnActiveDrag ? "opacity-65" : "opacity-100"}`}
                                    data-reorder-id={column.id}
                                    data-reorder-scope={columnReorderScope}
                                    data-reorder-target="true"
                                  >
                                    <div className="relative min-h-[4.5rem] pl-16">
                                      <button
                                        aria-label={`Drag ${columnTitle}`}
                                        className="field-drag-handle"
                                        onPointerDown={(event) => {
                                          event.preventDefault();
                                          beginColumnReorder(field.id, column.id, {
                                            title: columnTitle,
                                            subtitle: `${column.kind.toUpperCase()} · ${column.key || "new column"}`,
                                            x: event.clientX,
                                            y: event.clientY,
                                          });
                                        }}
                                        type="button"
                                      >
                                        <span className="field-drag-handle__bars" aria-hidden="true">
                                          <span />
                                          <span />
                                          <span />
                                        </span>
                                      </button>
                                      {isColumnDropTarget ? (
                                        <span className="reorder-drop-indicator" aria-hidden="true" />
                                      ) : null}
                                      <div className="flex items-start justify-between gap-3">
                                        <button
                                          aria-controls={columnContentId}
                                          aria-expanded={isColumnExpanded}
                                          className="flex min-w-0 flex-1 items-start justify-between gap-3 py-1 pr-1 text-left transition hover:text-[var(--paper)]"
                                          onClick={() => toggleProductColumnExpanded(column.id)}
                                          type="button"
                                        >
                                          <span className="min-w-0">
                                            <span className="block truncate font-medium uppercase tracking-[0.14em]">
                                              {columnTitle}
                                            </span>
                                            <span className="mt-1 block font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                                              {column.kind}
                                            </span>
                                          </span>
                                          <span className="mt-0.5 shrink-0 text-[var(--ink)]">
                                            <FontAwesomeIcon
                                              aria-hidden="true"
                                              icon={isColumnExpanded ? faChevronUp : faChevronDown}
                                            />
                                          </span>
                                        </button>
                                      </div>
                                    </div>

                                    <div id={columnContentId} className="space-y-3" hidden={!isColumnExpanded}>
                                    <div className="divider" aria-hidden="true" />
                                    <div className="flex flex-wrap items-center justify-end gap-2">
                                      <button
                                        aria-label={
                                          isColumnFullWidth
                                            ? `Restore ${columnTitle} to grid width`
                                            : `Make ${columnTitle} full width`
                                        }
                                        aria-pressed={isColumnFullWidth}
                                        className={`inline-flex h-11 w-11 items-center justify-center border-2 px-0 py-0 transition ${
                                          isColumnFullWidth
                                            ? "border-[var(--ink)] bg-[var(--ink)] text-[var(--canvas)]"
                                            : "border-[var(--line)] bg-transparent text-[var(--ink)] hover:border-[var(--ink)]"
                                        }`}
                                        onClick={() => toggleProductColumnFullWidth(field.id, column.id)}
                                        title={isColumnFullWidth ? "Restore grid width" : "Make full width"}
                                        type="button"
                                      >
                                        <FontAwesomeIcon aria-hidden="true" icon={faExpand} />
                                      </button>
                                      {field.columns.length > 1 ? (
                                        <button
                                          aria-label={`Remove ${columnTitle}`}
                                          className="danger-button inline-flex h-11 w-11 items-center justify-center px-0 py-0"
                                          type="button"
                                          onClick={() => removeProductColumn(field.id, column.id)}
                                        >
                                          <FontAwesomeIcon aria-hidden="true" icon={faTrashCan} />
                                        </button>
                                      ) : null}
                                    </div>
                                    <div className={columnFormGridClass}>
                                      <label className="block space-y-2">
                                        <span className="data-label">Key</span>
                                        <input
                                          className="input-base font-mono"
                                          value={column.key}
                                          onChange={(event) =>
                                            updateProductColumn(field.id, column.id, {
                                              key: normalizeFieldKey(event.target.value),
                                            })
                                          }
                                          placeholder="sku"
                                        />
                                      </label>
                                      <label className="block space-y-2">
                                        <span className="data-label">Label</span>
                                        <input
                                          className="input-base"
                                          value={column.label}
                                          onChange={(event) =>
                                            updateProductColumn(field.id, column.id, {
                                              label: event.target.value,
                                            })
                                          }
                                          placeholder="SKU"
                                        />
                                      </label>
                                    </div>

                                    <div className={columnFormGridClass}>
                                      <label className="block space-y-2">
                                        <span className="data-label">Type</span>
                                        <select
                                          className="select-base"
                                          value={column.kind}
                                          onChange={(event) =>
                                            updateProductColumn(field.id, column.id, {
                                              kind: event.target.value as ProductColumnDefinition["kind"],
                                            })
                                          }
                                        >
                                          {scalarFieldKindValues.map((value) => (
                                            <option key={value} value={value}>
                                              {value}
                                            </option>
                                          ))}
                                        </select>
                                      </label>
                                      <label className="schema-toggle">
                                        <input
                                          className="h-4 w-4 accent-[var(--accent)]"
                                          checked={column.required}
                                          onChange={(event) =>
                                            updateProductColumn(field.id, column.id, {
                                              required: event.target.checked,
                                            })
                                          }
                                          type="checkbox"
                                        />
                                        <span className="font-mono text-xs uppercase tracking-[0.16em] text-[var(--ink)]">
                                          Required?
                                        </span>
                                      </label>
                                    </div>

                                    <label className="block space-y-2">
                                      <span className="data-label">Aliases</span>
                                      <input
                                        className="input-base"
                                        value={column.aliases}
                                        onChange={(event) =>
                                          updateProductColumn(field.id, column.id, {
                                            aliases: event.target.value,
                                          })
                                        }
                                        placeholder="item code, stock code"
                                      />
                                    </label>

                                    <label className="block space-y-2">
                                      <span className="data-label">Description</span>
                                      <textarea
                                        className="textarea-base"
                                        value={column.description}
                                        onChange={(event) =>
                                          updateProductColumn(field.id, column.id, {
                                            description: event.target.value,
                                          })
                                        }
                                        placeholder="How this column should be interpreted in each row."
                                      />
                                    </label>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

        {!isReadOnly ? (
          <div className="flex flex-wrap gap-3">
            <button className="action-button flex-1" disabled={isPending} type="submit">
              {isPending ? "Saving…" : isEditing ? "Update Document Type" : "Save Document Type"}
            </button>
            <button
              className="secondary-button"
              disabled={isPending}
              onClick={resetForm}
              type="button"
            >
              {isEditing ? "Back to Types" : "Reset Form"}
            </button>
          </div>
        ) : null}
        </fieldset>

        {isReadOnly && message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
        {isReadOnly && error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      </form>

      </section>

      {dragPreview ? (
        <div
          className="field-drag-preview"
          style={{
            left: dragPreview.x + 18,
            top: dragPreview.y + 18,
          }}
        >
          <p className="field-drag-preview__title">{dragPreview.title}</p>
          <p className="field-drag-preview__subtitle">{dragPreview.subtitle}</p>
        </div>
      ) : null}
    </>
  );
}