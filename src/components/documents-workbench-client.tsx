"use client";

import {
  faArrowLeft,
  faArrowsRotate,
  faCircleCheck,
  faFileCsv,
  faFileExcel,
  faFloppyDisk,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faPenToSquare,
  faPlus,
  faRotateLeft,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { trackEvent } from "@/lib/analytics";
import type {
  ImageBatchInput,
  ImageBatchRecord,
  DocumentRecord,
  DocumentType,
  ExtractedRecord,
  ExtractedValue,
  ExtractionStatus,
  FieldDefinition,
  ProductColumnDefinition,
  TableFieldDefinition,
} from "@/lib/domain";
import { batchStatusValues, imageBatchInputSchema } from "@/lib/domain";

type ExtractionResponse = {
  item?: DocumentRecord;
  warning?: string;
  error?: string;
};

type UploadDocumentsResponse = {
  item?: DocumentRecord;
  items?: DocumentRecord[];
  error?: string;
};

type ReviewResponse = {
  item?: DocumentRecord;
  error?: string;
};

type BatchMutationResponse = {
  item?: ImageBatchRecord;
  error?: string;
};

type EditableDocumentEntry = {
  key: string;
  kind: FieldDefinition["kind"];
  label: string;
  value: ExtractedValue | undefined;
  field: FieldDefinition | null;
};

type ExtractionProgress = {
  current: number;
  currentDocumentName: string;
  total: number;
};

type ViewerState = {
  zoom: number;
  x: number;
  y: number;
};

type SplitDragState = {
  documentId: string;
  startRatio: number;
  startX: number;
  width: number;
};

type ImagePanState = {
  documentId: string;
  originX: number;
  originY: number;
  pointerId: number;
  startX: number;
  startY: number;
};

type SelectedUploadItem = {
  signature: string;
  file: File;
  optimization: UploadOptimization;
  documentTypeId: string;
  previewUrl: string;
  usesDefaultDocumentType: boolean;
};

type UploadOptimization = {
  originalBytes: number;
  processedBytes: number;
  originalHeight: number | null;
  originalWidth: number | null;
  preservedOriginal: boolean;
  resized: boolean;
  targetHeight: number | null;
  targetWidth: number | null;
  transcodedToWebp: boolean;
};

type PreparedUpload = {
  file: File;
  optimization: UploadOptimization;
  signature: string;
};

const defaultSplitRatio = 46;
const gemmaEfficientMaxImageDimension = 1536;
const previewScrollTopOffset = 16;
const previewScrollBottomInset = 16;
const uploadWebpQuality = 0.88;
const imagePreloadConcurrency = 4;

const defaultViewerState: ViewerState = {
  zoom: 1,
  x: 0,
  y: 0,
};

const serverTimestampFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC",
});

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function formatEditableValue(value: ExtractedValue | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  if (Array.isArray(value) || (typeof value === "object" && value !== null)) {
    return JSON.stringify(value, null, 2);
  }

  return String(value);
}

function formatServerTimestamp(value: string): string {
  return serverTimestampFormatter.format(new Date(value));
}

