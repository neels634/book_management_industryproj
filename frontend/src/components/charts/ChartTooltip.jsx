/** Recharts tooltip in the app's card style; text stays in ink colours, a swatch carries identity. */
export default function ChartTooltip({ active, payload, label, formatter = (v) => v }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-stone-200 bg-white px-3 py-2 text-xs shadow-lifted">
      {label !== undefined && <p className="mb-1 font-semibold text-stone-900">{label}</p>}
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2 text-stone-600">
          <span className="h-2 w-2 rounded-sm" style={{ background: p.color || p.fill }} aria-hidden />
          {p.name}: <span className="font-semibold text-stone-900 tabular">{formatter(p.value)}</span>
        </p>
      ))}
    </div>
  );
}
