import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
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
const DEFAULT_MODEL = "gemini-2.5-flash";

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

  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const started = Date.now();

  try {
    const ai = new GoogleGenAI({ apiKey });
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");

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
        // Speed matters for the demo; extraction works well without extended thinking.
        thinkingConfig: { thinkingBudget: 0 },
        temperature: 0.2,
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
    console.error("analyze failed:", err);
    const message = err instanceof Error ? err.message : String(err);
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
}
