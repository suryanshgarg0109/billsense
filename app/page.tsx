"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Logo } from "@/components/Logo";
import { Ambient } from "@/components/Ambient";
import { UploadZone } from "@/components/UploadZone";
import { ProcessingView } from "@/components/ProcessingView";
import { ResultsView } from "@/components/ResultsView";
import { BatchView } from "@/components/BatchView";
import type { AnalyzeResponse, BatchItem } from "@/lib/types";
import { SAMPLE_BILLS, type SampleBill } from "@/lib/samples";

type Phase = "idle" | "processing" | "done" | "batch";

interface LoadedFile {
  name: string;
  url: string;
  type: string;
}

const MIN_PROCESSING_MS = 2600; // let the processing story land even on fast responses
const MAX_BATCH = 10;

async function requestAnalysis(f: File, signal: AbortSignal): Promise<AnalyzeResponse> {
  const body = new FormData();
  body.append("file", f);
  const res = await fetch("/api/analyze", { method: "POST", body, signal });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Something went wrong.");
  return json as AnalyzeResponse;
}

export default function Home() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objectUrls = useRef<string[]>([]);
  const inFlight = useRef<AbortController | null>(null);

  const trackUrl = (f: File) => {
    const url = URL.createObjectURL(f);
    objectUrls.current.push(url);
    return url;
  };

  const reset = useCallback(() => {
    inFlight.current?.abort();
    inFlight.current = null;
    objectUrls.current.forEach((u) => URL.revokeObjectURL(u));
    objectUrls.current = [];
    setPhase("idle");
    setFile(null);
    setResponse(null);
    setBatch([]);
    setOpenIdx(null);
    setError(null);
  }, []);

  const analyzeSingle = useCallback(async (f: File) => {
    setError(null);
    setFile({ name: f.name, url: trackUrl(f), type: f.type });
    setPhase("processing");

    const controller = new AbortController();
    inFlight.current = controller;
    const started = Date.now();

    try {
      const result = await requestAnalysis(f, controller.signal);
      const elapsed = Date.now() - started;
      if (elapsed < MIN_PROCESSING_MS) {
        await new Promise((r) => setTimeout(r, MIN_PROCESSING_MS - elapsed));
      }
      if (controller.signal.aborted) return; // user went back mid-flight
      setResponse(result);
      setPhase("done");
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setPhase("idle");
    } finally {
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, []);

  const analyzeBatch = useCallback(async (files: File[]) => {
    setError(null);
    const controller = new AbortController();
    inFlight.current = controller;

    const items: BatchItem[] = files.map((f, i) => ({
      id: `${i}-${f.name}`,
      name: f.name,
      url: trackUrl(f),
      type: f.type,
      status: "queued",
    }));
    setBatch(items);
    setOpenIdx(null);
    setPhase("batch");

    // Sequential on purpose: keeps us friendly with free-tier rate limits and
    // lets the portfolio table fill in row by row.
    for (let i = 0; i < files.length; i++) {
      if (controller.signal.aborted) return;
      setBatch((prev) =>
        prev.map((it, j) => (j === i ? { ...it, status: "processing" } : it))
      );
      try {
        const result = await requestAnalysis(files[i], controller.signal);
        if (controller.signal.aborted) return;
        setBatch((prev) =>
          prev.map((it, j) => (j === i ? { ...it, status: "done", response: result } : it))
        );
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setBatch((prev) =>
          prev.map((it, j) =>
            j === i
              ? {
                  ...it,
                  status: "error",
                  error: e instanceof Error ? e.message : "Analysis failed.",
                }
              : it
          )
        );
      }
    }
    if (inFlight.current === controller) inFlight.current = null;
  }, []);

  const handleFiles = useCallback(
    (files: File[]) => {
      const capped = files.slice(0, MAX_BATCH);
      if (capped.length === 1) void analyzeSingle(capped[0]);
      else void analyzeBatch(capped);
    },
    [analyzeSingle, analyzeBatch]
  );

  const fetchSample = async (sample: SampleBill): Promise<File> => {
    const res = await fetch(sample.path);
    if (!res.ok) throw new Error("Sample bill could not be loaded.");
    const blob = await res.blob();
    return new File([blob], `${sample.id}-sample-bill.pdf`, { type: "application/pdf" });
  };

  const analyzeSample = useCallback(
    async (sample: SampleBill) => {
      try {
        void analyzeSingle(await fetchSample(sample));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Sample bill could not be loaded.");
      }
    },
    [analyzeSingle]
  );

  const analyzeSampleBatch = useCallback(async () => {
    try {
      const files = await Promise.all(SAMPLE_BILLS.map(fetchSample));
      void analyzeBatch(files);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sample bills could not be loaded.");
    }
  }, [analyzeBatch]);

  // Back = one level up: drill-down closes first, otherwise return to upload.
  const goBack = useCallback(() => {
    if (phase === "batch" && openIdx !== null) setOpenIdx(null);
    else reset();
  }, [phase, openIdx, reset]);

  // Escape always steps back.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") goBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack]);

  const openItem = openIdx !== null ? batch[openIdx] : null;

  return (
    <div className="flex min-h-screen flex-col">
      <Ambient />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <button
          type="button"
          onClick={reset}
          title="Back to the start"
          className="rounded-lg transition-transform hover:-translate-y-px active:translate-y-0"
        >
          <Logo />
        </button>
        <div className="flex items-center gap-2.5">
          {phase !== "idle" && (
            <button
              type="button"
              onClick={goBack}
              className="animate-fade-up flex items-center gap-1.5 rounded-full border border-line-strong bg-surface px-4 py-1.5 text-[13px] font-medium transition-all hover:border-ink hover:-translate-y-px active:translate-y-0"
            >
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
                <path
                  d="M10.5 3.5 6 8l4.5 4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back
            </button>
          )}
          <span className="rounded-full border border-line-strong px-3 py-1 text-[12px] font-medium text-ink-muted">
            Product prototype
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16">
        {phase === "idle" && (
          <div className="animate-fade-up mx-auto max-w-2xl pt-10 sm:pt-16 text-center">
            <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.18em] text-accent">
              AI document understanding — not OCR
            </p>
            <h1 className="text-balance text-4xl font-semibold leading-[1.1] tracking-tight sm:text-5xl">
              Electricity bills,
              <br />
              understood in seconds.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-pretty text-[17px] leading-relaxed text-ink-soft">
              Upload electricity bills — PDF or photo, one or a whole batch. BillSense reads
              them like an analyst: structured data, cost insights, and export-ready output.
              No more manual data entry.
            </p>

            {error && (
              <div className="mx-auto mt-8 max-w-lg rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                {error}
              </div>
            )}

            <div className="mt-10">
              <UploadZone
                onFiles={handleFiles}
                onSample={analyzeSample}
                onSampleBatch={analyzeSampleBatch}
              />
            </div>

            <div className="mx-auto mt-14 grid max-w-xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
              {[
                ["Understands, not scans", "Tariffs, penalties and anomalies — not just text."],
                ["Honest about uncertainty", "Unclear fields are flagged, never invented."],
                ["Spreadsheet-ready", "Batch bills into one comparison table and CSV."],
              ].map(([title, detail], i) => (
                <div
                  key={title}
                  className="animate-fade-up rounded-xl border border-line bg-surface/60 p-4 transition-all duration-200 hover:-translate-y-1 hover:border-line-strong hover:bg-surface hover:shadow-[0_8px_20px_rgba(25,24,19,0.07)]"
                  style={{ animationDelay: `${200 + i * 90}ms` }}
                >
                  <p className="text-[13px] font-semibold">{title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{detail}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === "processing" && file && (
          <div className="pt-16 sm:pt-24">
            <ProcessingView fileName={file.name} />
          </div>
        )}

        {phase === "done" && response && file && (
          <div className="pt-2">
            <ResultsView response={response} file={file} onReset={reset} />
          </div>
        )}

        {phase === "batch" && !openItem && (
          <div className="pt-2">
            <BatchView items={batch} onOpen={setOpenIdx} onReset={reset} />
          </div>
        )}

        {phase === "batch" && openItem?.response && (
          <div className="pt-2">
            <ResultsView
              response={openItem.response}
              file={openItem}
              onReset={() => setOpenIdx(null)}
              resetLabel="Back to all bills"
            />
          </div>
        )}
      </main>

      <footer className="border-t border-line py-5">
        <p className="mx-auto max-w-6xl px-6 text-center text-[13px] font-medium">
          Made by{" "}
          <a
            href="https://github.com/suryanshgarg0109"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline decoration-amber-300 underline-offset-4 hover:decoration-amber-500"
          >
            Suryansh Garg
          </a>
        </p>
        <p className="mx-auto mt-1.5 max-w-6xl px-6 text-center text-[12px] text-ink-muted">
          BillSense is a product prototype. Sample bills are synthetic specimens, not real
          documents. Extracted data stays in your browser session — nothing is stored.
        </p>
      </footer>
    </div>
  );
}
