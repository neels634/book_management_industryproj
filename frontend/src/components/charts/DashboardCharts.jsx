import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Table2, LineChart as LineIcon } from 'lucide-react';
import ChartTooltip from './ChartTooltip';
import { AXIS, SERIES } from './chartTheme';

function Legend({ items }) {
  return (
    <ul className="flex flex-wrap gap-4 text-xs text-stone-600">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full" style={{ background: i.color }} aria-hidden />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/** Monthly issues vs returns: two lines, one axis, crosshair tooltip, table toggle. */
export function MonthlyActivityChart({ data }) {
  const [asTable, setAsTable] = useState(false);
  const last = data[data.length - 1] || { issues: 0, returns: 0 };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <Legend
          items={[
            { label: `Issues (${last.issues} this month)`, color: SERIES.primary },
            { label: `Returns (${last.returns} this month)`, color: SERIES.secondary },
          ]}
        />
        <button
          type="button"
          onClick={() => setAsTable((t) => !t)}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-stone-500 hover:bg-stone-100 hover:text-stone-800"
        >
          {asTable ? <LineIcon className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {asTable ? 'Chart' : 'Table'}
        </button>
      </div>
      {asTable ? (
        <div className="max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-stone-500">
                <th className="py-1.5 font-medium">Month</th>
                <th className="py-1.5 text-right font-medium">Issues</th>
                <th className="py-1.5 text-right font-medium">Returns</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 tabular">
              {data.map((m) => (
                <tr key={m.month}>
                  <td className="py-1.5">{m.label}</td>
                  <td className="py-1.5 text-right">{m.issues}</td>
                  <td className="py-1.5 text-right">{m.returns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-64" role="img" aria-label="Line chart of monthly book issues and returns over the last 12 months">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
              <CartesianGrid stroke={AXIS.grid} vertical={false} />
              <XAxis dataKey="label" tick={AXIS.tick} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tick={AXIS.tick} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ stroke: '#a8a29e', strokeDasharray: '3 3' }} />
              <Line type="linear" dataKey="issues" name="Issues" stroke={SERIES.primary} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
              <Line type="linear" dataKey="returns" name="Returns" stroke={SERIES.secondary} strokeWidth={2} dot={false} activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/** Copies per category: single-series horizontal bars, labelled. */
export function CategoryBarChart({ data }) {
  const height = Math.max(160, data.length * 34);
  return (
    <div style={{ height }} role="img" aria-label="Bar chart of book copies by category">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 28, bottom: 0, left: 0 }} barCategoryGap={8}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis type="category" dataKey="name" width={92} tick={AXIS.tick} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f5f5f4' }} />
          <Bar
            dataKey="totalCopies"
            name="Copies"
            fill={SERIES.primary}
            radius={[0, 4, 4, 0]}
            maxBarSize={18}
            label={{ position: 'right', fill: '#57534e', fontSize: 12 }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Ranked list with inline magnitude bars - easier to read than a chart for top-N names. */
export function RankedList({ items, valueKey, labelKey, subKey, valueLabel, max }) {
  const top = max ?? Math.max(1, ...items.map((i) => i[valueKey]));
  if (!items.length) return <p className="py-6 text-center text-sm text-stone-400">No activity yet</p>;
  return (
    <ol className="space-y-3">
      {items.map((item, idx) => (
        <li key={item[labelKey] + idx} className="grid grid-cols-[1.25rem_1fr_auto] items-center gap-3">
          <span className="font-display text-sm font-semibold text-stone-400 tabular">{idx + 1}</span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-stone-900">{item[labelKey]}</p>
            <div className="mt-1 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full" style={{ width: `${(item[valueKey] / top) * 100}%`, background: SERIES.primary }} />
              </div>
              {subKey && <span className="hidden shrink-0 text-xs text-stone-400 sm:inline">{item[subKey]}</span>}
            </div>
          </div>
          <span className="text-sm font-semibold text-stone-800 tabular">
            {item[valueKey]} <span className="text-xs font-normal text-stone-400">{valueLabel}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
