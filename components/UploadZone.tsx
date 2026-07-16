"use client";

import { useCallback, useRef, useState } from "react";
import { SAMPLE_BILLS, type SampleBill } from "@/lib/samples";

const ACCEPT = ".pdf,image/png,image/jpeg,image/webp";

export function UploadZone({
  onFile,
  onSample,
  disabled,
}: {
  onFile: (file: File) => void;
  onSample: (sample: SampleBill) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      if (disabled) return;
      const file = e.dataTransfer.files?.[0];
      if (file) onFile(file);
    },
    [disabled, onFile]
  );

  return (
    <div className="w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`group w-full rounded-2xl border-2 border-dashed bg-surface px-8 py-14 text-center transition-all duration-200 cursor-pointer
          ${
            dragging
              ? "border-spark bg-amber-50 scale-[1.01]"
              : "border-line-strong hover:border-ink-muted hover:bg-white"
          }`}
      >
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-paper ring-1 ring-line transition-transform duration-200 group-hover:-translate-y-0.5">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 16V4m0 0 4.5 4.5M12 4 7.5 8.5"
              stroke="var(--ink)"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M4 15.5v2A2.5 2.5 0 0 0 6.5 20h11a2.5 2.5 0 0 0 2.5-2.5v-2"
              stroke="var(--ink-muted)"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <p className="text-base font-medium">
          Drop your electricity bill here, or{" "}
          <span className="text-accent underline decoration-amber-300 underline-offset-4">
            browse
          </span>
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          PDF or photo · scanned copies work too · max 15 MB
        </p>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <span className="text-sm text-ink-muted">No bill handy? Try one:</span>
        {SAMPLE_BILLS.map((sample) => (
          <button
            key={sample.id}
            type="button"
            disabled={disabled}
            onClick={() => onSample(sample)}
            title={sample.hint}
            className="rounded-full border border-line-strong bg-surface px-4 py-1.5 text-sm font-medium transition-all hover:border-ink hover:-translate-y-px active:translate-y-0"
          >
            {sample.label}
          </button>
        ))}
      </div>
    </div>
  );
}
