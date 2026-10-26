"use client";

import { useState } from "react";

export interface ColumnDatum {
  label: string;
  values: number[];
}

/** Colonnes empilées (≤ 2 séries), info-bulle au survol et au clavier, tableau accessible. */
export function StackedColumns({ data, series, title, height = 220 }: { data: ColumnDatum[]; series: { name: string; color: string }[]; title: string; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.values.reduce((a, b) => a + b, 0)));
  const nice = Math.max(4, Math.ceil(max / 4) * 4);
  const ticks = [0, nice / 4, nice / 2, (3 * nice) / 4, nice];
  const w = 640;
  const left = 32;
  const bottom = 24;
  const top = 8;
  const plotH = height - bottom - top;
  const band = (w - left) / data.length;
  const barW = Math.min(24, band * 0.6);
  const y = (v: number) => top + plotH - (v / nice) * plotH;

  return (
    <figure className="space-y-2">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground" aria-hidden>
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm" style={{ background: s.color }} /> {s.name}
          </span>
        ))}
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${w} ${height}`} className="h-auto w-full" role="img" aria-label={`${title}. Détail dans le tableau ci-dessous.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={left} x2={w} y1={y(t)} y2={y(t)} stroke="var(--dv-grid)" strokeWidth={1} />
              <text x={left - 6} y={y(t) + 3} fontSize={10} textAnchor="end" className="fill-muted-foreground">
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = left + band * i + band / 2;
            let acc = 0;
            const total = d.values.reduce((a, b) => a + b, 0);
            const lastNonZero = d.values.map((v, k) => (v > 0 ? k : -1)).reduce((a, b) => Math.max(a, b), -1);
            return (
              <g
                key={d.label}
                tabIndex={0}
                role="graphics-symbol"
                aria-label={`${d.label} : ${series.map((s, k) => `${s.name} ${d.values[k]}`).join(", ")}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                className="outline-none"
              >
                <rect x={cx - band / 2} y={top} width={band} height={plotH} fill="transparent" />
                {d.values.map((v, k) => {
                  if (v <= 0) return null;
                  const h = (v / nice) * plotH;
                  const y0 = y(acc + v);
                  acc += v;
                  const gap = k > 0 ? 2 : 0;
                  const r = k === lastNonZero ? 4 : 0;
                  const segH = Math.max(1, h - gap);
                  return (
                    <path
                      key={k}
                      d={`M ${cx - barW / 2} ${y0 + segH} L ${cx - barW / 2} ${y0 + r} Q ${cx - barW / 2} ${y0} ${cx - barW / 2 + r} ${y0} L ${cx + barW / 2 - r} ${y0} Q ${cx + barW / 2} ${y0} ${cx + barW / 2} ${y0 + r} L ${cx + barW / 2} ${y0 + segH} Z`}
                      fill={series[k]!.color}
                      opacity={hover === null || hover === i ? 1 : 0.55}
                    />
                  );
                })}
                <text x={cx} y={height - 8} fontSize={10} textAnchor="middle" className="fill-muted-foreground">
                  {d.label}
                </text>
                {hover === i && total > 0 ? (
                  <text x={cx} y={y(total) - 4} fontSize={10} textAnchor="middle" className="fill-foreground font-semibold">
                    {total}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {hover !== null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
            style={{ left: `${Math.min(80, ((left + band * hover + band) / w) * 100)}%` }}
            role="status"
          >
            <p className="mb-1 font-medium">{data[hover]!.label}</p>
            {series.map((s, k) => (
              <p key={s.name} className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded" style={{ background: s.color }} aria-hidden />
                <strong className="tabular-nums">{data[hover]!.values[k]}</strong>
                <span className="text-muted-foreground">{s.name}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Voir le tableau</summary>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className="border-b">
              <th scope="col" className="py-1 font-medium">
                Période
              </th>
              {series.map((s) => (
                <th key={s.name} scope="col" className="py-1 text-right font-medium">
                  {s.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.label} className="border-b last:border-0">
                <th scope="row" className="py-1 text-left font-normal">
                  {d.label}
                </th>
                {d.values.map((v, k) => (
                  <td key={k} className="py-1 text-right tabular-nums">
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
