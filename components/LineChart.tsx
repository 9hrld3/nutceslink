/** Gráfica de líneas simple en SVG (sin dependencias). Cada serie es una lista de {label, value|null}. */
export default function LineChart({
  title, unit, labels, series,
}: {
  title: string; unit?: string; labels: string[];
  series: { name: string; color: string; values: (number | null)[] }[];
}) {
  const W = 560, H = 200, PX = 44, PY = 20;
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  if (all.length === 0) return null;
  let min = Math.min(...all), max = Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  const pad = (max - min) * 0.15;
  min -= pad; max += pad;
  const x = (i: number) => PX + (labels.length === 1 ? (W - 2 * PX) / 2 : (i * (W - 2 * PX)) / (labels.length - 1));
  const y = (v: number) => H - PY - ((v - min) / (max - min)) * (H - 2 * PY);
  const ticks = [min + pad, (min + max) / 2, max - pad];
  return (
    <figure className="break-inside-avoid border-2 border-primary bg-white p-3">
      <figcaption className="label mb-1">{title}{unit ? ` (${unit})` : ""}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title} className="w-full">
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PX} x2={W - PX / 2} y1={y(t)} y2={y(t)} stroke="#12355b" strokeOpacity="0.15" />
            <text x={PX - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#0b1b2b">{Math.round(t * 10) / 10}</text>
          </g>
        ))}
        {labels.map((l, i) => (
          <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize="10" fill="#0b1b2b">{l}</text>
        ))}
        {series.map((s) => {
          const pts = s.values.map((v, i) => (v === null ? null : { x: x(i), y: y(v), v }));
          const d = pts.filter(Boolean).map((p, i) => `${i ? "L" : "M"}${p!.x},${p!.y}`).join(" ");
          return (
            <g key={s.name}>
              <path d={d} fill="none" stroke={s.color} strokeWidth="3" />
              {pts.map((p, i) => p && <rect key={i} x={p.x - 4} y={p.y - 4} width="8" height="8" fill={s.color} />)}
            </g>
          );
        })}
      </svg>
      {series.length > 1 && (
        <ul className="mt-1 flex flex-wrap gap-4 text-sm">
          {series.map((s) => <li key={s.name}><span className="mr-1 inline-block h-3 w-3 align-middle" style={{ background: s.color }} />{s.name}</li>)}
        </ul>
      )}
    </figure>
  );
}
