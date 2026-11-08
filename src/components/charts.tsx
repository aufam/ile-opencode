import { For, Show } from "solid-js";

const AXIS = "#93a5b4";
const GRID = "#edf2f7";

export function LineChart(props: { points: { label: string; value: number }[]; color?: string; valueFormatter?: (n: number) => string; height?: number }) {
  const w = 640;
  const h = props.height ?? 220;
  const pad = { l: 54, r: 14, t: 18, b: 26 };
  const max = () => Math.max(10, ...props.points.map((p) => p.value));
  const fmt = props.valueFormatter ?? ((n: number) => String(n));
  const x = (i: number) => pad.l + (i / Math.max(1, props.points.length - 1)) * (w - pad.l - pad.r);
  const y = (v: number) => h - pad.b - (v / max()) * (h - pad.t - pad.b);
  const path = () => props.points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" ");
  const area = () => `${path()} L${x(props.points.length - 1)},${h - pad.b} L${x(0)},${h - pad.b} Z`;
  const color = () => props.color ?? "var(--blue-500)";

  return (
    <div class="chart-line">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Diagram garis">
        <For each={[0, 0.5, 1]}>
          {(f) => <line x1={pad.l} x2={w - pad.r} y1={y(max() * f)} y2={y(max() * f)} stroke={GRID} stroke-width="1" />}
        </For>
        <path d={area()} fill={color()} opacity="0.1" />
        <path d={path()} fill="none" stroke={color()} stroke-width="2.5" stroke-linecap="round" />
        <For each={props.points}>
          {(p, i) => (
            <g>
              <circle cx={x(i())} cy={y(p.value)} r="4" fill={color()} />
              <text x={x(i())} y={y(p.value) - 9} font-size="10.5" text-anchor="middle" fill="#33475a" font-weight="700">
                {fmt(p.value)}
              </text>
              <text x={x(i())} y={h - 8} font-size="10.5" text-anchor="middle" fill={AXIS}>
                {p.label}
              </text>
            </g>
          )}
        </For>
        <line x1={pad.l} x2={w - pad.r} y1={h - pad.b} y2={h - pad.b} stroke={AXIS} stroke-width="1" />
      </svg>
    </div>
  );
}

export function BarChart(props: { points: { label: string; value: number; sub?: string }[]; color?: string; valueFormatter?: (n: number) => string; height?: number }) {
  const w = 640;
  const h = props.height ?? 230;
  const pad = { l: 8, r: 8, t: 24, b: 30 };
  const max = () => Math.max(1, ...props.points.map((p) => p.value));
  const fmt = props.valueFormatter ?? ((n: number) => String(n));
  const innerW = w - pad.l - pad.r;
  const step = innerW / props.points.length;
  const bw = Math.min(40, step * 0.6);
  const color = () => props.color ?? "var(--blue-500)";

  return (
    <div class="chart-bar">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Diagram batang">
        <For each={props.points}>
          {(p, i) => {
            const bh = ((p.value / max()) * (h - pad.t - pad.b)) || 0;
            const x = pad.l + i() * step + (step - bw) / 2;
            const y = h - pad.b - bh;
            return (
              <g>
                <rect x={x} y={y} width={bw} height={Math.max(bh, 2)} rx="6" fill={color()} opacity="0.92" />
                <text x={x + bw / 2} y={y - 7} font-size="10.5" text-anchor="middle" fill="#33475a" font-weight="700">
                  {fmt(p.value)}
                </text>
                <text x={x + bw / 2} y={h - 10} font-size="10" text-anchor="middle" fill={AXIS}>
                  {p.label}
                </text>
              </g>
            );
          }}
        </For>
      </svg>
      <Show when={props.points.some((p) => p.sub)}>
        <div class="chart-legend">
          <For each={props.points.filter((p) => p.sub)}>
            {(p) => (
              <span>
                <i style={`background:${color()}`} />
                {p.label} — {p.sub}
              </span>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

export function DonutChart(props: { items: { label: string; value: number; color: string }[]; centerLabel?: string }) {
  const size = 210;
  const r = 84;
  const stroke = 26;
  const total = () => Math.max(1, props.items.reduce((a, it) => a + it.value, 0));
  let offset = 0;
  const arcs = () =>
    props.items.map((it) => {
      const frac = it.value / total();
      const a0 = offset * 2 * Math.PI - Math.PI / 2;
      const a1 = (offset + frac) * 2 * Math.PI - Math.PI / 2;
      offset += frac;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const c = size / 2;
      const x0 = c + r * Math.cos(a0);
      const y0 = c + r * Math.sin(a0);
      const x1 = c + r * Math.cos(a1) - 0.001;
      const y1 = c + r * Math.sin(a1);
      return { d: `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1}`, color: it.color, label: it.label, value: it.value };
    });
  return (
    <div style="display:flex; gap:18px; align-items:center; flex-wrap:wrap">
      <div class="chart-donut" style="width:210px">
        <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribusi status">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={GRID} stroke-width={stroke} />
          <For each={arcs()}>{(arc) => <path d={arc.d} fill="none" stroke={arc.color} stroke-width={stroke} stroke-linecap="butt" />}</For>
          <text x={size / 2} y={size / 2 - 4} text-anchor="middle" font-size="21" font-weight="800" fill="#12222f">
            {total()}
          </text>
          <text x={size / 2} y={size / 2 + 15} text-anchor="middle" font-size="10.5" fill="#5c7285">
            {props.centerLabel ?? "Total"}
          </text>
        </svg>
      </div>
      <div class="chart-legend" style="flex-direction:column; align-items:flex-start; gap:7px">
        <For each={props.items}>
          {(it) => (
            <span>
              <i style={`background:${it.color}`} />
              <b style="margin-right:4px">{it.value}</b>
              {it.label}
            </span>
          )}
        </For>
      </div>
    </div>
  );
}
