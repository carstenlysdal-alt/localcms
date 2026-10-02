/** Tooltip tegnet som SVG (ingen inline styles, ingen portal). Placeres så den holder sig inden for diagrammet. */
export function ChartTip({ x, y, title, lines, maxX, width = 164 }: { x: number; y: number; title: string; lines: string[]; maxX: number; width?: number }) {
  const left = Math.min(Math.max(x - width / 2, 4), Math.max(4, maxX - width - 4));
  return (
    <g transform={`translate(${left} ${Math.max(2, y)})`} aria-hidden="true" pointerEvents="none">
      <rect className="ui-chart-tip" width={width} height={24 + lines.length * 18} rx={8} />
      <text className="ui-chart-tip-title" x={10} y={17}>{title.length > 24 ? `${title.slice(0, 23)}…` : title}</text>
      {lines.map((line, i) => <text key={i} className="ui-chart-tip-text" x={10} y={36 + i * 18}>{line}</text>)}
    </g>
  );
}
