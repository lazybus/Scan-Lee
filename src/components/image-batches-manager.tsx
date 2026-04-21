"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  batchStatusValues,
  imageBatchInputSchema,
  type ImageBatchInput,
  type ImageBatchRecord,
} from "@/lib/domain";

type BatchMutationResponse = {
  item?: ImageBatchRecord;
  error?: string;
};

const emptyDraft: ImageBatchInput = {
  name: "",
  description: "",
  status: "draft",
};

const serverTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function formatServerTimestamp(value: string) {
  return serverTimestampFormatter.format(new Date(value));
}

function formatClientTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function TimestampText({ value }: { value: string }) {
  const [formattedValue, setFormattedValue] = useState(() => formatServerTimestamp(value));

  useEffect(() => {
    setFormattedValue(formatClientTimestamp(value));
  }, [value]);

  return (
    <time dateTime={value} suppressHydrationWarning>
      {formattedValue}
    </time>
  );
}

export function ImageBatchesManager({
  initialBatches,
}: {
  initialBatches: ImageBatchRecord[];
}) {
  const router = useRouter();
  const [batches, setBatches] = useState(initialBatches);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createDraft, setCreateDraft] = useState<ImageBatchInput>(emptyDraft);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, ImageBatchInput>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setBatches(initialBatches);
  }, [initialBatches]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(() => setMessage(null), 4200);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timeout = window.setTimeout(() => setError(null), 5200);
    return () => window.clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    if (!isCreateModalOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPending) {
        setIsCreateModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isCreateModalOpen, isPending]);

  function openCreateModal() {
    setError(null);
    setMessage(null);
    setIsCreateModalOpen(true);
  }

  function closeCreateModal() {
    if (isPending) {
      return;
    }

    setIsCreateModalOpen(false);
  }

  function beginEdit(batch: ImageBatchRecord) {
    setEditingBatchId(batch.id);
    setEditDrafts((current) => ({
      ...current,
      [batch.id]: {
        name: batch.name,
        description: batch.description,
        status: batch.status,
      },
    }));
    setError(null);
    setMessage(null);
  }

  function cancelEdit(batchId: string) {
    setEditingBatchId((current) => (current === batchId ? null : current));
    setEditDrafts((current) => {
      if (!(batchId in current)) {
        return current;
      }

      const next = { ...current };
      delete next[batchId];
      return next;
    });
  }

  function updateEditDraft(batchId: string, updater: (current: ImageBatchInput) => ImageBatchInput) {
    setEditDrafts((current) => ({
      ...current,
      [batchId]: updater(
        current[batchId] ?? {
          name: "",
          description: "",
          status: "draft",
        },
      ),
    }));
  }

  function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const payload = imageBatchInputSchema.parse(createDraft);
        const response = await fetch("/api/image-batches", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as BatchMutationResponse;

        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Image batch creation failed.");
        }

        setBatches((current) => [data.item!, ...current]);
        setCreateDraft(emptyDraft);
        setIsCreateModalOpen(false);
        setMessage(`Created batch ${data.item.name}.`);
        router.push(`/batches/${data.item.id}`);
        router.refresh();
      } catch (createError) {
        setError(createError instanceof Error ? createError.message : "Image batch creation failed.");
      }
    });
  }

  function handleSave(batchId: string) {
    const draft = editDrafts[batchId];

    if (!draft) {
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const payload = imageBatchInputSchema.parse(draft);
        const response = await fetch(`/api/image-batches/${batchId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as BatchMutationResponse;

        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Image batch update failed.");
        }

        setBatches((current) =>
          current.map((batch) => (batch.id === batchId ? data.item! : batch)),
        );
        cancelEdit(batchId);
        setMessage(`Updated batch ${data.item.name}.`);
        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Image batch update failed.");
      }
    });
  }

  const createBatchModal = isCreateModalOpen ? (
    <div
      aria-modal="true"
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          closeCreateModal();
        }
      }}
      role="dialog"
    >
      <div className="modal-panel paper-panel w-full max-w-2xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="data-label">New Batch</p>
            <h2 className="mt-3 text-2xl font-semibold">Start a capture batch</h2>
            <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted)]">
              Name the batch, add optional context, then continue directly into the batch editor.
            </p>
          </div>
          <button
            className="secondary-button"
            disabled={isPending}
            onClick={closeCreateModal}
            type="button"
          >
            Close
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleCreate}>
          <label className="block space-y-2">
            <span className="data-label">Name</span>
            <input
              className="input-base"
              value={createDraft.name}
              onChange={(event) => setCreateDraft((current) => ({ ...current, name: event.target.value }))}
              placeholder="Project Atlas invoices"
            />
          </label>
          <label className="block space-y-2">
            <span className="data-label">Description</span>
            <textarea
              className="input-base min-h-28"
              value={createDraft.description}
              onChange={(event) =>
                setCreateDraft((current) => ({ ...current, description: event.target.value }))
              }
              placeholder="April vendor invoices for Project Atlas"
            />
          </label>
          <label className="block space-y-2">
            <span className="data-label">Status</span>
            <select
              className="select-base"
              value={createDraft.status}
              onChange={(event) =>
                setCreateDraft((current) => ({
                  ...current,
                  status: event.target.value as ImageBatchInput["status"],
                }))
              }
            >
              {batchStatusValues.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button className="secondary-button" disabled={isPending} onClick={closeCreateModal} type="button">
              Cancel
            </button>
            <button className="action-button" disabled={isPending} type="submit">
              {isPending ? "Creating..." : "Create Batch"}
            </button>
          </div>
        </form>
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-6">
      {message || error ? (
        <div aria-live="polite" className="toast-stack" role="status">
          {message ? (
            <div className="app-toast" data-tone="success">
              <p>{message}</p>
              <button className="toast-dismiss-button" onClick={() => setMessage(null)} type="button">
                ×
              </button>
            </div>
          ) : null}
          {error ? (
            <div className="app-toast" data-tone="error">
              <p>{error}</p>
              <button className="toast-dismiss-button" onClick={() => setError(null)} type="button">
                ×
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="paper-panel p-6 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="data-label">Image Batches</p>
            <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">Available batches</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[var(--muted)] sm:text-base">
              Group uploads by project, date, or workflow. Start a new capture run here, then move
              directly into its editor to add images and process documents.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-[var(--muted)]">
              {batches.length === 1 ? "1 batch" : `${batches.length} batches`}
            </p>
            <button className="action-button" onClick={openCreateModal} type="button">
              Create Batch
            </button>
          </div>
        </div>

        {batches.length === 0 ? (
          <div className="mt-6 border-2 border-dashed border-[color:var(--line)] p-6 text-sm text-[var(--muted)]">
            No image batches yet. Use Create Batch to start organizing uploads.
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            {batches.map((batch) => {
              const isEditing = editingBatchId === batch.id;
              const draft = editDrafts[batch.id] ?? {
                name: batch.name,
                description: batch.description,
                status: batch.status,
              };

              return (
                <article key={batch.id} className="record-sheet space-y-4 p-5">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-2xl font-semibold">{batch.name}</h3>
                        <span className="status-pill" data-state={batch.status === "completed" ? "completed" : batch.status === "active" ? "reviewed" : "uploaded"}>
                          {batch.status}
                        </span>
                      </div>
                      <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">
                        {batch.description || "No description provided yet."}
                      </p>
                      <div className="flex flex-wrap gap-5 text-sm text-[var(--muted)]">
                        <span>{batch.documentCount ?? 0} documents</span>
                        <span>{batch.processedDocumentCount ?? 0} processed</span>
                        <span>
                          Updated <TimestampText value={batch.updatedAt} />
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-3">
                      <Link className="action-button" href={`/batches/${batch.id}`}>
                        Open Batch
                      </Link>
                      {isEditing ? (
                        <button className="secondary-button" onClick={() => cancelEdit(batch.id)} type="button">
                          Cancel
                        </button>
                      ) : (
                        <button className="secondary-button" onClick={() => beginEdit(batch)} type="button">
                          Edit Batch
                        </button>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="grid gap-4 border-t-2 border-[color:var(--line)] pt-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end">
                      <label className="block space-y-2">
                        <span className="data-label">Name</span>
                        <input
                          className="input-base"
                          value={draft.name}
                          onChange={(event) =>
                            updateEditDraft(batch.id, (current) => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <label className="block space-y-2">
                        <span className="data-label">Status</span>
                        <select
                          className="select-base"
                          value={draft.status}
                          onChange={(event) =>
                            updateEditDraft(batch.id, (current) => ({
                              ...current,
                              status: event.target.value as ImageBatchInput["status"],
                            }))
                          }
                        >
                          {batchStatusValues.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex justify-end">
                        <button className="action-button" disabled={isPending} onClick={() => handleSave(batch.id)} type="button">
                          {isPending ? "Saving..." : "Save Changes"}
                        </button>
                      </div>
                      <label className="block space-y-2 lg:col-span-3">
                        <span className="data-label">Description</span>
                        <textarea
                          className="input-base min-h-24"
                          value={draft.description}
                          onChange={(event) =>
                            updateEditDraft(batch.id, (current) => ({
                              ...current,
                              description: event.target.value,
                            }))
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {typeof document !== "undefined" && createBatchModal
        ? createPortal(createBatchModal, document.body)
        : null}
    </div>
  );
}