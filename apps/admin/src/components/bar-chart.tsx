import { formatNumber } from '@/lib/format'

export interface BarDatum {
  /** 'YYYY-MM-DD' */
  key: string
  /** Under the bar: 'ven.' */
  tick: string
  /** In the readout and for screen readers: 'vendredi 13 novembre' */
  name: string
  value: number
  /** The value in words: '12 commandes', '2 388 DH' */
  text: string
  /** The day still in progress: drawn in gold, always labelled. */
  today: boolean
}

interface BarChartProps {
  /** Names what is plotted, for screen readers. */
  label: string
  data: BarDatum[]
  /** Top of the scale when every value is zero. */
  emptyMax: number
}

// Fixed drawing size: the SVG is never stretched, so its text keeps its size on every screen.
const WIDTH = 336
const HEIGHT = 170
const PAD = { top: 36, right: 4, bottom: 24, left: 40 }
const BAR_WIDTH = 22
const RADIUS = 4

/** Smallest "clean" even ceiling at or above the value: 2, 4, 6, 8, 10, 20, 40, ... */
function niceMax(value: number, emptyMax: number): number {
  if (value <= 0) return emptyMax
  for (let scale = 1; scale <= 1e9; scale *= 10) {
    for (const base of [2, 4, 6, 8, 10]) {
      if (base * scale >= value) return base * scale
    }
  }
  return value
}

function tickLabel(value: number, max: number): string {
  if (value === 0) return '0'
  return max >= 10_000 ? `${formatNumber(value / 1000)} k` : formatNumber(value)
}

/** Column with a rounded top and a square foot on the baseline. */
function columnPath(x: number, y: number, width: number, height: number): string {
  const r = Math.min(RADIUS, height, width / 2)
  const bottom = y + height
  return `M${x} ${bottom}V${y + r}Q${x} ${y} ${x + r} ${y}H${x + width - r}Q${x + width} ${y} ${x + width} ${y + r}V${bottom}Z`
}

/**
 * Seven thin columns, one per day. Past days in ink, the day in progress in gold.
 * The largest day and today carry their value; hovering, tapping or focusing a column
 * writes its day and value on the line above the plot. The same figures are in the table
 * that follows the charts on the page.
 */
export function BarChart({ label, data, emptyMax }: BarChartProps) {
  const plotWidth = WIDTH - PAD.left - PAD.right
  const plotHeight = HEIGHT - PAD.top - PAD.bottom
  const baseline = PAD.top + plotHeight
  const slot = plotWidth / Math.max(data.length, 1)

  const highest = Math.max(0, ...data.map((d) => d.value))
  const max = niceMax(highest, emptyMax)
  const ticks = [0, max / 2, max]
  const y = (value: number) => baseline - (value / max) * plotHeight
  const todayIndex = data.findIndex((d) => d.today)
  let peakIndex = highest > 0 ? data.findIndex((d) => d.value === highest) : -1
  // Two labels on neighbouring columns of similar height would run into each other:
  // today keeps its label, the peak is read from the readout line or the table.
  const todayValue = todayIndex >= 0 ? (data[todayIndex]?.value ?? 0) : 0
  if (
    peakIndex >= 0 &&
    todayIndex >= 0 &&
    todayValue > 0 &&
    Math.abs(peakIndex - todayIndex) === 1 &&
    Math.abs(y(highest) - y(todayValue)) < 16
  ) {
    peakIndex = -1
  }

  return (
    <svg className="chart" width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="group" aria-label={label}>
      {ticks.map((tick) => (
        <g key={tick}>
          {tick > 0 ? <line className="chart__grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} /> : null}
          <text className="chart__tick" x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" aria-hidden="true">
            {tickLabel(tick, max)}
          </text>
        </g>
      ))}

      {data.map((d, index) => {
        const slotX = PAD.left + index * slot
        const x = slotX + (slot - BAR_WIDTH) / 2
        const top = y(d.value)
        const height = baseline - top
        const labelled = d.value > 0 && (d.today || index === peakIndex)
        return (
          <g
            key={d.key}
            className={`chart__bar${d.today ? ' chart__bar--today' : ''}`}
            tabIndex={0}
            role="img"
            aria-label={`${d.name} : ${d.text}${d.today ? ' (journée en cours)' : ''}`}
          >
            <rect className="chart__hit" x={slotX + 1} y={PAD.top - 4} width={slot - 2} height={plotHeight + 4 + PAD.bottom} />
            {height > 0 ? <path className="chart__mark" d={columnPath(x, top, BAR_WIDTH, height)} /> : null}
            {labelled ? (
              <text className="chart__value" x={x + BAR_WIDTH / 2} y={top - 6} textAnchor="middle" aria-hidden="true">
                {formatNumber(d.value)}
              </text>
            ) : null}
            <text
              className={`chart__day${d.today ? ' chart__day--today' : ''}`}
              x={x + BAR_WIDTH / 2}
              y={baseline + 16}
              textAnchor="middle"
              aria-hidden="true"
            >
              {d.tick}
            </text>
            <text className="chart__tip" x={PAD.left} y={12} aria-hidden="true">
              <tspan className="chart__tip-value">{d.text}</tspan>
              <tspan dx="6">{d.today ? `${d.name}, en cours` : d.name}</tspan>
            </text>
          </g>
        )
      })}

      <line className="chart__base" x1={PAD.left} x2={WIDTH - PAD.right} y1={baseline} y2={baseline} />
    </svg>
  )
}
