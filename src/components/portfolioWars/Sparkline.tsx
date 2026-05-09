/**
 * Tiny inline sparkline. Without intraday history we synthesize a smooth
 * monotonic curve between start → end so each pick still gets a visual
 * trend signal in the UI. Deterministic per ticker so it doesn't jitter
 * between renders.
 */
function hash(str: string) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function Sparkline({
  ticker, start, end, width = 60, height = 20,
}: {
  ticker: string;
  start: number | null;
  end: number | null;
  width?: number;
  height?: number;
}) {
  const positive = (end ?? 0) >= (start ?? 0);
  const color = positive ? 'hsl(152 80% 60%)' : 'hsl(0 80% 65%)';

  // Generate 16 deterministic points with light noise around the start→end line.
  const N = 16;
  const seed = hash(ticker);
  const noiseAmp = 0.18; // relative wobble
  const points: number[] = [];
  const s = start ?? 100;
  const e = end ?? s;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const base = s + (e - s) * t;
    // pseudo-random in [-1,1]
    const rand = Math.sin((seed + i * 47.13) * 12.9898) * 43758.5453;
    const r = (rand - Math.floor(rand)) * 2 - 1;
    const wob = base * noiseAmp * (1 - Math.abs(0.5 - t) * 1.6) * r * 0.05;
    points.push(base + wob);
  }
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = Math.max(max - min, 1e-6);
  const path = points
    .map((p, i) => {
      const x = (i / (N - 1)) * width;
      const y = height - ((p - min) / range) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  const fill = `${path} L${width},${height} L0,${height} Z`;

  const gid = `pw-spark-${ticker.replace(/\W/g, '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="block">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
