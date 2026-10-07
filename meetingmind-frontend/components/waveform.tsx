export function Waveform({ compact = false }: { compact?: boolean }) {
  const bars = [8, 15, 24, 13, 31, 18, 38, 21, 29, 12, 24, 35, 17, 28, 10, 20, 31, 14, 25, 9];
  return <span className={`waveform ${compact ? "waveform-compact" : ""}`} aria-hidden="true">{bars.map((height, index) => <i key={index} style={{ height, animationDelay: `${index * 55}ms` }} />)}</span>;
}
