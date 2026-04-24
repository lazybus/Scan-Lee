"use client";

import { faPaperPlane, faPlus, faTrashCan, faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";

import type {
  DocumentTypeAssistantMessage,
  DocumentTypeAssistantResult,
  DocumentTypeInput,
} from "@/lib/domain";

type AssistantApiResponse = DocumentTypeAssistantResult & {
  error?: string;
};

export function DocumentTypeAssistant({
  currentDraftSnapshot,
  disabled = false,
  onCreateType,
}: {
  currentDraftSnapshot: Record<string, unknown>;
  disabled?: boolean;
  onCreateType: (draft: DocumentTypeInput) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [conversation, setConversation] = useState<DocumentTypeAssistantMessage[]>([]);
  const [generatedDraft, setGeneratedDraft] = useState<DocumentTypeInput | null>(null);
  const [analysisSummary, setAnalysisSummary] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [providerUsed, setProviderUsed] = useState<DocumentTypeAssistantResult["providerUsed"] | null>(null);
  const [instruction, setInstruction] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedSampleFile, setSelectedSampleFile] = useState<File | null>(null);
  const [samplePreviewUrl, setSamplePreviewUrl] = useState<string | null>(null);
  const [sampleFileLabel, setSampleFileLabel] = useState<string | null>(null);
  const [sampleFilePath, setSampleFilePath] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (samplePreviewUrl) {
        URL.revokeObjectURL(samplePreviewUrl);
      }
    };
  }, [samplePreviewUrl]);

  function updateSelectedSample(file: File | null) {
    if (samplePreviewUrl) {
      URL.revokeObjectURL(samplePreviewUrl);
    }

    if (!file) {
      setSelectedSampleFile(null);
      setSamplePreviewUrl(null);
      setSampleFileLabel(null);
      return;
    }

    setSelectedSampleFile(file);
    setSamplePreviewUrl(URL.createObjectURL(file));
    setSampleFileLabel(file.name);
  }

  async function cleanupSample(pathOverride?: string | null) {
    const pathToDelete = pathOverride ?? sampleFilePath;

    if (!pathToDelete) {
      return;
    }

    await fetch("/api/document-types/assistant", {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sampleFilePath: pathToDelete }),
    });
    setSampleFilePath(null);
  }

  function resetAssistantState() {
    setConversation([]);
    setGeneratedDraft(null);
    setAnalysisSummary(null);
    setWarnings([]);
    setProviderUsed(null);
    setInstruction("");
    setMessage(null);
    setError(null);
    updateSelectedSample(null);
  }

  function handleGenerate() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("instruction", instruction);
        formData.set("conversation", JSON.stringify(conversation));
        formData.set("currentDraft", JSON.stringify(currentDraftSnapshot));

        if (sampleFilePath) {
          formData.set("sampleFilePath", sampleFilePath);
        }

        if (selectedSampleFile) {
          formData.set("sample", selectedSampleFile);
        }

        const response = await fetch("/api/document-types/assistant", {
          method: "POST",
          body: formData,
        });
        const data = (await response.json()) as AssistantApiResponse;

        if (!response.ok) {
          throw new Error(data.error ?? "Document type assistant could not generate a draft.");
        }

        const latestUserMessage = instruction.trim() || (selectedSampleFile || sampleFilePath
          ? "Analyze this sample document and improve the draft."
          : "Refine the current draft.");

        setConversation((currentConversation) => [
          ...currentConversation,
          {
            role: "user",
            content: latestUserMessage,
          },
          {
            role: "assistant",
            content: data.analysisSummary,
          },
        ]);
        setGeneratedDraft(data.draft);
        setAnalysisSummary(data.analysisSummary);
        setWarnings(data.warnings);
        setProviderUsed(data.providerUsed);
        setSampleFilePath(data.sampleFilePath ?? null);
        setSelectedSampleFile(null);
        setInstruction("");
        setMessage(`Draft ready from ${data.providerUsed === "google-ai" ? "Google AI" : "Ollama"}.`);
      } catch (generationError) {
        setError(
          generationError instanceof Error
            ? generationError.message
            : "Document type assistant could not generate a draft.",
        );
      }
    });
  }

  function handleApply() {
    if (!generatedDraft) {
      return;
    }

    startTransition(async () => {
      try {
        await cleanupSample();
        onCreateType(generatedDraft);
        setMessage("Loaded the AI draft into the editor below.");
      } catch (applyError) {
        setError(applyError instanceof Error ? applyError.message : "Draft could not be applied.");
      }
    });
  }

  function handleDiscard() {
    startTransition(async () => {
      try {
        await cleanupSample();
        resetAssistantState();
        setMessage("Cleared the assistant session.");
      } catch (discardError) {
        setError(
          discardError instanceof Error
            ? discardError.message
            : "Assistant session could not be cleared.",
        );
      }
    });
  }

  const isBusy = disabled || isPending;
  const hasAssistantSession =
    conversation.length > 0 ||
    generatedDraft !== null ||
    analysisSummary !== null ||
    warnings.length > 0 ||
    selectedSampleFile !== null ||
    sampleFilePath !== null ||
    instruction.trim().length > 0;

  return (
    <section className="space-y-5 border-2 border-[var(--line)] bg-[var(--panel)] p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="data-label">Experimental Assistant</p>
          <h2 className="mt-2 text-xl font-semibold">Generate a document type from a sample or prompt</h2>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            Upload one representative document image, describe what should be extracted, or do both. The assistant creates a draft schema that you can still edit manually before saving.
          </p>
        </div>
        <span className="inline-flex items-center gap-2 border border-[var(--line)] px-3 py-2 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
          <FontAwesomeIcon aria-hidden="true" icon={faWandMagicSparkles} />
          Experimental
        </span>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.85fr)]">
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="data-label">Prompt</span>
            <textarea
              className="textarea-base min-h-[10rem]"
              disabled={isBusy}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Examples: This is a cheque. Extract payee, cheque number, written amount, numeric amount, issue date, bank details, and memo. If there is a repeated remittance table, capture it as a table field."
              value={instruction}
            />
          </label>

          <label className="block space-y-2">
            <span className="data-label">Sample Image</span>
            <input
              accept="image/*"
              className="input-base"
              disabled={isBusy}
              onChange={(event) => updateSelectedSample(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>

          <div className="flex flex-wrap gap-3">
            <button
              className="action-button"
              disabled={isBusy || (!instruction.trim() && !selectedSampleFile && !sampleFilePath && conversation.length === 0)}
              onClick={handleGenerate}
              type="button"
            >
              <FontAwesomeIcon aria-hidden="true" icon={faPaperPlane} />
              <span>{isPending ? "Generating…" : "Generate"}</span>
            </button>
            <button
              className="danger-button"
              disabled={isBusy || !hasAssistantSession}
              onClick={handleDiscard}
              type="button"
            >
              <FontAwesomeIcon aria-hidden="true" icon={faTrashCan} />
              <span>Discard Session</span>
            </button>
          </div>

          {message ? <p className="text-sm text-[var(--success)]">{message}</p> : null}
          {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}

          <div className="space-y-3 border-t border-[var(--line)] pt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="data-label">Conversation</p>
              {providerUsed ? (
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  Provider: {providerUsed}
                </span>
              ) : null}
            </div>
            {conversation.length === 0 ? (
              <p className="text-sm leading-7 text-[var(--muted)]">
                No conversation yet. Start with a prompt, a sample image, or both.
              </p>
            ) : (
              <div className="space-y-3">
                {conversation.map((entry, index) => (
                  <article
                    key={`${entry.role}-${index}`}
                    className={`border px-4 py-3 text-sm leading-7 ${
                      entry.role === "assistant"
                        ? "border-[var(--line)] bg-[var(--panel-strong)]"
                        : "border-[var(--line)] bg-transparent"
                    }`}
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                      {entry.role}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-[var(--ink)]">{entry.content}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 border-t border-[var(--line)] pt-4 xl:border-l xl:border-t-0 xl:pl-5 xl:pt-0">
          <div>
            <p className="data-label">Draft Summary</p>
            <p className="mt-2 text-sm leading-7 text-[var(--muted)]">
              {analysisSummary ?? "The assistant summary and detected schema will appear here after generation."}
            </p>
          </div>

          {generatedDraft && analysisSummary ? (
            <button className="action-button" disabled={isBusy} onClick={handleApply} type="button">
              <FontAwesomeIcon aria-hidden="true" icon={faPlus} />
              <span>Create Type</span>
            </button>
          ) : null}

          {samplePreviewUrl ? (
            <div className="space-y-2">
              <p className="data-label">Current Sample</p>
              <div className="relative overflow-hidden border border-[var(--line)] bg-[var(--panel-strong)]">
                <div className="relative aspect-[4/5] w-full">
                  <Image
                    alt={sampleFileLabel ?? "Assistant sample"}
                    className="object-cover"
                    fill
                    sizes="(min-width: 1280px) 24rem, 100vw"
                    src={samplePreviewUrl}
                    unoptimized
                  />
                </div>
              </div>
              {sampleFileLabel ? (
                <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{sampleFileLabel}</p>
              ) : null}
            </div>
          ) : null}

          {generatedDraft ? (
            <div className="space-y-3 border border-[var(--line)] bg-[var(--panel-strong)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium uppercase tracking-[0.14em]">{generatedDraft.name}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                    {generatedDraft.slug}
                  </p>
                </div>
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                  {generatedDraft.fields.length} fields
                </span>
              </div>
              <p className="text-sm leading-7 text-[var(--muted)]">{generatedDraft.description}</p>
              <div className="space-y-2">
                {generatedDraft.fields.map((field) => (
                  <div
                    key={field.key}
                    className="flex flex-wrap items-start justify-between gap-3 border border-[var(--line)] px-3 py-2"
                  >
                    <div>
                      <p className="font-medium text-[var(--ink)]">{field.label}</p>
                      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                        {field.key}
                      </p>
                    </div>
                    <div className="text-right font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
                      <p>{field.kind}</p>
                      <p>{field.required ? "required" : "optional"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {warnings.length > 0 ? (
            <div className="space-y-2 border border-[var(--line)] px-4 py-3 text-sm leading-7 text-[var(--muted)]">
              <p className="data-label">Review Notes</p>
              <ul className="space-y-2">
                {warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}