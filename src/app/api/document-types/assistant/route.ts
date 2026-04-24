import { z } from "zod";

import {
  documentTypeAssistantMessageSchema,
  documentTypeAssistantResultSchema,
} from "@/lib/domain";
import { generateDocumentTypeAssistantResult } from "@/lib/document-type-assistant";
import { checkRateLimit, getRateLimitSource } from "@/lib/rate-limit";
import {
  assertOwnedAssistantSamplePath,
  deleteAssistantSample,
  saveAssistantSample,
  sweepStaleAssistantSamples,
} from "@/lib/storage";
import { requireRouteUser } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const assistantConversationSchema = z.array(documentTypeAssistantMessageSchema).max(12);

function parseJsonField(value: FormDataEntryValue | null, fallback: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fallback;
  }

  return JSON.parse(value);
}

export async function POST(request: Request) {
  try {
    const routeUser = await requireRouteUser();

    if (routeUser instanceof Response) {
      return routeUser;
    }

    const user = routeUser;

    const rateLimit = checkRateLimit({
      key: `document-type-assistant:${getRateLimitSource(request.headers)}:${user.id}`,
      limit: 8,
      windowMs: 15 * 60 * 1000,
    });

    if (!rateLimit.allowed) {
      return Response.json(
        { error: `Too many assistant requests. Try again in ${rateLimit.retryAfterSeconds} seconds.` },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const formData = await request.formData();
    const instruction = String(formData.get("instruction") ?? "").trim();
    const conversation = assistantConversationSchema.parse(
      parseJsonField(formData.get("conversation"), []),
    );
    const currentDraft = parseJsonField(formData.get("currentDraft"), null);
    const currentSamplePath = String(formData.get("sampleFilePath") ?? "").trim();
    const uploadedSample = formData.get("sample");

    let effectiveSamplePath: string | null = currentSamplePath || null;
    let effectiveSampleMimeType: string | null = null;

    if (uploadedSample instanceof File) {
      if (effectiveSamplePath) {
        await deleteAssistantSample(user.id, effectiveSamplePath);
      }

      const storedSample = await saveAssistantSample(uploadedSample);
      effectiveSamplePath = storedSample.filePath;
      effectiveSampleMimeType = storedSample.mimeType;
      await sweepStaleAssistantSamples(user.id);
    } else if (effectiveSamplePath) {
      effectiveSamplePath = assertOwnedAssistantSamplePath(user.id, effectiveSamplePath);
    }

    if (!instruction && conversation.length === 0 && !effectiveSamplePath) {
      return Response.json(
        { error: "Add instructions, a sample image, or both before generating a document type." },
        { status: 400 },
      );
    }

    const result = await generateDocumentTypeAssistantResult({
      conversation,
      currentDraft,
      instruction,
      sampleFilePath: effectiveSamplePath,
      sampleMimeType: effectiveSampleMimeType,
    });

    return Response.json(documentTypeAssistantResultSchema.parse(result));
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return Response.json(
        { error: error.message || "Assistant request payload was invalid." },
        { status: 400 },
      );
    }

    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Document type assistant request failed.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const routeUser = await requireRouteUser();

    if (routeUser instanceof Response) {
      return routeUser;
    }

    const user = routeUser;

    const payload = (await request.json()) as { sampleFilePath?: string };
    const sampleFilePath = String(payload.sampleFilePath ?? "").trim();

    if (!sampleFilePath) {
      return Response.json({ error: "Assistant sample path is required." }, { status: 400 });
    }

    await deleteAssistantSample(user.id, sampleFilePath);
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof SyntaxError || error instanceof z.ZodError) {
      return Response.json({ error: "Assistant cleanup payload was invalid." }, { status: 400 });
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Assistant sample cleanup failed.",
      },
      { status: 500 },
    );
  }
}