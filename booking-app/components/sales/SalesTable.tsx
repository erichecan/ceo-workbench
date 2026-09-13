// Server Component — do not add 'use client'. createdAt is a Date object passed directly from the DB.
import { Badge } from '@/components/ui/badge'

interface SaleItem {
  id: string
  name: string
  price: number
}

interface Sale {
  id: string
  createdAt: Date
  total: number
  subtotal: number
  discountAmount: number
  tipAmount: number
  paymentMethod: string
  client?: { name: string } | null
  teamMember?: { name: string } | null
  items: SaleItem[]
}

const METHOD_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  E_TRANSFER: 'E-Transfer',
  OTHER: 'Other',
}

function centsToDisplay(cents: number): string {
  return (cents / 100).toFixed(2)
}

export default function SalesTable({ sales }: { sales: Sale[] }) {
  if (sales.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-slate-500">No sales recorded yet.</p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <table className="w-full text-sm">
        <thead className="border-b border-slate-200 bg-slate-50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Time</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Client</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Staff</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Services</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Method</th>
            <th className="px-4 py-3 text-right font-medium text-slate-600">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {sales.map(sale => (
            <tr key={sale.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                {sale.createdAt.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}
              </td>
              <td className="px-4 py-3 text-slate-900">{sale.client?.name ?? 'Walk-in'}</td>
              <td className="px-4 py-3 text-slate-600">{sale.teamMember?.name ?? '—'}</td>
              <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                {sale.items.map(i => i.name).join(', ')}
              </td>
              <td className="px-4 py-3">
                <Badge variant="outline" className="text-xs">
                  {METHOD_LABELS[sale.paymentMethod] ?? sale.paymentMethod}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right font-semibold text-slate-900">
                ${centsToDisplay(sale.total)}
                {sale.tipAmount > 0 && (
                  <span className="ml-1 text-xs text-slate-400">(+${centsToDisplay(sale.tipAmount)} tip)</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
