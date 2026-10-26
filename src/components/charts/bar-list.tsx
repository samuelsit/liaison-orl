/** Barres horizontales (une série) : la valeur est écrite au bout de la barre, en couleur de texte. */
export function BarList({ rows, color = "var(--dv-1)", format = (v: number) => String(v), empty = "Aucune donnée." }: { rows: { label: string; value: number; hint?: string }[]; color?: string; format?: (v: number) => string; empty?: string }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(7rem,12rem)_1fr] items-center gap-3 text-sm" title={r.hint}>
          <span className="truncate">{r.label}</span>
          <span className="flex items-center gap-2">
            <span className="h-3.5 rounded-r-[4px]" style={{ width: `${Math.max(1, (r.value / max) * 85)}%`, background: color }} aria-hidden />
            <span className="tabular-nums text-muted-foreground">{format(r.value)}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
