import { getSession } from '@/lib/auth'
import { listCoupons } from '@/lib/db/queries/coupons'
import { listGiftCards } from '@/lib/db/queries/gift-cards'
import { getClients } from '@/lib/db/queries/clients'
import CouponsTable from '@/components/memberships/CouponsTable'
import GiftCardsTable from '@/components/memberships/GiftCardsTable'
import { redirect } from 'next/navigation'

export default async function MembershipsPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const [coupons, giftCards, clients] = await Promise.all([
    listCoupons(session.workspaceId),
    listGiftCards(session.workspaceId),
    getClients(session.workspaceId),
  ])
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary mb-6">会员权益</h1>
      </div>
      <CouponsTable initialCoupons={coupons} />
      <GiftCardsTable initialGiftCards={giftCards} clients={clients} />
    </div>
  )
}
