import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { ANALYSIS_PROMPT, ANALYSIS_SCHEMA } from "@/lib/prompt";
import type { BillAnalysis } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const ACCEPTED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);
const MAX_BYTES = 15 * 1024 * 1024; // Gemini inline-data requests cap at ~20MB.
// flash-lite extracts sample bills perfectly in ~6s and rides out the demand
// spikes that intermittently 503 the larger free-tier models.
const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const ATTEMPT_TIMEOUT_MS = 30_000;
const TOTAL_BUDGET_MS = 55_000; // stay inside Vercel's 60s function limit

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Server is not configured with a GEMINI_API_KEY." },
      { status: 500 }
    );
  }

  let file: File | null = null;
  try {
    const form = await req.formData();
    const entry = form.get("file");
    if (entry instanceof File) file = entry;
  } catch {
    // fall through to the validation error below
  }
  if (!file) {
    return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
  }
  if (!ACCEPTED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Unsupported file type. Upload a PDF, PNG, JPEG, or WebP." },
      { status: 415 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File is too large. Maximum size is 15 MB." },
      { status: 413 }
    );
  }

  // Try the primary model first, then fall back to steadier ones — a demand
  // spike or model deprecation upstream must not take the demo down.
  const models = [
    ...new Set(
      [
        process.env.GEMINI_MODEL || DEFAULT_MODEL,
        "gemini-3-flash-preview",
        "gemini-3.5-flash",
        "gemini-2.0-flash",
      ].filter(Boolean)
    ),
  ];

  const started = Date.now();
  const ai = new GoogleGenAI({ apiKey });
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  let lastError: unknown = null;

  for (const model of models) {
    if (Date.now() - started > TOTAL_BUDGET_MS - 5_000) break;
    try {
      const result = await ai.models.generateContent({
        model,
        contents: [
          {
            role: "user",
            parts: [
              { inlineData: { mimeType: file.type, data } },
              { text: ANALYSIS_PROMPT },
            ],
          },
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: ANALYSIS_SCHEMA,
          temperature: 0.2,
          abortSignal: AbortSignal.timeout(ATTEMPT_TIMEOUT_MS),
          // Keep responses fast; Gemini 3 models otherwise think for 30s+.
          ...(model.startsWith("gemini-3")
            ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
            : {}),
        },
      });

      const text = result.text;
      if (!text) throw new Error("Model returned an empty response.");
      const analysis = JSON.parse(text) as BillAnalysis;

      return NextResponse.json({
        analysis,
        meta: { model, durationMs: Date.now() - started },
      });
    } catch (err) {
      lastError = err;
      const message = err instanceof Error ? err.message : String(err);
      const retriable =
        /404|NOT_FOUND|429|RESOURCE_EXHAUSTED|503|UNAVAILABLE|500|INTERNAL|fetch failed|timeout|abort|ECONN|ETIMEDOUT|network/i.test(
          message
        );
      console.error(`analyze with ${model} failed:`, message.slice(0, 300));
      if (!retriable) break;
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  const overloaded = /429|RESOURCE_EXHAUSTED|503|UNAVAILABLE/i.test(message);
  return NextResponse.json(
    {
      error: overloaded
        ? "The AI service is briefly rate-limited. Please try again in a few seconds."
        : "Could not analyze this document. Please try again or use a clearer copy.",
    },
    { status: overloaded ? 429 : 502 }
  );
}
