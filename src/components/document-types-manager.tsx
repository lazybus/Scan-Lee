"use client";

import {
  faChevronDown,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  type DocumentType,
  type FieldDefinition,
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

function buildSavedFieldScope(documentTypeId: string) {
  return `saved:${documentTypeId}`;
}

export function DocumentTypesManager({
  initialDocumentTypes,
}: {
  initialDocumentTypes: DocumentType[];
}) {
  const router = useRouter();
  const [documentTypes, setDocumentTypes] = useState(initialDocumentTypes);
  const [expandedDocumentTypeIds, setExpandedDocumentTypeIds] = useState(
    () => new Set<string>(),
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeReorder, setActiveReorder] = useState<ReorderState | null>(null);
  const [dropTarget, setDropTarget] = useState<ReorderState | null>(null);
  const [dragPreview, setDragPreview] = useState<DragPreviewState | null>(null);

  function beginFieldReorder(
    scope: string,
    itemId: string,
    preview: Omit<DragPreviewState, "x" | "y"> & { x: number; y: number },
  ) {
    setActiveReorder({ scope, itemId });
    setDropTarget(null);
    setDragPreview(preview);
  }

  function updateDragPreviewPosition(clientX: number, clientY: number) {
    setDragPreview((currentPreview) =>
      currentPreview
        ? {
            ...currentPreview,
            x: clientX,
            y: clientY,
          }
        : currentPreview,
    );
  }

  function updateFieldReorderTarget(scope: string, clientX: number, clientY: number) {
    if (!activeReorder || activeReorder.scope !== scope) {
      return;
    }

    const targetElement = document.elementFromPoint(clientX, clientY);

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

    if (!targetScope || !targetId || targetScope !== scope || targetId === activeReorder.itemId) {
      setDropTarget(null);
      return;
    }

    setDropTarget({ scope: targetScope, itemId: targetId });
  }

  function clearFieldReorder() {
    setActiveReorder(null);
    setDropTarget(null);
    setDragPreview(null);
  }

  function commitFieldReorder(scope: string, sourceId: string, targetId: string) {
    if (scope.startsWith("saved:")) {
      reorderSavedField(scope.slice("saved:".length), sourceId, targetId);
    }
  }

  useEffect(() => {
    if (!activeReorder) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      updateDragPreviewPosition(event.clientX, event.clientY);
      updateFieldReorderTarget(activeReorder.scope, event.clientX, event.clientY);
    };

    const handlePointerUp = () => {
      if (
        activeReorder.scope === dropTarget?.scope &&
        activeReorder.itemId !== dropTarget?.itemId &&
        dropTarget?.itemId
      ) {
        commitFieldReorder(activeReorder.scope, activeReorder.itemId, dropTarget.itemId);
      }

      clearFieldReorder();
    };

    const handlePointerCancel = () => {
      clearFieldReorder();
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

  function updateDocumentTypeFields(
    documentTypeId: string,
    updater: (currentFields: FieldDefinition[]) => FieldDefinition[],
  ): {
    previousDocumentType: DocumentType | null;
    nextDocumentType: DocumentType | null;
  } {
    let previousDocumentType: DocumentType | null = null;
    let nextDocumentType: DocumentType | null = null;

    setDocumentTypes((currentDocumentTypes) => {
      const nextDocumentTypes = currentDocumentTypes.map((documentType) => {
        if (documentType.id !== documentTypeId) {
          return documentType;
        }

        previousDocumentType = documentType;
        const nextFields = updater(documentType.fields);

        if (nextFields === documentType.fields) {
          return documentType;
        }

        nextDocumentType = {
          ...documentType,
          fields: nextFields,
        };

        return nextDocumentType;
      });

      return nextDocumentTypes;
    });

    return {
      previousDocumentType,
      nextDocumentType,
    };
  }

  function persistDocumentTypeFields(
    documentType: DocumentType,
    successMessage: string,
    previousDocumentType?: DocumentType,
  ) {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/document-types/${documentType.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: documentType.name,
            slug: documentType.slug,
            description: documentType.description,
            promptTemplate: documentType.promptTemplate,
            fields: documentType.fields,
          }),
        });

        const data = (await response.json()) as {
          item?: DocumentType;
          error?: string;
        };

        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Document type could not be updated.");
        }

        setDocumentTypes((currentDocumentTypes) =>
          currentDocumentTypes.map((currentDocumentType) =>
            currentDocumentType.id === data.item?.id ? data.item : currentDocumentType,
          ),
        );
        setMessage(successMessage);
        router.refresh();
      } catch (persistError) {
        if (previousDocumentType) {
          setDocumentTypes((currentDocumentTypes) =>
            currentDocumentTypes.map((currentDocumentType) =>
              currentDocumentType.id === previousDocumentType.id
                ? previousDocumentType
                : currentDocumentType,
            ),
          );
        }

        setError(
          persistError instanceof Error
            ? persistError.message
            : "Document type could not be updated.",
        );
      }
    });
  }

  function reorderSavedField(documentTypeId: string, fieldKey: string, targetFieldKey: string) {
    const { previousDocumentType, nextDocumentType } = updateDocumentTypeFields(
      documentTypeId,
      (currentFields) => {
        const sourceIndex = currentFields.findIndex((field) => field.key === fieldKey);
        const targetIndex = currentFields.findIndex((field) => field.key === targetFieldKey);
        return moveListItem(currentFields, sourceIndex, targetIndex);
      },
    );

    if (!nextDocumentType || !previousDocumentType) {
      return;
    }

    persistDocumentTypeFields(
      nextDocumentType,
      `Updated field order for ${nextDocumentType.name}.`,
      previousDocumentType,
    );
  }

  function toggleDocumentTypeExpanded(documentTypeId: string) {
    setExpandedDocumentTypeIds((currentExpandedIds) => {
      const nextExpandedIds = new Set(currentExpandedIds);

      if (nextExpandedIds.has(documentTypeId)) {
        nextExpandedIds.delete(documentTypeId);
      } else {
        nextExpandedIds.add(documentTypeId);
      }

      return nextExpandedIds;
    });
  }

  return (
    <div className="space-y-6">
      <section className="paper-panel p-6 sm:p-8">
        <p className="data-label">Schema Registry</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Document type configuration</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              Each document type stores its expected fields and its prompt template. The
              extraction pipeline uses the schema as the output contract for Ollama.
            </p>
          </div>
          <Link className="action-button" href="/document-types/new">
            New Document Type
          </Link>
        </div>
        <div className="mt-8 space-y-4">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {documentTypes.map((documentType) => {
              const isExpanded = expandedDocumentTypeIds.has(documentType.id);
              const contentId = `document-type-panel-${documentType.id}`;

              return (
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
                    <button
                      aria-controls={contentId}
                      aria-expanded={isExpanded}
                      className="inline-flex items-center gap-2 border-2 border-[var(--line)] px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--paper)] transition hover:border-[var(--ink)]"
                      onClick={() => toggleDocumentTypeExpanded(documentType.id)}
                      type="button"
                    >
                      <span>{documentType.fields.length} fields</span>
                      <FontAwesomeIcon
                        aria-hidden="true"
                        icon={isExpanded ? faChevronUp : faChevronDown}
                      />
                      <span className="sr-only">
                        {isExpanded ? "Collapse" : "Expand"} {documentType.name}
                      </span>
                    </button>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                    {documentType.description}
                  </p>
                  <div id={contentId} className="mt-5" hidden={!isExpanded}>
                    <div className="divider" aria-hidden="true" />
                    <p className="mt-4 text-sm leading-7 text-[var(--muted)]">
                      Drag fields by the handle to update this saved order immediately.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {documentType.fields.map((field, index) => {
                        const reorderScope = buildSavedFieldScope(documentType.id);
                        const isDropTarget =
                          dropTarget?.scope === reorderScope && dropTarget.itemId === field.key;
                        const isActiveDrag =
                          activeReorder?.scope === reorderScope &&
                          activeReorder.itemId === field.key;

                        return (
                          <div key={`${documentType.id}-${field.key}`} className="relative">
                            <div
                              className={`schema-field-card saved-field-card relative transition-[border-color,opacity,transform] ${
                                isDropTarget
                                  ? "border-[var(--accent-strong)]"
                                  : "border-[var(--ink)]"
                              } ${isActiveDrag ? "opacity-65" : "opacity-100"}`}
                              data-reorder-id={field.key}
                              data-reorder-scope={reorderScope}
                              data-reorder-target="true"
                            >
                              <button
                                aria-label={`Drag ${field.label || `field ${index + 1}`}`}
                                className="field-drag-handle"
                                onPointerDown={(event) => {
                                  event.preventDefault();
                                  beginFieldReorder(reorderScope, field.key, {
                                    title: field.label || `Field ${index + 1}`,
                                    subtitle: `${field.kind.toUpperCase()} · ${field.key}`,
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
                              {isDropTarget ? (
                                <span className="reorder-drop-indicator" aria-hidden="true" />
                              ) : null}
                              <div className="saved-field-card__content">
                                <p className="font-medium">{field.label}</p>
                                <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--muted)]">
                                  {field.kind}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-3">
                      <Link className="secondary-button" href={`/document-types/${documentType.id}`}>
                        Edit Type
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
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
    </div>
  );
}