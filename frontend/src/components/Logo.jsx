/** Two open book pages - brass and parchment - on the reading-room green. */
export default function Logo({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="8" fill="#0d1c18" />
      <path d="M8 8h5.5a3.5 3.5 0 0 1 3.5 3.5V24a2.5 2.5 0 0 0-2.5-2.5H8z" fill="#dfb262" />
      <path d="M24 8h-2.5A2.5 2.5 0 0 0 19 10.5V24a2.5 2.5 0 0 1 2.5-2.5H24z" fill="#f5e8cc" />
    </svg>
  );
}
