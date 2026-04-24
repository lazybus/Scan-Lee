import { describe, expect, it } from "vitest";

import {
  normalizeAssistantDraft,
  shouldFallbackToOllamaForSchemaGeneration,
} from "./document-type-assistant";
import { assertOwnedAssistantSamplePath } from "./storage";

describe("document type assistant normalization", () => {
  it("normalizes invalid keys, duplicate keys, and unsupported kinds", () => {
    const result = normalizeAssistantDraft({
      name: "Invoice",
      description: "Invoice extraction schema for header details and totals.",
      promptTemplate:
        "Extract this invoice into one JSON object. Use the configured keys exactly and return null when a value is missing.",
      analysisSummary: "Detected invoice metadata.",
      fields: [
        {
          key: "Invoice Number",
          label: "Invoice Number",
          kind: "string",
          required: true,
        },
        {
          key: "Invoice Number",
          label: "Invoice Total",
          kind: "amount",
          required: false,
        },
        {
          key: "Approved?",
          label: "Approved",
          kind: "checkbox",
          required: false,
        },
      ],
    });

    expect(result.draft.slug).toBe("invoice");
    expect(result.draft.fields.map((field) => field.key)).toEqual([
      "invoice_number",
      "invoice_number_2",
      "approved",
    ]);
    expect(result.draft.fields.map((field) => field.kind)).toEqual([
      "text",
      "currency",
      "boolean",
    ]);
  });

  it("creates a fallback table column when the AI omits columns", () => {
    const result = normalizeAssistantDraft({
      name: "Invoice",
      fields: [
        {
          key: "line_items",
          label: "Line Items",
          kind: "line_items",
        },
      ],
    });

    expect(result.draft.fields[0]?.kind).toBe("table");
    expect(result.draft.fields[0]).toMatchObject({
      columns: [
        {
          key: "value",
          kind: "text",
          label: "Value",
        },
      ],
    });
    expect(result.warnings.some((warning) => warning.includes("did not include any columns"))).toBe(true);
  });
});

describe("document type assistant fallback policy", () => {
  it.each([
    "GEMINI_API_KEY is not configured.",
    "Google AI request failed: API key not valid.",
    "Google AI request failed: 503 service unavailable.",
    "Google AI request failed: fetch failed.",
  ])("falls back to Ollama for provider availability issue: %s", (message) => {
    expect(shouldFallbackToOllamaForSchemaGeneration(new Error(message))).toBe(true);
  });

  it("does not fall back for an incompatible AI payload", () => {
    expect(
      shouldFallbackToOllamaForSchemaGeneration(
        new Error("AI did not return any fields for the document type."),
      ),
    ).toBe(false);
  });
});

describe("assistant sample ownership", () => {
  it("accepts a user-owned assistant sample path", () => {
    expect(
      assertOwnedAssistantSamplePath(
        "user-123",
        "user-123/assistant-samples/1710000000000-sample.webp",
      ),
    ).toBe("user-123/assistant-samples/1710000000000-sample.webp");
  });

  it("rejects paths outside the user's assistant sample area", () => {
    expect(() =>
      assertOwnedAssistantSamplePath("user-123", "user-999/assistant-samples/1710000000000-sample.webp"),
    ).toThrow("Assistant sample was not found.");
    expect(() =>
      assertOwnedAssistantSamplePath("user-123", "user-123/../assistant-samples/bad.webp"),
    ).toThrow("Assistant sample was not found.");
  });
});