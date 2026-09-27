import { notFound } from 'next/navigation'
import PublicBookingPage from '@/components/booking/PublicBookingPage'
import { getPublicWorkspaceBySlug } from '@/lib/db/queries/public-bookings'

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const workspace = await getPublicWorkspaceBySlug(slug)
  if (!workspace || workspace.locations.length === 0) notFound()

  return (
    <PublicBookingPage
      slug={slug}
      shopName={workspace.name}
      logoUrl={workspace.logoUrl}
      services={workspace.services}
    />
  )
}
