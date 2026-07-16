"use client";

import { useEffect, useState } from "react";

const STAGES = [
  "Reading the document",
  "Identifying provider and tariff structure",
  "Extracting charges and meter data",
  "Cross-checking totals",
  "Writing insights for you",
];

const STAGE_MS = 1700;

export function ProcessingView({ fileName }: { fileName: string }) {
  const [stage, setStage] = useState(0);

  useEffect(() => {
    // Advance through stages on a timer, but never "finish" the last one —
    // the real completion signal is the API response swapping this view out.
    const id = setInterval(() => {
      setStage((s) => Math.min(s + 1, STAGES.length - 1));
    }, STAGE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="animate-fade-up mx-auto flex w-full max-w-xl flex-col items-center">
      {/* document being "scanned" */}
      <div className="relative mb-10 h-40 w-32 overflow-hidden rounded-xl border border-line bg-surface shadow-[0_8px_30px_rgba(25,24,19,0.08)]">
        <div className="space-y-2.5 p-4">
          <div className="h-2 w-16 rounded bg-stone-200" />
          <div className="h-2 w-20 rounded bg-stone-100" />
          <div className="mt-4 h-2 w-full rounded bg-stone-100" />
          <div className="h-2 w-full rounded bg-stone-100" />
          <div className="h-2 w-3/4 rounded bg-stone-100" />
          <div className="mt-4 h-2 w-full rounded bg-stone-100" />
          <div className="h-2 w-5/6 rounded bg-stone-100" />
          <div className="h-2 w-2/3 rounded bg-stone-100" />
        </div>
        <div className="animate-scan absolute left-2 right-2 h-8 rounded-md bg-gradient-to-b from-amber-200/0 via-amber-300/50 to-amber-200/0 border-y border-amber-400/60" />
      </div>

      <p className="mb-8 max-w-full truncate text-sm text-ink-muted">
        Analyzing <span className="font-medium text-ink">{fileName}</span>
      </p>

      <ol className="w-full max-w-sm space-y-3.5">
        {STAGES.map((label, i) => {
          const done = i < stage;
          const active = i === stage;
          return (
            <li
              key={label}
              className={`flex items-center gap-3 text-[15px] transition-colors duration-300 ${
                done ? "text-ink-muted" : active ? "text-ink font-medium" : "text-stone-300"
              }`}
            >
              <span className="flex h-5 w-5 items-center justify-center">
                {done ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                    <circle cx="8" cy="8" r="8" fill="#D6D3C4" />
                    <path
                      d="m4.8 8.2 2.2 2.2 4.2-4.6"
                      stroke="white"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : active ? (
                  <span className="animate-soft-pulse h-2.5 w-2.5 rounded-full bg-spark" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                )}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