function formatClientTimestamp(value: string): string {
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

function formatDebugPayload(value: string): string {
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

function getFileSignature(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function replaceFileExtension(fileName: string, nextExtension: string): string {
  const extensionIndex = fileName.lastIndexOf(".");

  if (extensionIndex <= 0) {
    return `${fileName}${nextExtension}`;
  }

  return `${fileName.slice(0, extensionIndex)}${nextExtension}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const digits = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function getScaledImageDimensions(width: number, height: number) {
  const longestEdge = Math.max(width, height);

  if (longestEdge <= gemmaEfficientMaxImageDimension) {
    return {
      height,
      resized: false,
      width,
    };
  }

  const scale = gemmaEfficientMaxImageDimension / longestEdge;

  return {
    height: Math.max(1, Math.round(height * scale)),
    resized: true,
    width: Math.max(1, Math.round(width * scale)),
  };
}

function createUploadItem(preparedUpload: PreparedUpload, defaultDocumentTypeId: string): SelectedUploadItem {
  return {
    signature: preparedUpload.signature,
    file: preparedUpload.file,
    optimization: preparedUpload.optimization,
    documentTypeId: defaultDocumentTypeId,
    previewUrl: URL.createObjectURL(preparedUpload.file),
    usesDefaultDocumentType: true,
  };
}

function mergeUploadItems(
  currentItems: SelectedUploadItem[],
  incomingFiles: PreparedUpload[],
  defaultDocumentTypeId: string,
): SelectedUploadItem[] {
  const seen = new Set(currentItems.map((item) => item.signature));
  const merged = [...currentItems];

  for (const preparedUpload of incomingFiles) {
    const signature = preparedUpload.signature;

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    merged.push(createUploadItem(preparedUpload, defaultDocumentTypeId));
  }

  return merged;
}

async function loadImageElement(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve, reject) => {
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`Could not decode ${file.name}.`));
    };

    image.src = objectUrl;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Canvas export failed."));
        return;
      }

      resolve(blob);
    }, type, quality);
  });
}

function buildOriginalUploadOptimization(file: File, width: number | null, height: number | null): UploadOptimization {
  return {
    originalBytes: file.size,
    processedBytes: file.size,
    originalHeight: height,
    originalWidth: width,
    preservedOriginal: true,
    resized: false,
    targetHeight: height,
    targetWidth: width,
    transcodedToWebp: false,
  };
}

async function optimizeUploadImage(file: File): Promise<PreparedUpload> {
  const signature = getFileSignature(file);

  if (file.type === "image/gif") {
    return {
      file,
      optimization: buildOriginalUploadOptimization(file, null, null),
      signature,
    };
  }

  try {
    const image = await loadImageElement(file);
    const originalWidth = image.naturalWidth || null;
    const originalHeight = image.naturalHeight || null;

    if (!originalWidth || !originalHeight) {
      return {
        file,
        optimization: buildOriginalUploadOptimization(file, originalWidth, originalHeight),
        signature,
      };
    }

    const scaled = getScaledImageDimensions(originalWidth, originalHeight);
    const shouldTranscode = file.type !== "image/webp";

    if (!scaled.resized && !shouldTranscode) {
      return {
        file,
        optimization: buildOriginalUploadOptimization(file, originalWidth, originalHeight),
        signature,
      };
    }

    const canvas = document.createElement("canvas");
    canvas.width = scaled.width;
    canvas.height = scaled.height;

    const context = canvas.getContext("2d");

    if (!context) {
      return {
        file,
        optimization: buildOriginalUploadOptimization(file, originalWidth, originalHeight),
        signature,
      };
    }

    context.drawImage(image, 0, 0, scaled.width, scaled.height);

    const optimizedBlob = await canvasToBlob(canvas, "image/webp", uploadWebpQuality);

    if (!scaled.resized && optimizedBlob.size >= file.size) {
      return {
        file,
        optimization: buildOriginalUploadOptimization(file, originalWidth, originalHeight),
        signature,
      };
    }

    const optimizedFile = new File([optimizedBlob], replaceFileExtension(file.name, ".webp"), {
      lastModified: file.lastModified,
      type: "image/webp",
    });

    return {
      file: optimizedFile,
      optimization: {
        originalBytes: file.size,
        processedBytes: optimizedFile.size,
        originalHeight,
        originalWidth,
        preservedOriginal: false,
        resized: scaled.resized,
        targetHeight: scaled.height,
        targetWidth: scaled.width,
        transcodedToWebp: true,
      },
      signature,
    };
  } catch {
    return {
      file,
      optimization: buildOriginalUploadOptimization(file, null, null),
      signature,
    };
  }
}

function buildUploadPreparationMessage(preparedUploads: PreparedUpload[]): string | null {
  const transcodedCount = preparedUploads.filter((item) => item.optimization.transcodedToWebp).length;
  const resizedCount = preparedUploads.filter((item) => item.optimization.resized).length;
  const savedBytes = preparedUploads.reduce(
    (total, item) => total + Math.max(0, item.optimization.originalBytes - item.optimization.processedBytes),
    0,
  );

  const details = [
    transcodedCount > 0 ? `converted ${transcodedCount} to WebP` : null,
    resizedCount > 0 ? `resized ${resizedCount} to ${gemmaEfficientMaxImageDimension}px max` : null,
    savedBytes > 0 ? `saved ${formatFileSize(savedBytes)}` : null,
  ].filter(Boolean);

  if (details.length === 0) {
    return preparedUploads.length === 1
      ? "Added 1 image to the queue."
      : `Added ${preparedUploads.length} images to the queue.`;
  }

  return details.join(". ").replace(/^./, (value) => value.toUpperCase()) + ".";
}

function revokeUploadItems(items: SelectedUploadItem[]) {
  for (const item of items) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function getOrderedDocumentEntries(
  document: DocumentRecord,
  documentTypeById: Map<string, DocumentType>,
) {
  const values = document.reviewedData ?? document.extractedData;

  if (!values) {
    return [];
  }

  const documentType = documentTypeById.get(document.documentTypeId);

  if (!documentType) {
    return Object.entries(values).map(([key, value]) => ({
      key,
      label: key,
      value,
    }));
  }

  const orderedEntries = documentType.fields
    .map((field) => ({
      key: field.key,
      label: field.label,
      value: values[field.key],
    }))
    .filter((entry) => entry.value !== undefined);

  const knownKeys = new Set(documentType.fields.map((field) => field.key));
  const extraEntries = Object.entries(values)
    .filter(([key]) => !knownKeys.has(key))
    .map(([key, value]) => ({
      key,
      label: key,
      value,
    }));

  return [...orderedEntries, ...extraEntries];
}

function getEditableDocumentEntries(
  document: DocumentRecord,
  documentTypeById: Map<string, DocumentType>,
): EditableDocumentEntry[] {
  const values = document.reviewedData ?? document.extractedData ?? {};
  const documentType = documentTypeById.get(document.documentTypeId);

  if (!documentType) {
    return Object.entries(values).map(([key, value]) => ({
      key,
      kind: "text",
      label: key,
      value,
      field: null,
    }));
  }

  const definedEntries = documentType.fields.map((field) => ({
    key: field.key,
    kind: field.kind,
    label: field.label,
    value: values[field.key],
    field,
  }));

  const knownKeys = new Set(documentType.fields.map((field) => field.key));
  const extraEntries = Object.entries(values)
    .filter(([key]) => !knownKeys.has(key))
    .map(([key, value]) => ({
      key,
      kind: "text" as const,
      label: key,
      value,
      field: null,
    }));

  return [...definedEntries, ...extraEntries];
}

function buildDraftForDocument(
  document: DocumentRecord,
  documentTypeById: Map<string, DocumentType>,
): ExtractedRecord {
  return Object.fromEntries(
    getEditableDocumentEntries(document, documentTypeById).map((entry) => [
      entry.key,
      cloneExtractedValue(entry.value),
    ]),
  );
}

function hasDraftChanges(
  document: DocumentRecord,
  draft: ExtractedRecord | undefined,
  documentTypeById: Map<string, DocumentType>,
): boolean {
  const baseDraft = buildDraftForDocument(document, documentTypeById);
  const nextDraft = draft ?? baseDraft;

  return JSON.stringify(baseDraft) !== JSON.stringify(nextDraft);
}

function getRowsForValue(value: string): number {
  if (value.includes("\n")) {
    return clamp(value.split(/\r?\n/).length + 1, 3, 8);
  }

  if (value.length > 90) {
    return 4;
  }

  return 3;
}

function truncateFileName(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function cloneExtractedValue(value: ExtractedValue | undefined): ExtractedValue {
  if (value === undefined) {
    return null;
  }

  if (value === null || typeof value !== "object") {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as ExtractedValue;
}

function getTextRowsForValue(value: ExtractedValue | undefined): number {
  return getRowsForValue(formatEditableValue(value));
}

function createBatchDraft(batch?: ImageBatchRecord): ImageBatchInput {
  return {
    name: batch?.name ?? "",
    description: batch?.description ?? "",
    status: batch?.status ?? "draft",
  };
}

function isRecordValue(value: ExtractedValue): value is Record<string, ExtractedValue> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getProductsRows(value: ExtractedValue | undefined): Record<string, ExtractedValue>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecordValue);
}

function buildEmptyProductRow(field: TableFieldDefinition): Record<string, ExtractedValue> {
  return Object.fromEntries(field.columns.map((column) => [column.key, null]));
}

export function DocumentsWorkbench({
  activeBatch,
  initialDocumentTypes,
  initialDocuments,
}: {
  activeBatch?: ImageBatchRecord;
  initialDocumentTypes: DocumentType[];
  initialDocuments: DocumentRecord[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectAllCheckboxRef = useRef<HTMLInputElement | null>(null);
  const selectedFilesRef = useRef<SelectedUploadItem[]>([]);
  const uploadPreparationTokenRef = useRef(0);
  const preloadedDocumentImageIdsRef = useRef(new Set<string>());
  const pendingDocumentImagePreloadsRef = useRef<Record<string, HTMLImageElement | undefined>>({});
  const splitContainerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const previewSheetRefs = useRef<Record<string, HTMLElement | null>>({});
  const previewRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const imageWheelCleanupRefs = useRef<Record<string, (() => void) | undefined>>({});
  const [batch, setBatch] = useState(activeBatch);
  const [batchDraft, setBatchDraft] = useState<ImageBatchInput>(() => createBatchDraft(activeBatch));
  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [documentTypeId, setDocumentTypeId] = useState(initialDocumentTypes[0]?.id ?? "");
  const [documents, setDocuments] = useState(initialDocuments);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedUploadItem[]>([]);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [pendingUploadPreparations, setPendingUploadPreparations] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportDocumentTypeId, setExportDocumentTypeId] = useState("");
  const [filter, setFilter] = useState("");
  const [expandedDocumentIds, setExpandedDocumentIds] = useState<string[]>([]);
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ExtractedRecord>>({});
  const [splitRatios, setSplitRatios] = useState<Record<string, number>>({});
  const [viewerStates, setViewerStates] = useState<Record<string, ViewerState>>({});
  const [activeSplitDrag, setActiveSplitDrag] = useState<SplitDragState | null>(null);
  const [activeImagePan, setActiveImagePan] = useState<ImagePanState | null>(null);
  const deferredFilter = useDeferredValue(filter);
  const [isUploading, startUploadTransition] = useTransition();
  const [isDeleting, startDeleteTransition] = useTransition();
  const [isSavingReview, startReviewTransition] = useTransition();
  const [isSavingBatch, startBatchSaveTransition] = useTransition();
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(null);
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null);
  const [extractionProgress, setExtractionProgress] = useState<ExtractionProgress | null>(null);

  const isExtracting = extractionProgress !== null;
  const isPreparingUploads = pendingUploadPreparations > 0;

  const documentTypeById = useMemo(
    () => new Map(initialDocumentTypes.map((documentType) => [documentType.id, documentType])),
    [initialDocumentTypes],
  );

  const extractionProgressValue = extractionProgress
    ? Math.max((extractionProgress.current / extractionProgress.total) * 100, 8)
    : 0;

  const handleWindowPointerMove = useEffectEvent((event: PointerEvent) => {
    if (activeSplitDrag) {
      const nextRatio = clamp(
        activeSplitDrag.startRatio +
          ((event.clientX - activeSplitDrag.startX) / activeSplitDrag.width) * 100,
        28,
        72,
      );

      setSplitRatios((current) => ({
        ...current,
        [activeSplitDrag.documentId]: nextRatio,
      }));
    }

    if (activeImagePan) {
      setViewerStates((current) => {
        const existing = current[activeImagePan.documentId] ?? defaultViewerState;

        return {
          ...current,
          [activeImagePan.documentId]: {
            ...existing,
            x: activeImagePan.originX + (event.clientX - activeImagePan.startX),
            y: activeImagePan.originY + (event.clientY - activeImagePan.startY),
          },
        };
      });
    }
  });

  const handleWindowPointerUp = useEffectEvent((event: PointerEvent) => {
    if (activeSplitDrag) {
      setActiveSplitDrag(null);
    }

    if (activeImagePan && event.pointerId === activeImagePan.pointerId) {
      setActiveImagePan(null);
    }
  });

  useEffect(() => {
    if (!isUploadModalOpen) {
      return;
    }

    const originalOverflow = document.body.style.overflow;

    function resetAndClose() {
      setIsUploadModalOpen(false);
      setIsDragActive(false);
      setSelectedFiles([]);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        resetAndClose();
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUploadModalOpen]);

  useEffect(() => {
    setBatch(activeBatch);
    setBatchDraft(createBatchDraft(activeBatch));
    setIsEditingBatch(false);
  }, [activeBatch]);

  useEffect(() => {
    if (!activeSplitDrag && !activeImagePan) {
      return;
    }

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerUp);

    return () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerUp);
    };
  }, [activeImagePan, activeSplitDrag]);

  const filteredDocuments = useMemo(() => {
    const needle = deferredFilter.trim().toLowerCase();

    if (!needle) {
      return documents;
    }

    return documents.filter((document) => {
      const haystack = [document.originalName, document.documentTypeName, document.status]
        .join(" ")
        .toLowerCase();

      return haystack.includes(needle);
    });
  }, [deferredFilter, documents]);

  const selectedFilteredDocumentCount = useMemo(
    () => filteredDocuments.filter((document) => selectedDocumentIds.includes(document.id)).length,
    [filteredDocuments, selectedDocumentIds],
  );

  const allFilteredDocumentsSelected =
    filteredDocuments.length > 0 && selectedFilteredDocumentCount === filteredDocuments.length;

  useEffect(() => {
    setSelectedDocumentIds((current) => {
      const validIds = new Set(documents.map((document) => document.id));
      const next = current.filter((id) => validIds.has(id));

      return next.length === current.length ? current : next;
    });
  }, [documents]);

  useEffect(() => {
    if (!selectAllCheckboxRef.current) {
      return;
    }

    selectAllCheckboxRef.current.indeterminate =
      selectedFilteredDocumentCount > 0 && !allFilteredDocumentsSelected;
  }, [allFilteredDocumentsSelected, selectedFilteredDocumentCount]);

  useEffect(() => {
    if (!message) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setMessage((current) => (current === message ? null : current));
    }, 4200);

    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!error) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setError((current) => (current === error ? null : current));
    }, 5200);

    return () => window.clearTimeout(timeout);
  }, [error]);

  useEffect(() => {
    selectedFilesRef.current = selectedFiles;
  }, [selectedFiles]);

  useEffect(() => {
    return () => {
      revokeUploadItems(selectedFilesRef.current);
    };
  }, []);

  useEffect(() => {
    if (documents.length === 0) {
      return;
    }

    const pendingDocuments = documents.filter(
      (document) => !preloadedDocumentImageIdsRef.current.has(document.id),
    );

    if (pendingDocuments.length === 0) {
      return;
    }

    let isCancelled = false;
    let nextIndex = 0;
    let activeCount = 0;
    let idleCallbackId: number | null = null;
    let timeoutId: number | null = null;

    const clearPendingImage = (documentId: string) => {
      delete pendingDocumentImagePreloadsRef.current[documentId];
    };

    const preloadDocumentImage = (document: DocumentRecord) => {
      activeCount += 1;

      const image = new window.Image();
      pendingDocumentImagePreloadsRef.current[document.id] = image;

      const finalize = (loaded: boolean) => {
        clearPendingImage(document.id);

        if (loaded) {
          preloadedDocumentImageIdsRef.current.add(document.id);
        }

        activeCount -= 1;
        schedulePreload();
      };

      image.decoding = "async";
      image.onload = () => finalize(true);
      image.onerror = () => finalize(false);
      image.src = `/api/documents/${document.id}/file`;
    };

    const runPreloadQueue = () => {
      if (isCancelled) {
        return;
      }

      while (activeCount < imagePreloadConcurrency && nextIndex < pendingDocuments.length) {
        preloadDocumentImage(pendingDocuments[nextIndex]);
        nextIndex += 1;
      }
    };

    const schedulePreload = () => {
      if (isCancelled) {
        return;
      }

      if (typeof window.requestIdleCallback === "function") {
        idleCallbackId = window.requestIdleCallback(() => {
          idleCallbackId = null;
          runPreloadQueue();
        });

        return;
      }

      timeoutId = window.setTimeout(() => {
        timeoutId = null;
        runPreloadQueue();
      }, 120);
    };

    schedulePreload();

    return () => {
      isCancelled = true;

      if (idleCallbackId !== null) {
        window.cancelIdleCallback(idleCallbackId);
      }

      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }

      for (let index = 0; index < pendingDocuments.length; index += 1) {
        const documentId = pendingDocuments[index].id;
        const image = pendingDocumentImagePreloadsRef.current[documentId];

        if (!image) {
          continue;
        }

        image.onload = null;
        image.onerror = null;
        clearPendingImage(documentId);
      }
    };
  }, [documents]);

  const updatePreviewOffsets = useEffectEvent(() => {
    const isDesktop = window.innerWidth > 820;

    for (const documentId of expandedDocumentIds) {
      const previewSheet = previewSheetRefs.current[documentId];
      const preview = previewRefs.current[documentId];

      if (!previewSheet || !preview) {
        continue;
      }

      if (!isDesktop) {
        preview.style.setProperty("--preview-offset", "0px");
        continue;
      }

      const sheetRect = previewSheet.getBoundingClientRect();
      const maxOffset = Math.max(
        0,
        previewSheet.clientHeight - preview.offsetHeight - previewScrollBottomInset,
      );
      const nextOffset = clamp(previewScrollTopOffset - sheetRect.top, 0, maxOffset);

      preview.style.setProperty("--preview-offset", `${nextOffset}px`);
    }
  });

  useEffect(() => {
    if (expandedDocumentIds.length === 0) {
      return;
    }

    let frameId = 0;

    const scheduleUpdate = () => {
      if (frameId !== 0) {
        return;
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        updatePreviewOffsets();
      });
    };

    scheduleUpdate();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      if (frameId !== 0) {
        window.cancelAnimationFrame(frameId);
      }

      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [expandedDocumentIds, splitRatios, documents]);

  function clearDocumentTransientState(id: string) {
    setReviewDrafts((current) => {
      if (!(id in current)) {
        return current;
      }

      const next = { ...current };
      delete next[id];
      return next;
    });

    setViewerStates((current) => {
      if (!(id in current)) {
        return current;
      }

      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function clearSelectedFiles() {
    uploadPreparationTokenRef.current += 1;
    setSelectedFiles((current) => {
      revokeUploadItems(current);
      return [];
    });
  }

  function closeUploadModal() {
    setIsUploadModalOpen(false);
    setIsDragActive(false);
    clearSelectedFiles();
  }

  function openUploadModal() {
    setError(null);
    setMessage(null);
    setIsUploadModalOpen(true);
  }

  async function addFiles(filesToAdd: File[]) {
    const validFiles = filesToAdd.filter(isImageFile);
    const rejectedCount = filesToAdd.length - validFiles.length;

    if (rejectedCount > 0) {
      setError(
        rejectedCount === 1
          ? "Only image files can be added. One file was ignored."
          : `Only image files can be added. ${rejectedCount} files were ignored.`,
      );
    }

    if (validFiles.length === 0) {
      return;
    }

    const preparationToken = uploadPreparationTokenRef.current;

    setPendingUploadPreparations((current) => current + 1);

    try {
      const preparedUploads: PreparedUpload[] = [];

      for (const file of validFiles) {
        preparedUploads.push(await optimizeUploadImage(file));
      }

      if (preparationToken !== uploadPreparationTokenRef.current) {
        return;
      }

      setSelectedFiles((current) => mergeUploadItems(current, preparedUploads, documentTypeId));
      setError(null);
      setMessage(buildUploadPreparationMessage(preparedUploads));
    } finally {
      setPendingUploadPreparations((current) => Math.max(0, current - 1));
    }
  }

  function removeSelectedFile(signature: string) {
    setSelectedFiles((current) => {
      const next = current.filter((item) => item.signature !== signature);
      const removedItem = current.find((item) => item.signature === signature);

      if (removedItem) {
        URL.revokeObjectURL(removedItem.previewUrl);
      }

      return next;
    });
  }

  function handleDefaultDocumentTypeChange(nextDocumentTypeId: string) {
    setDocumentTypeId(nextDocumentTypeId);
    setSelectedFiles((current) =>
      current.map((item) =>
        item.usesDefaultDocumentType
          ? {
              ...item,
              documentTypeId: nextDocumentTypeId,
            }
          : item,
      ),
    );
  }

  function handleSelectedFileDocumentTypeChange(signature: string, nextDocumentTypeId: string) {
    setSelectedFiles((current) =>
      current.map((item) =>
        item.signature === signature
          ? {
              ...item,
              documentTypeId: nextDocumentTypeId,
              usesDefaultDocumentType: nextDocumentTypeId === documentTypeId,
            }
          : item,
      ),
    );
  }

  async function requestExtraction(id: string) {
    const response = await fetch(`/api/documents/${id}/extract`, {
      method: "POST",
    });
    const data = (await response.json()) as ExtractionResponse;

    return {
      ok: response.ok,
      item: data.item,
      warning: data.warning,
      error: data.error ?? (response.ok ? undefined : "Extraction failed."),
    };
  }

  function ensureExpandedDocumentState(document: DocumentRecord) {
    setReviewDrafts((current) =>
      current[document.id]
        ? current
        : {
            ...current,
            [document.id]: buildDraftForDocument(document, documentTypeById),
          },
    );

    setSplitRatios((current) =>
      current[document.id]
        ? current
        : {
            ...current,
            [document.id]: defaultSplitRatio,
          },
    );

    setViewerStates((current) =>
      current[document.id]
        ? current
        : {
            ...current,
            [document.id]: defaultViewerState,
          },
    );
  }

  function toggleDocumentExpanded(document: DocumentRecord) {
    const isExpanded = expandedDocumentIds.includes(document.id);

    setExpandedDocumentIds((current) =>
      isExpanded ? current.filter((id) => id !== document.id) : [...current, document.id],
    );

    if (!isExpanded) {
      ensureExpandedDocumentState(document);
    }
  }

  function toggleDocumentSelected(documentId: string) {
    setSelectedDocumentIds((current) =>
      current.includes(documentId)
        ? current.filter((id) => id !== documentId)
        : [...current, documentId],
    );
  }

  function toggleAllFilteredDocuments(checked: boolean) {
    const filteredIds = filteredDocuments.map((document) => document.id);

    setSelectedDocumentIds((current) => {
      const next = new Set(current);

      for (const id of filteredIds) {
        if (checked) {
          next.add(id);
        } else {
          next.delete(id);
        }
      }

      return Array.from(next);
    });
  }

  function updateViewerState(documentId: string, updater: (current: ViewerState) => ViewerState) {
    setViewerStates((current) => {
      const existing = current[documentId] ?? defaultViewerState;
      const next = updater(existing);

      return {
        ...current,
        [documentId]: next.zoom <= 1 ? defaultViewerState : next,
      };
    });
  }

  function setViewerZoom(documentId: string, nextZoom: number) {
    updateViewerState(documentId, (current) => ({
      ...current,
      zoom: clamp(Number(nextZoom.toFixed(2)), 1, 6),
    }));
  }

  function beginBatchEdit() {
    if (!batch) {
      return;
    }

    setBatchDraft(createBatchDraft(batch));
    setIsEditingBatch(true);
    setError(null);
    setMessage(null);
  }

  function cancelBatchEdit() {
    setBatchDraft(createBatchDraft(batch));
    setIsEditingBatch(false);
  }

  function handleBatchFieldChange<K extends keyof ImageBatchInput>(
    key: K,
    value: ImageBatchInput[K],
  ) {
    setBatchDraft((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function handleBatchSave() {
    if (!batch) {
      return;
    }

    setError(null);
    setMessage(null);

    startBatchSaveTransition(async () => {
      try {
        const payload = imageBatchInputSchema.parse(batchDraft);
        const response = await fetch(`/api/image-batches/${batch.id}`, {
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

        setBatch(data.item);
        setBatchDraft(createBatchDraft(data.item));
        setIsEditingBatch(false);
        setMessage(`Updated batch ${data.item.name}.`);
        router.refresh();
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Image batch update failed.");
      }
    });
  }

  async function handleUpload(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!batch) {
      setError("Open an image batch before uploading documents.");
      return;
    }

    if (selectedFiles.length === 0 || !documentTypeId) {
      setError("Choose a document type and add at least one image file first.");
      return;
    }

    const hasMissingDocumentType = selectedFiles.some((item) => !item.documentTypeId);

    if (hasMissingDocumentType) {
      setError("Choose a document type for each queued image before uploading.");
      return;
    }

    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.append("documentTypeId", documentTypeId);
  formData.append("imageBatchId", batch.id);

    for (const item of selectedFiles) {
      formData.append("files", item.file);
      formData.append("documentTypeIds", item.documentTypeId);
    }

    startUploadTransition(async () => {
      try {
        const response = await fetch("/api/documents", {
          method: "POST",
          body: formData,
        });

        const data = (await response.json()) as UploadDocumentsResponse;
        const uploadedItems = data.items ?? (data.item ? [data.item] : []);

        if (!response.ok || uploadedItems.length === 0) {
          throw new Error(data.error ?? "Upload failed.");
        }

        setDocuments((current) => [...uploadedItems, ...current]);
        setMessage(
          uploadedItems.length === 1
            ? `Uploaded ${uploadedItems[0].originalName}.`
            : `Uploaded ${uploadedItems.length} documents.`,
        );
        trackEvent("document_upload", {
          batch_scope: "image_batch",
          document_type_count: new Set(
            selectedFiles.map((item) => item.documentTypeId).filter(Boolean),
          ).size,
          file_count: uploadedItems.length,
          optimized_file_count: selectedFiles.filter(
            (item) => !item.optimization.preservedOriginal,
          ).length,
          resized_file_count: selectedFiles.filter((item) => item.optimization.resized).length,
          status: "success",
        });
        closeUploadModal();
        router.refresh();
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Upload failed.");
      }
    });
  }

  function handleExtract(id: string) {
    const document = documents.find((item) => item.id === id);

    if (!document) {
      return;
    }

    setError(null);
    setMessage(null);
    setExtractionProgress({
      current: 1,
      currentDocumentName: document.originalName,
      total: 1,
    });

    setDocuments((current) =>
      current.map((currentDocument) =>
        currentDocument.id === id
          ? { ...currentDocument, status: "processing", errorMessage: null }
          : currentDocument,
      ),
    );

    void (async () => {
      try {
        const data = await requestExtraction(id);

        if (!data.ok) {
          const nextError = data.error ?? "Extraction failed.";

          setDocuments((current) =>
            current.map((currentDocument) => {
              if (currentDocument.id !== id) {
                return currentDocument;
              }

              return data.item
                ? data.item
                : { ...currentDocument, status: "failed", errorMessage: nextError };
            }),
          );
          trackEvent("document_extraction", {
            document_count: 1,
            mode: "single",
            status: "failed",
          });
          setError(nextError);
          return;
        }

        if (!data.item) {
          throw new Error("Extraction completed without a document payload.");
        }

        clearDocumentTransientState(id);
        setDocuments((current) =>
          current.map((currentDocument) => (currentDocument.id === id ? data.item! : currentDocument)),
        );
        trackEvent("document_extraction", {
          document_count: 1,
          mode: "single",
          status: data.warning ? "warning" : "success",
        });
        setMessage(data.warning ?? `Extracted ${data.item.originalName}.`);
        router.refresh();
      } catch (extractError) {
        const nextError =
          extractError instanceof Error ? extractError.message : "Extraction failed.";

        setDocuments((current) =>
          current.map((currentDocument) =>
            currentDocument.id === id
              ? { ...currentDocument, status: "failed", errorMessage: nextError }
              : currentDocument,
          ),
        );
        trackEvent("document_extraction", {
          document_count: 1,
          mode: "single",
          status: "failed",
        });
        setError(nextError);
      } finally {
        setExtractionProgress(null);
      }
    })();
  }

  function handleExtractAll() {
    if (selectedDocumentIds.length === 0) {
      setError("Select at least one stored document before running batch extraction.");
      setMessage(null);
      return;
    }

    const selectedDocuments = documents.filter((document) => selectedDocumentIds.includes(document.id));
    const queuedDocuments = selectedDocuments.filter((document) => document.status !== "processing");

    if (queuedDocuments.length === 0) {
      setError("No selected documents are available for batch extraction.");
      setMessage(null);
      return;
    }

    setError(null);
    setMessage(null);

    void (async () => {
      let successCount = 0;
      let failureCount = 0;
      const skippedCount = selectedDocuments.length - queuedDocuments.length;

      try {
        for (const [index, document] of queuedDocuments.entries()) {
          setExtractionProgress({
            current: index + 1,
            currentDocumentName: document.originalName,
            total: queuedDocuments.length,
          });

          setDocuments((current) =>
            current.map((currentDocument) =>
              currentDocument.id === document.id
                ? { ...currentDocument, status: "processing", errorMessage: null }
                : currentDocument,
            ),
          );

          try {
            const data = await requestExtraction(document.id);

            if (!data.ok) {
              failureCount += 1;
              const nextError = data.error ?? "Extraction failed.";

              setDocuments((current) =>
                current.map((currentDocument) => {
                  if (currentDocument.id !== document.id) {
                    return currentDocument;
                  }

                  return data.item
                    ? data.item
                    : { ...currentDocument, status: "failed", errorMessage: nextError };
                }),
              );
              continue;
            }

            if (!data.item) {
              throw new Error("Extraction completed without a document payload.");
            }

            clearDocumentTransientState(document.id);
            successCount += 1;
            setDocuments((current) =>
              current.map((currentDocument) =>
                currentDocument.id === document.id ? data.item! : currentDocument,
              ),
            );
          } catch (extractError) {
            failureCount += 1;
            const nextError =
              extractError instanceof Error ? extractError.message : "Extraction failed.";

            setDocuments((current) =>
              current.map((currentDocument) =>
                currentDocument.id === document.id
                  ? { ...currentDocument, status: "failed", errorMessage: nextError }
                  : currentDocument,
              ),
            );
          }
        }

        setMessage(
          `Processed ${queuedDocuments.length} documents (${successCount} succeeded${
            failureCount > 0 ? `, ${failureCount} failed` : ""
          }${skippedCount > 0 ? `, ${skippedCount} skipped` : ""}).`,
        );
        trackEvent("document_extraction", {
          document_count: queuedDocuments.length,
          failure_count: failureCount,
          mode: "batch",
          skipped_count: skippedCount,
          status:
            failureCount > 0 ? (successCount > 0 ? "partial" : "failed") : "success",
          success_count: successCount,
        });

        if (failureCount > 0) {
          setError(`${failureCount} document extractions failed. Check the affected rows for details.`);
        }

        router.refresh();
      } catch (extractError) {
        setError(
          extractError instanceof Error ? extractError.message : "Batch extraction failed.",
        );
      } finally {
        setExtractionProgress(null);
      }
    })();
  }

  function handleDelete(document: DocumentRecord) {
    const confirmed = window.confirm(
      `Delete ${document.originalName}? This removes the stored file and its extracted data.`,
    );

    if (!confirmed) {
      return;
    }

    setError(null);
    setMessage(null);
    setDeletingDocumentId(document.id);

    startDeleteTransition(async () => {
      try {
        const response = await fetch(`/api/documents/${document.id}`, {
          method: "DELETE",
        });
        const data = (await response.json()) as {
          item?: DocumentRecord;
          error?: string;
        };

        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Delete failed.");
        }

        setDocuments((current) => current.filter((item) => item.id !== document.id));
        setExpandedDocumentIds((current) => current.filter((id) => id !== document.id));
        clearDocumentTransientState(document.id);
        setMessage(`Deleted ${document.originalName}.`);
        router.refresh();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Delete failed.");
      } finally {
        setDeletingDocumentId(null);
      }
    });
  }

  function handleReviewFieldChange(
    document: DocumentRecord,
    key: string,
    value: ExtractedValue,
  ) {
    setReviewDrafts((current) => {
      const existing = current[document.id] ?? buildDraftForDocument(document, documentTypeById);

      return {
        ...current,
        [document.id]: {
          ...existing,
          [key]: value,
        },
      };
    });
  }

  function handleProductCellChange(
    document: DocumentRecord,
    field: TableFieldDefinition,
    rowIndex: number,
    column: ProductColumnDefinition,
    value: string,
  ) {
    setReviewDrafts((current) => {
      const existing = current[document.id] ?? buildDraftForDocument(document, documentTypeById);
      const rows = getProductsRows(existing[field.key]).map((row) => ({ ...row }));
      const nextRow = rows[rowIndex] ?? buildEmptyProductRow(field);

      rows[rowIndex] = {
        ...nextRow,
        [column.key]: value,
      };

      return {
        ...current,
        [document.id]: {
          ...existing,
          [field.key]: rows,
        },
      };
    });
  }

  function handleAddProductRow(document: DocumentRecord, field: TableFieldDefinition) {
    setReviewDrafts((current) => {
      const existing = current[document.id] ?? buildDraftForDocument(document, documentTypeById);
      const rows = getProductsRows(existing[field.key]).map((row) => ({ ...row }));

      return {
        ...current,
        [document.id]: {
          ...existing,
          [field.key]: [...rows, buildEmptyProductRow(field)],
        },
      };
    });
  }

  function handleRemoveProductRow(
    document: DocumentRecord,
    field: TableFieldDefinition,
    rowIndex: number,
  ) {
    setReviewDrafts((current) => {
      const existing = current[document.id] ?? buildDraftForDocument(document, documentTypeById);
      const rows = getProductsRows(existing[field.key]).filter((_, index) => index !== rowIndex);

      return {
        ...current,
        [document.id]: {
          ...existing,
          [field.key]: rows,
        },
      };
    });
  }

  function handleResetReview(document: DocumentRecord) {
    setReviewDrafts((current) => ({
      ...current,
      [document.id]: buildDraftForDocument(document, documentTypeById),
    }));
    setError(null);
    setMessage(`Reset edits for ${document.originalName}.`);
  }

  function handleSaveReview(document: DocumentRecord, status: ExtractionStatus = "reviewed") {
    const reviewedData = reviewDrafts[document.id] ?? buildDraftForDocument(document, documentTypeById);

    setError(null);
    setMessage(null);
    setSavingDocumentId(document.id);

    startReviewTransition(async () => {
      try {
        const response = await fetch(`/api/documents/${document.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ reviewedData, status }),
        });
        const data = (await response.json()) as ReviewResponse;

        if (!response.ok || !data.item) {
          throw new Error(data.error ?? "Review save failed.");
        }

        setDocuments((current) =>
          current.map((currentDocument) =>
            currentDocument.id === document.id ? data.item! : currentDocument,
          ),
        );
        setReviewDrafts((current) => ({
          ...current,
          [document.id]: buildDraftForDocument(data.item!, documentTypeById),
        }));
        setMessage(
          status === "completed"
            ? `Marked ${data.item.originalName} as completed.`
            : document.status === "completed"
              ? `Moved ${data.item.originalName} back to reviewed.`
              : `Saved review for ${data.item.originalName}.`,
        );
        router.refresh();
      } catch (reviewError) {
        setError(
          reviewError instanceof Error
            ? reviewError.message
            : status === "completed"
              ? "Complete action failed."
              : "Review save failed.",
        );
      } finally {
        setSavingDocumentId(null);
      }
    });
  }

  function handleStartSplitResize(documentId: string, event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    const container = splitContainerRefs.current[documentId];

    if (!container) {
      return;
    }

    const { width } = container.getBoundingClientRect();

    if (width <= 0) {
      return;
    }

    event.preventDefault();
    setActiveSplitDrag({
      documentId,
      startRatio: splitRatios[documentId] ?? defaultSplitRatio,
      startX: event.clientX,
      width,
    });
  }

  function handleImageWheel(documentId: string, deltaY: number) {
    const delta = deltaY < 0 ? 0.2 : -0.2;

    setViewerStates((current) => {
      const existing = current[documentId] ?? defaultViewerState;
      const nextZoom = clamp(Number((existing.zoom + delta).toFixed(2)), 1, 6);

      return {
        ...current,
        [documentId]: nextZoom <= 1 ? defaultViewerState : { ...existing, zoom: nextZoom },
      };
    });
  }

  function bindImageWheel(documentId: string, node: HTMLDivElement | null) {
    imageWheelCleanupRefs.current[documentId]?.();

    if (!node) {
      delete imageWheelCleanupRefs.current[documentId];
      return;
    }

    const listener = (event: WheelEvent) => {
      event.preventDefault();
      handleImageWheel(documentId, event.deltaY);
    };

    node.addEventListener("wheel", listener, { passive: false });
    imageWheelCleanupRefs.current[documentId] = () => {
      node.removeEventListener("wheel", listener);
    };
  }

  function handleImagePointerDown(
    documentId: string,
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (event.button !== 0) {
      return;
    }

    const viewer = viewerStates[documentId] ?? defaultViewerState;

    if (viewer.zoom <= 1) {
      return;
    }

    event.preventDefault();
    setActiveImagePan({
      documentId,
      originX: viewer.x,
      originY: viewer.y,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
    });
  }

  function downloadExport(kind: "csv" | "xlsx") {
    if (!batch) {
      setError("Open an image batch before exporting records.");
      return;
    }

    const searchParams = new URLSearchParams({ batchId: batch.id });

    if (exportDocumentTypeId) {
      searchParams.set("documentTypeId", exportDocumentTypeId);
    }

    const exportHref = `/api/exports/${kind}?${searchParams.toString()}`;

    trackEvent(
      "document_export",
      {
        format: kind,
        scope: exportDocumentTypeId ? "document_type" : "batch",
        status: "started",
      },
      {
        eventCallback: () => {
          window.location.href = exportHref;
        },
      },
    );
  }

  const uploadCountLabel =
    selectedFiles.length === 1 ? "1 file ready" : `${selectedFiles.length} files ready`;

  const queuedOriginalBytes = selectedFiles.reduce(
    (total, item) => total + item.optimization.originalBytes,
    0,
  );
  const queuedProcessedBytes = selectedFiles.reduce(
    (total, item) => total + item.optimization.processedBytes,
    0,
  );
  const queuedSavedBytes = Math.max(0, queuedOriginalBytes - queuedProcessedBytes);
  const queuedTranscodedCount = selectedFiles.filter(
    (item) => item.optimization.transcodedToWebp,
  ).length;
  const queuedResizedCount = selectedFiles.filter((item) => item.optimization.resized).length;

  const hasMultipleDocumentTypesSelected =
    new Set(selectedFiles.map((item) => item.documentTypeId).filter(Boolean)).size > 1;

  const uploadModal = isUploadModalOpen ? (
    <div
      aria-modal="true"
      className="modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isUploading && !isPreparingUploads) {
          closeUploadModal();
        }
      }}
      role="dialog"
    >
      <div
        className="modal-panel paper-panel w-full max-w-5xl p-5 sm:p-6"
        data-drop-target="true"
        data-drag-active={isDragActive ? "true" : "false"}
        onClick={(event) => {
          const interactiveTarget = (event.target as HTMLElement | null)?.closest(
            "button, input, select, textarea, a, label",
          );

          if (!interactiveTarget) {
            fileInputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();

          if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
            return;
          }

          setIsDragActive(false);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragActive(true);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragActive(false);
          void addFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="data-label">Batch Upload</p>
            <h2 className="mt-3 text-2xl font-semibold">Add documents</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
              Drop one or more scanned images here, set the default document type for the
              queue, then override individual files where needed.
            </p>
            <p className="mt-2 max-w-2xl text-xs text-[var(--muted)]">
              Images are converted to WebP when it helps and resized to a maximum long edge of {gemmaEfficientMaxImageDimension}px for Gemma-friendly uploads.
            </p>
            {batch ? (
              <p className="mt-3 text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                Active batch: {batch.name}
              </p>
            ) : null}
          </div>
          <button
            className="secondary-button"
            disabled={isUploading}
            onClick={closeUploadModal}
            type="button"
          >
            Close
          </button>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleUpload}>
          <label className="block space-y-2">
            <span className="data-label">Document Type</span>
            <select
              className="select-base"
              value={documentTypeId}
              onChange={(event) => handleDefaultDocumentTypeChange(event.target.value)}
            >
              {initialDocumentTypes.map((documentType) => (
                <option key={documentType.id} value={documentType.id}>
                  {documentType.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--muted)]">
              New files inherit this value. Change any queued file below to override it.
            </p>
          </label>

          <input
            accept="image/*"
            className="sr-only"
            multiple
            onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []));
              event.currentTarget.value = "";
            }}
            ref={fileInputRef}
            type="file"
          />

          <div
            className="dropzone-panel"
            data-active={isDragActive ? "true" : "false"}
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-lg font-semibold text-[var(--ink)]">
                  Drop images anywhere in this window or browse from disk
                </p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  PNG, JPG, WEBP, TIFF, and other image uploads are accepted.
                </p>
              </div>
              <button
                className="secondary-button"
                onClick={() => fileInputRef.current?.click()}
                type="button"
              >
                Choose files
              </button>
            </div>
          </div>

          <div className="record-sheet p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="data-label">Upload Queue</p>
                <p className="mt-2 text-sm text-[var(--muted)]">{uploadCountLabel}</p>
              </div>
              {selectedFiles.length > 0 ? (
                <button
                  className="secondary-button"
                  onClick={clearSelectedFiles}
                  type="button"
                >
                  Clear queue
                </button>
              ) : null}
            </div>

            {selectedFiles.length > 0 ? (
              <p className="mt-3 text-xs text-[var(--muted)]">
                {hasMultipleDocumentTypesSelected
                  ? "Multiple document types are queued. Each image will keep its selected type."
                  : "All queued images currently use the same document type."}
              </p>
            ) : null}

            {selectedFiles.length > 0 ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                {queuedTranscodedCount > 0 || queuedResizedCount > 0
                  ? `${queuedTranscodedCount} WebP conversions, ${queuedResizedCount} resized, ${formatFileSize(queuedProcessedBytes)} queued${queuedSavedBytes > 0 ? `, ${formatFileSize(queuedSavedBytes)} saved` : ""}.`
                  : `${formatFileSize(queuedProcessedBytes)} queued without client-side changes.`}
              </p>
            ) : null}

            {isPreparingUploads ? (
              <p className="mt-2 text-xs text-[var(--muted)]">
                Optimizing queued images before upload...
              </p>
            ) : null}

            {selectedFiles.length === 0 ? (
              <div className="mt-4 border-2 border-dashed border-[color:var(--line)] p-5 text-sm text-[var(--muted)]">
                No images queued yet.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                {selectedFiles.map((item) => {
                  const truncatedFileName = truncateFileName(item.file.name, 44);

                  return (
                    <div
                      key={item.signature}
                      className="upload-queue-item border-2 border-[color:var(--line)] bg-[var(--panel-strong)] px-3 py-2"
                    >
                      <div className="upload-queue-item__preview">
                        <Image
                          alt={`Preview for ${item.file.name}`}
                          className="upload-queue-item__thumbnail"
                          src={item.previewUrl}
                          unoptimized
                          width={88}
                          height={88}
                        />
                      </div>
                      <div className="min-w-0">
                        <p
                          className="upload-queue-item__name truncate font-medium text-[var(--ink)]"
                          title={item.file.name}
                        >
                          {truncatedFileName}
                        </p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {[
                            item.optimization.transcodedToWebp ? "WebP" : "Original",
                            item.optimization.targetWidth && item.optimization.targetHeight
                              ? `${item.optimization.targetWidth}x${item.optimization.targetHeight}`
                              : null,
                            formatFileSize(item.optimization.processedBytes),
                            item.optimization.processedBytes < item.optimization.originalBytes
                              ? `from ${formatFileSize(item.optimization.originalBytes)}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <div className="upload-queue-item__controls">
                        <label className="block min-w-0 flex-1 sm:max-w-xs">
                          <span className="sr-only">Document type for {item.file.name}</span>
                          <select
                            className="queue-file-select select-base"
                            value={item.documentTypeId}
                            onChange={(event) =>
                              handleSelectedFileDocumentTypeChange(
                                item.signature,
                                event.target.value,
                              )
                            }
                          >
                            {initialDocumentTypes.map((documentType) => (
                              <option key={documentType.id} value={documentType.id}>
                                {documentType.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          aria-label={`Remove ${item.file.name}`}
                          className="queue-remove-button"
                          onClick={() => removeSelectedFile(item.signature)}
                          title="Remove file"
                          type="button"
                        >
                          <FontAwesomeIcon icon={faXmark} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 border-t-2 border-[color:var(--line)] pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--muted)]">
              Each queued image will be stored as a separate document in this batch.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="secondary-button"
                disabled={isUploading || isPreparingUploads}
                onClick={closeUploadModal}
                type="button"
              >
                Cancel
              </button>
              <button className="action-button" disabled={isUploading || isPreparingUploads} type="submit">
                {isPreparingUploads
                  ? "Optimizing..."
                  : isUploading
                  ? "Saving..."
                  : selectedFiles.length <= 1
                    ? "Store document"
                    : `Store ${selectedFiles.length} documents`}
              </button>
            </div>
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
              <button
                aria-label="Dismiss message"
                className="toast-dismiss-button"
                onClick={() => setMessage(null)}
                type="button"
              >
                ×
              </button>
            </div>
          ) : null}
          {error ? (
            <div className="app-toast" data-tone="error">
              <p>{error}</p>
              <button
                aria-label="Dismiss error"
                className="toast-dismiss-button"
                onClick={() => setError(null)}
                type="button"
              >
                ×
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {extractionProgress ? (
        <div aria-live="polite" className="extraction-overlay" role="status">
          <div className="extraction-card paper-panel p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <span aria-hidden="true" className="extraction-spinner" />
              <div className="min-w-0 flex-1">
                <p className="data-label">Extraction Running</p>
                <p className="mt-2 text-xl font-semibold text-[var(--ink)]">
                  Processing {extractionProgress.current}/{extractionProgress.total}
                </p>
                <p className="mt-2 truncate text-sm text-[var(--muted)]">
                  {extractionProgress.currentDocumentName}
                </p>
                <div className="extraction-progress-track mt-4">
                  <div
                    className="extraction-progress-fill"
                    style={{ width: `${extractionProgressValue}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="paper-panel p-6 sm:p-8">
        <div className="space-y-5">
          {batch ? (
            isEditingBatch ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Link aria-label="Back to batches" className="header-icon-button" href="/batches" title="Back to Batches">
                    <FontAwesomeIcon icon={faArrowLeft} />
                    <span className="sr-only">Back to Batches</span>
                  </Link>
                  <div className="flex items-center gap-3">
                    <button
                      aria-label="Cancel batch edit"
                      className="header-icon-button"
                      disabled={isSavingBatch}
                      onClick={cancelBatchEdit}
                      title="Cancel"
                      type="button"
                    >
                      <FontAwesomeIcon icon={faXmark} />
                      <span className="sr-only">Cancel</span>
                    </button>
                    <button
                      aria-label="Save batch"
                      className="header-icon-button"
                      disabled={isSavingBatch}
                      onClick={handleBatchSave}
                      title={isSavingBatch ? "Saving..." : "Save Batch"}
                      type="button"
                    >
                      <FontAwesomeIcon icon={faFloppyDisk} />
                      <span className="sr-only">{isSavingBatch ? "Saving batch" : "Save batch"}</span>
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <p className="data-label">Image Batch</p>
                  <div />
                </div>
                <h1 className="text-3xl font-semibold sm:text-4xl">Edit batch details</h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                  Update the batch name, notes, or current status without leaving the editor.
                </p>
                <div className="mt-6 grid gap-4">
                  <label className="block space-y-2">
                    <span className="data-label">Name</span>
                    <input
                      className="input-base"
                      value={batchDraft.name}
                      onChange={(event) => handleBatchFieldChange("name", event.target.value)}
                      placeholder="Project Atlas invoices"
                    />
                  </label>
                  <label className="block space-y-2">
                    <span className="data-label">Description</span>
                    <textarea
                      className="input-base min-h-28"
                      value={batchDraft.description}
                      onChange={(event) => handleBatchFieldChange("description", event.target.value)}
                      placeholder="April vendor invoices for Project Atlas"
                    />
                  </label>
                  <label className="block max-w-xs space-y-2">
                    <span className="data-label">Status</span>
                    <select
                      className="select-base"
                      value={batchDraft.status}
                      onChange={(event) =>
                        handleBatchFieldChange(
                          "status",
                          event.target.value as ImageBatchInput["status"],
                        )
                      }
                    >
                      {batchStatusValues.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Link aria-label="Back to batches" className="header-icon-button" href="/batches" title="Back to Batches">
                    <FontAwesomeIcon icon={faArrowLeft} />
                    <span className="sr-only">Back to Batches</span>
                  </Link>
                  <button
                    aria-label="Edit batch"
                    className="header-icon-button"
                    onClick={beginBatchEdit}
                    title="Edit Batch"
                    type="button"
                  >
                    <FontAwesomeIcon icon={faPenToSquare} />
                    <span className="sr-only">Edit Batch</span>
                  </button>
                </div>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between xl:gap-6">
                  <div className="min-w-0">
                    <p className="data-label">Image Batch</p>
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      <h1 className="text-3xl font-semibold sm:text-4xl">{batch.name}</h1>
                      <span
                        className="status-pill"
                        data-state={
                          batch.status === "completed"
                            ? "completed"
                            : batch.status === "active"
                              ? "reviewed"
                              : "uploaded"
                        }
                      >
                        {batch.status}
                      </span>
                    </div>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--muted)] sm:text-base">
                      {batch.description || "Add documents to this batch, run extraction, then export the full batch or one document type when review is complete."}
                    </p>
                  </div>

                  <div className="flex flex-col gap-3 xl:min-w-fit xl:items-end">
                    <p className="data-label">Export</p>
                    <div className="flex flex-wrap gap-3 xl:items-center xl:justify-end">
                      <select
                        className="select-base min-w-[14rem] xl:w-auto"
                        value={exportDocumentTypeId}
                        onChange={(event) => setExportDocumentTypeId(event.target.value)}
                      >
                        <option value="">Entire batch</option>
                        {initialDocumentTypes.map((documentType) => (
                          <option key={documentType.id} value={documentType.id}>
                            {documentType.name}
                          </option>
                        ))}
                      </select>
                      <button
                        aria-label="Export records as CSV"
                        className="secondary-button icon-button"
                        onClick={() => downloadExport("csv")}
                        title="Export CSV"
                        type="button"
                      >
                        <FontAwesomeIcon icon={faFileCsv} />
                        <span>CSV</span>
                      </button>
                      <button
                        aria-label="Export records as XLSX"
                        className="secondary-button icon-button"
                        onClick={() => downloadExport("xlsx")}
                        title="Export XLSX"
                        type="button"
                      >
                        <FontAwesomeIcon icon={faFileExcel} />
                        <span>XLSX</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : null}
        </div>
      </section>

      {typeof document !== "undefined" && uploadModal
        ? createPortal(uploadModal, document.body)
        : null}

      <section className="paper-panel p-6 sm:p-8">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex flex-wrap items-center gap-4 xl:pt-3">
            {batch && !isEditingBatch ? (
              <button
                className="action-button icon-button toolbar-action"
                disabled={isUploading}
                onClick={openUploadModal}
                type="button"
              >
                <FontAwesomeIcon icon={faPlus} />
                <span>{isUploading ? "Saving..." : "Add Documents"}</span>
              </button>
            ) : null}
            {batch ? (
              <div className="flex flex-wrap gap-4 text-sm text-[var(--muted)]">
                <span>{documents.length === 1 ? "1 document" : `${documents.length} documents`}</span>
                <span>{batch.processedDocumentCount ?? 0} processed</span>
              </div>
            ) : null}
          </div>
          <button
            className="action-button w-full xl:w-auto"
            disabled={
              isUploading ||
              isExtracting ||
              isDeleting ||
              documents.length === 0 ||
              selectedDocumentIds.length === 0
            }
            onClick={handleExtractAll}
            type="button"
          >
            {isExtracting ? "Running Batch…" : "Run Batch"}
          </button>
        </div>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="data-label">Queue</p>
            <h2 className="mt-3 text-2xl font-semibold">
              {batch ? "Stored documents in this batch" : "Stored documents"}
            </h2>
          </div>
          <div className="flex w-full flex-col gap-3 sm:max-w-md sm:items-end">
            <label className="block w-full space-y-2">
              <span className="data-label">Filter</span>
              <input
                className="input-base"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="invoice, extracted, cheque"
              />
            </label>
          </div>
        </div>
        <div className="mt-6 space-y-4">
          <div className="flex items-center gap-4 px-5 text-sm text-[var(--ink)]">
            <label className="mt-1 flex items-center">
              <span className="sr-only">Select all visible documents</span>
              <input
                ref={selectAllCheckboxRef}
                checked={allFilteredDocumentsSelected}
                className="h-5 w-5 border-2 border-[var(--ink)] accent-[var(--accent)]"
                disabled={filteredDocuments.length === 0 || isExtracting || isDeleting}
                onChange={(event) => toggleAllFilteredDocuments(event.target.checked)}
                type="checkbox"
              />
            </label>
            <p className="min-w-0 flex-1 text-sm text-[var(--muted)]">
              {filteredDocuments.length === 0
                ? "0 of 0 selected"
                : `${selectedFilteredDocumentCount} of ${filteredDocuments.length} selected`}
            </p>
          </div>
          {filteredDocuments.length === 0 ? (
            <div className="border-2 border-dashed border-[var(--ink)] p-6 text-sm text-[var(--muted)]">
              No documents stored yet.
            </div>
          ) : null}
          {filteredDocuments.map((document) => {
            const isSelected = selectedDocumentIds.includes(document.id);
            const isExpanded = expandedDocumentIds.includes(document.id);
            const orderedEntries = getOrderedDocumentEntries(document, documentTypeById);
            const editableEntries = getEditableDocumentEntries(document, documentTypeById);
            const draft = reviewDrafts[document.id] ?? buildDraftForDocument(document, documentTypeById);
            const splitRatio = splitRatios[document.id] ?? defaultSplitRatio;
            const viewer = viewerStates[document.id] ?? defaultViewerState;
            const canReview = editableEntries.length > 0;
            const draftChanged = hasDraftChanges(document, reviewDrafts[document.id], documentTypeById);

            return (
              <article
                key={document.id}
                className="border-2 border-[var(--ink)] bg-[var(--panel-strong)] p-5"
              >
                <div className="flex items-start gap-4">
                  <label className="mt-1 flex items-center">
                    <span className="sr-only">Select {document.originalName}</span>
                    <input
                      checked={isSelected}
                      className="h-5 w-5 border-2 border-[var(--ink)] accent-[var(--accent)]"
                      disabled={isExtracting || isDeleting}
                      onChange={() => toggleDocumentSelected(document.id)}
                      type="checkbox"
                    />
                  </label>
                  <div className="flex min-w-0 flex-1 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="truncate text-xl font-semibold">{document.originalName}</h3>
                        <span className="status-pill" data-state={document.status}>
                          {document.status}
                        </span>
                      </div>
                      <p className="mt-2 font-mono text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
                        {document.documentTypeName} • <TimestampText value={document.createdAt} />
                      </p>
                      {orderedEntries.length > 0 && !isExpanded ? (
                        <p className="mt-3 text-sm text-[var(--muted)]">
                          {orderedEntries.length} extracted field{orderedEntries.length === 1 ? "" : "s"} ready for review.
                          {editableEntries
                            .filter((entry) => entry.kind === "table")
                            .map((entry) => getProductsRows(draft[entry.key]).length)
                            .reduce((sum, count) => sum + count, 0) > 0
                            ? ` ${editableEntries
                                .filter((entry) => entry.kind === "table")
                                .map((entry) => getProductsRows(draft[entry.key]).length)
                                .reduce((sum, count) => sum + count, 0)} rows detected.`
                            : ""}
                        </p>
                      ) : null}
                      {document.errorMessage ? (
                        <p className="mt-3 text-sm text-[var(--danger)]">{document.errorMessage}</p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="secondary-button"
                        onClick={() => toggleDocumentExpanded(document)}
                        type="button"
                      >
                        {isExpanded ? "Collapse" : "Expand"}
                      </button>
                      <button
                        className="action-button"
                        disabled={isExtracting || isDeleting || document.status === "processing"}
                        onClick={() => handleExtract(document.id)}
                        type="button"
                      >
                        {document.status === "processing" ? "Processing…" : "Run Extraction"}
                      </button>
                      <button
                        className="danger-button"
                        disabled={isExtracting || isDeleting}
                        onClick={() => handleDelete(document)}
                        type="button"
                      >
                        {deletingDocumentId === document.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded ? (
                  <div className="mt-5 border-t-2 border-[color:var(--line)] pt-5">
                    <div
                      ref={(node) => {
                        splitContainerRefs.current[document.id] = node;
                      }}
                      className="document-review-split"
                      style={{ ["--split-left" as string]: `${splitRatio}%` }}
                    >
                      <section
                        className="record-sheet document-review-preview-sheet p-4"
                        ref={(node) => {
                          previewSheetRefs.current[document.id] = node;
                        }}
                      >
                        <div
                          className="document-review-preview"
                          ref={(node) => {
                            previewRefs.current[document.id] = node;
                          }}
                        >
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <p className="data-label">Source Image</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                aria-label="Zoom out"
                                className="viewer-icon-button"
                                onClick={() => setViewerZoom(document.id, viewer.zoom - 0.25)}
                                title="Zoom out"
                                type="button"
                              >
                                <FontAwesomeIcon icon={faMagnifyingGlassMinus} />
                              </button>
                              <button
                                aria-label="Zoom in"
                                className="viewer-icon-button"
                                onClick={() => setViewerZoom(document.id, viewer.zoom + 0.25)}
                                title="Zoom in"
                                type="button"
                              >
                                <FontAwesomeIcon icon={faMagnifyingGlassPlus} />
                              </button>
                              <button
                                aria-label="Reset view"
                                className="viewer-icon-button"
                                onClick={() =>
                                  setViewerStates((current) => ({
                                    ...current,
                                    [document.id]: defaultViewerState,
                                  }))
                                }
                                title="Reset view"
                                type="button"
                              >
                                <FontAwesomeIcon icon={faArrowsRotate} />
                              </button>
                            </div>
                          </div>

                          <div
                            className="document-image-stage"
                            data-can-pan={viewer.zoom > 1 ? "true" : "false"}
                            data-panning={
                              activeImagePan?.documentId === document.id && viewer.zoom > 1 ? "true" : "false"
                            }
                            ref={(node) => bindImageWheel(document.id, node)}
                            onPointerDown={(event) => handleImagePointerDown(document.id, event)}
                          >
                            <Image
                              fill
                              alt={`Stored source for ${document.originalName}`}
                              className="document-image-asset"
                              draggable={false}
                              src={`/api/documents/${document.id}/file`}
                              unoptimized
                              style={{
                                transform: `translate(${viewer.x}px, ${viewer.y}px) scale(${viewer.zoom})`,
                              }}
                            />
                          </div>
                        </div>
                      </section>

                      <div
                        aria-label="Resize source image and extracted text columns"
                        className="document-review-resizer"
                        onPointerDown={(event) => handleStartSplitResize(document.id, event)}
                        role="separator"
                      />

                      <section className="record-sheet p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <p className="data-label">Verification</p>
                            <p className="mt-2 text-sm text-[var(--muted)]">Verify and edit fields</p>
                          </div>
                          {canReview ? (
                            <div className="flex flex-wrap gap-2">
                              <button
                                aria-label="Reset review edits"
                                className="review-action-icon-button"
                                disabled={savingDocumentId === document.id || !draftChanged}
                                onClick={() => handleResetReview(document)}
                                title="Reset review edits"
                                type="button"
                              >
                                <FontAwesomeIcon icon={faRotateLeft} />
                              </button>
                              <button
                                aria-label={savingDocumentId === document.id ? "Saving review" : "Save review"}
                                className="review-action-icon-button"
                                disabled={
                                  savingDocumentId === document.id ||
                                  isSavingReview ||
                                  !draftChanged ||
                                  document.status === "processing"
                                }
                                onClick={() => handleSaveReview(document)}
                                title={savingDocumentId === document.id ? "Saving review" : "Save review"}
                                type="button"
                              >
                                <FontAwesomeIcon icon={faFloppyDisk} />
                              </button>
                              <button
                                aria-label={
                                  savingDocumentId === document.id
                                    ? document.status === "completed"
                                      ? "Reverting record to reviewed"
                                      : "Completing record"
                                    : document.status === "completed"
                                      ? "Mark record reviewed"
                                      : "Mark record completed"
                                }
                                className="review-action-icon-button"
                                data-variant="approve"
                                disabled={
                                  savingDocumentId === document.id ||
                                  isSavingReview ||
                                  document.status === "processing"
                                }
                                onClick={() =>
                                  handleSaveReview(
                                    document,
                                    document.status === "completed" ? "reviewed" : "completed",
                                  )
                                }
                                title={document.status === "completed" ? "Mark reviewed" : "Mark completed"}
                                type="button"
                              >
                                <FontAwesomeIcon icon={faCircleCheck} />
                              </button>
                            </div>
                          ) : null}
                        </div>

                        {!canReview ? (
                          <div className="mt-4 border-2 border-dashed border-[color:var(--line)] p-5 text-sm text-[var(--muted)]">
                            Run extraction first to generate editable fields for this document.
                          </div>
                        ) : (
                          <div className="mt-4 space-y-4">
                            {editableEntries.map((entry) => {
                              const currentValue = draft[entry.key];
                              const scalarValue = formatEditableValue(currentValue);
                              const isBoolean = entry.kind === "boolean";
                              const isMultiline =
                                entry.kind === "text" && getTextRowsForValue(currentValue) > 3;

                              if (entry.kind === "table" && entry.field?.kind === "table") {
                                const productsField = entry.field;
                                const productRows = getProductsRows(currentValue);

                                return (
                                  <div
                                    key={entry.key}
                                    className="block border-b border-[color:var(--line)] pb-4 last:border-b-0 last:pb-0"
                                  >
                                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                      <div>
                                        <span className="font-medium text-[var(--ink)]">{entry.label}</span>
                                        <p className="mt-1 text-sm text-[var(--muted)]">
                                          Review each extracted table row separately.
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-3">
                                        <span className="data-label">{entry.key}</span>
                                        <button
                                          className="secondary-button px-3 py-2"
                                          type="button"
                                          onClick={() => handleAddProductRow(document, productsField)}
                                        >
                                          Add Row
                                        </button>
                                      </div>
                                    </div>

                                    <div className="mt-3 overflow-x-auto">
                                      <table className="min-w-full border-collapse text-left">
                                        <thead>
                                          <tr className="border-b border-[color:var(--line)] text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                                            {productsField.columns.map((column) => (
                                              <th key={column.key} className="px-3 py-2 font-medium">
                                                {column.label}
                                              </th>
                                            ))}
                                            <th className="px-3 py-2 font-medium">Actions</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {productRows.length === 0 ? (
                                            <tr>
                                              <td
                                                className="px-3 py-4 text-sm text-[var(--muted)]"
                                                colSpan={productsField.columns.length + 1}
                                              >
                                                No rows yet.
                                              </td>
                                            </tr>
                                          ) : null}
                                          {productRows.map((row, rowIndex) => (
                                            <tr
                                              key={`${entry.key}-${rowIndex}`}
                                              className="border-b border-[color:var(--line)] last:border-b-0"
                                            >
                                              {productsField.columns.map((column) => {
                                                const columnValue = formatEditableValue(row[column.key]);

                                                return (
                                                  <td key={column.key} className="px-3 py-3 align-top">
                                                    {column.kind === "boolean" ? (
                                                      <select
                                                        className="select-base min-w-[9rem]"
                                                        value={columnValue}
                                                        onChange={(event) =>
                                                          handleProductCellChange(
                                                            document,
                                                            productsField,
                                                            rowIndex,
                                                            column,
                                                            event.target.value,
                                                          )
                                                        }
                                                      >
                                                        <option value="">Blank</option>
                                                        <option value="true">True</option>
                                                        <option value="false">False</option>
                                                      </select>
                                                    ) : (
                                                      <input
                                                        className="input-base min-w-[10rem]"
                                                        inputMode={
                                                          column.kind === "currency" || column.kind === "number"
                                                            ? "decimal"
                                                            : undefined
                                                        }
                                                        value={columnValue}
                                                        onChange={(event) =>
                                                          handleProductCellChange(
                                                            document,
                                                            productsField,
                                                            rowIndex,
                                                            column,
                                                            event.target.value,
                                                          )
                                                        }
                                                      />
                                                    )}
                                                  </td>
                                                );
                                              })}
                                              <td className="px-3 py-3 align-top">
                                                <button
                                                  className="danger-button"
                                                  type="button"
                                                  onClick={() => handleRemoveProductRow(document, productsField, rowIndex)}
                                                >
                                                  Remove
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <label
                                  key={entry.key}
                                  className="block border-b border-[color:var(--line)] pb-4 last:border-b-0 last:pb-0"
                                >
                                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                                    <span className="font-medium text-[var(--ink)]">{entry.label}</span>
                                    <span className="data-label">{entry.key}</span>
                                  </div>

                                  {isBoolean ? (
                                    <select
                                      className="select-base mt-3"
                                      value={scalarValue}
                                      onChange={(event) =>
                                        handleReviewFieldChange(document, entry.key, event.target.value)
                                      }
                                    >
                                      <option value="">Blank</option>
                                      <option value="true">True</option>
                                      <option value="false">False</option>
                                    </select>
                                  ) : isMultiline ? (
                                    <textarea
                                      className="textarea-base mt-3"
                                      rows={getTextRowsForValue(currentValue)}
                                      value={scalarValue}
                                      onChange={(event) =>
                                        handleReviewFieldChange(document, entry.key, event.target.value)
                                      }
                                    />
                                  ) : (
                                    <input
                                      className="input-base mt-3"
                                      inputMode={
                                        entry.kind === "currency" || entry.kind === "number"
                                          ? "decimal"
                                          : undefined
                                      }
                                      value={scalarValue}
                                      onChange={(event) =>
                                        handleReviewFieldChange(document, entry.key, event.target.value)
                                      }
                                    />
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    </div>

                    {document.status === "failed" && document.rawResponse ? (
                      <details className="record-sheet mt-5 p-4">
                        <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                          Technical details
                        </summary>
                        <pre className="record-sheet__debug mt-4 overflow-x-auto whitespace-pre-wrap break-words p-3 text-xs leading-6 text-[var(--ink)]">
                          {formatDebugPayload(document.rawResponse)}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}