export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-label="WorkTracker">
      <rect width="64" height="64" rx="18" fill="rgb(var(--brand))" />
      <path d="M18 34l9 9 19-21" fill="none" stroke="rgb(var(--pop))" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
