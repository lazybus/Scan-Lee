"use client";

import {
  faChevronDown,
  faChevronUp,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useEffectEvent, useState, useTransition } from "react";
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

type SectionDefinition = {
  id: string;
  title: string;
  description: string;
  items: DocumentType[];
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

function canManageDocumentType(documentType: DocumentType, currentUserId: string) {
  return documentType.ownerUserId === currentUserId && !documentType.isSystem;
}

function getVisibilityLabel(documentType: DocumentType, currentUserId: string) {
  if (documentType.isSystem) {
    return "System";
  }

  if (documentType.ownerUserId === currentUserId) {
    return documentType.isPublic ? "Your Public Template" : "Your Private Template";
  }

  return "Shared Template";
}

function buildSections(documentTypes: DocumentType[], currentUserId: string): SectionDefinition[] {
  const owned = documentTypes.filter((documentType) => documentType.ownerUserId === currentUserId);
  const system = documentTypes.filter((documentType) => documentType.isSystem);
  const shared = documentTypes.filter(
    (documentType) => !documentType.isSystem && documentType.ownerUserId !== currentUserId,
  );

  return [
    {
      id: "owned",
      title: "Your Templates",
      description: "These templates belong to your account. You can edit field order and sharing settings.",
      items: owned,
    },
    {
      id: "system",
      title: "Built-in Defaults",
      description: "Built-in cheque and invoice templates stay read-only. Duplicate one if you want a custom version.",
      items: system,
    },
    {
      id: "shared",
      title: "Shared Templates",
      description: "Public templates from other users are visible here as read-only starting points.",
      items: shared,
    },
  ].filter((section) => section.items.length > 0);
}

export function DocumentTypesManager({
  currentUserId,
  initialDocumentTypes,
}: {
  currentUserId: string;
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

  useEffect(() => {
    setDocumentTypes(initialDocumentTypes);
  }, [initialDocumentTypes]);

  function beginFieldReorder(
    scope: string,
    itemId: string,
    preview: Omit<DragPreviewState, "x" | "y"> & { x: number; y: number },
  ) {
    setActiveReorder({ scope, itemId });
    setDropTarget(null);
    setDragPreview(preview);
  }

  const updateDragPreviewPosition = useEffectEvent((clientX: number, clientY: number) => {
    setDragPreview((currentPreview) =>
      currentPreview
        ? {
            ...currentPreview,
            x: clientX,
            y: clientY,
          }
        : currentPreview,
    );
  });

  const commitSavedFieldReorder = useEffectEvent(
    (documentTypeId: string, fieldKey: string, targetFieldKey: string) => {
      reorderSavedField(documentTypeId, fieldKey, targetFieldKey);
    },
  );

  useEffect(() => {
    if (!activeReorder) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      updateDragPreviewPosition(event.clientX, event.clientY);

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
        commitSavedFieldReorder(
          activeReorder.scope.slice("saved:".length),
          activeReorder.itemId,
          dropTarget.itemId,
        );
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

  function updateDocumentTypeFields(
    documentTypeId: string,
    updater: (currentFields: FieldDefinition[]) => FieldDefinition[],
  ): {
    previousDocumentType: DocumentType | null;
    nextDocumentType: DocumentType | null;
  } {
    let previousDocumentType: DocumentType | null = null;
    let nextDocumentType: DocumentType | null = null;

    setDocumentTypes((currentDocumentTypes) =>
      currentDocumentTypes.map((documentType) => {
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
      }),
    );

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
    setMessage(null);

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
            isPublic: documentType.isPublic,
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
    const documentType = documentTypes.find((item) => item.id === documentTypeId);

    if (!documentType || !canManageDocumentType(documentType, currentUserId)) { 
      return;
    }

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

  function duplicateDocumentType(documentType: DocumentType) {
    setError(null);
    setMessage(null);

    startTransition(async () => { 
      try {
        const response = await fetch(`/api/document-types/${documentType.id}/duplicate`, {
          method: "POST",
        });
        const data = (await response.json()) as {
          item?: DocumentType;
          error?: string;
        };

        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Document type could not be duplicated.");
        }

        setMessage(`Created a private copy of ${documentType.name}.`);
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

  const sections = buildSections(documentTypes, currentUserId);

  return (
    <div className="space-y-6">
      <section className="paper-panel p-6 sm:p-8">
        <p className="data-label">Schema Registry</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold">Document type configuration</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base"> 
              Your account can manage private and public templates. Built-in and shared
              templates stay read-only until you duplicate them into your own workspace.
            </p>
          </div>
          <Link className="action-button" href="/document-types/new">
            New Document Type
          </Link>
        </div>
        {message ? <p className="mt-6 text-sm text-[var(--success)]">{message}</p> : null}
        {error ? <p className="mt-6 text-sm text-[var(--danger)]">{error}</p> : null}
        <div className="mt-8 space-y-8">
          {sections.map((section) => (
            <section key={section.id} className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold">{section.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
                  {section.description}
                </p>
              </div>
              <div className="grid items-start gap-4 lg:grid-cols-2">
                {section.items.map((documentType) => {
                  const isExpanded = expandedDocumentTypeIds.has(documentType.id);
                  const contentId = `document-type-panel-${documentType.id}`;
                  const canManage = canManageDocumentType(documentType, currentUserId);

                  return (
                    <article
                      key={documentType.id}
                      className="document-type-card p-5"
                      data-expanded={isExpanded ? "true" : "false"}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <span className="inline-flex border border-[var(--line)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                              {getVisibilityLabel(documentType, currentUserId)}
                            </span>
                            {canManage ? (
                              <span className="inline-flex border border-[var(--accent)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--accent-strong)]">
                                Editable
                              </span>
                            ) : (
                              <span className="inline-flex border border-[var(--line)] px-2 py-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                                Read-only
                              </span>
                            )}
                          </div>
                          <h3 className="mt-3 text-xl font-semibold">{documentType.name}</h3>
                          <p className="mt-1 font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                            {documentType.slug}
                          </p>
                        </div>
                        <button
                          aria-controls={contentId}
                          aria-expanded={isExpanded}
                          className="document-type-card__toggle inline-flex items-center gap-2 px-3 py-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--ink)]"
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
                          {canManage
                            ? "Drag fields by the handle to update this saved order immediately."
                            : "This template is visible for reference. Duplicate it to create an editable private copy."}
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
                                  data-reorder-id={canManage ? field.key : undefined}
                                  data-reorder-scope={canManage ? reorderScope : undefined}
                                  data-reorder-target={canManage ? "true" : undefined}
                                >
                                  {canManage ? (
                                    <button
                                      aria-label={`Drag ${field.label || `field ${index + 1}`}`}
                                      className="field-drag-handle"
                                      disabled={isPending}
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
                                  ) : (
                                    <span aria-hidden="true" className="saved-field-card__rail" />
                                  )}
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
                            {canManage ? "Edit Type" : "View Template"}
                          </Link>
                          {!canManage ? (
                            <button
                              className="action-button"
                              disabled={isPending}
                              onClick={() => duplicateDocumentType(documentType)}
                              type="button"
                            >
                              {isPending ? "Working…" : "Duplicate to My Account"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
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