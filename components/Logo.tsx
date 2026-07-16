export function Logo({ size = 34 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg
        width={size}
        height={size}
        viewBox="0 0 34 34"
        fill="none"
        aria-hidden
        className="shrink-0"
      >
        <rect width="34" height="34" rx="9" fill="var(--ink)" />
        <path
          d="M18.8 6.5 10.5 18.2h5.2l-1.6 9.3 8.4-11.9h-5.2l1.5-9.1Z"
          fill="var(--spark)"
        />
      </svg>
      <span className="text-lg font-semibold tracking-tight">BillSense</span>
    </span>
  );
}
