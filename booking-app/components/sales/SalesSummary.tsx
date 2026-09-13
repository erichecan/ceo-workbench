interface Summary {
  count: number
  revenue: number
  tips: number
  discounts: number
  byMethod: Record<string, number>
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2)
}

export default function SalesSummary({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500 font-medium">Transactions</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{summary.count}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500 font-medium">Revenue</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">${centsToDisplay(summary.revenue)}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500 font-medium">Tips</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">${centsToDisplay(summary.tips)}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500 font-medium">Discounts given</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">${centsToDisplay(summary.discounts)}</p>
      </div>

      {/* Payment method breakdown */}
      <div className="col-span-2 sm:col-span-4 rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs text-slate-500 font-medium mb-3">By payment method</p>
        <div className="flex gap-6 flex-wrap">
          {(['CASH', 'CARD', 'E_TRANSFER', 'OTHER'] as const).map(method => (
            <div key={method}>
              <p className="text-[11px] text-slate-400 uppercase tracking-wide">{method.replace('_', ' ')}</p>
              <p className="text-lg font-semibold text-slate-900">${centsToDisplay(summary.byMethod[method] ?? 0)}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
