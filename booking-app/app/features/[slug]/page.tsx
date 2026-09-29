import Link from 'next/link'
import { notFound } from 'next/navigation'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { BUILT_FEATURES, getFeatureBySlug } from '@/lib/features-data'

export function generateStaticParams() {
  return BUILT_FEATURES.map((f) => ({ slug: f.slug }))
}

export default async function FeatureDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const feature = getFeatureBySlug(slug)
  if (!feature) notFound()

  const { icon: Icon, title, intro, screenshot, screenshotAlt, points } = feature

  return (
    <div>
      <MarketingNav />

      <section className="bg-brand-gradient relative overflow-hidden pt-16 pb-20 text-white">
        <div className="mx-auto max-w-5xl px-6">
          <Link
            href="/features"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white/80 hover:text-white"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            返回功能清单
          </Link>
          <div className="mt-6 flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-full bg-white/15">
              <Icon className="size-6" strokeWidth={1.75} />
            </div>
            <h1 className="font-heading text-3xl leading-tight md:text-4xl">{title}</h1>
          </div>
          <p className="mt-5 max-w-xl text-lg text-white/85">{intro}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={screenshot}
          alt={screenshotAlt}
          className="w-full rounded-2xl border border-border shadow-lg"
        />

        <div className="mt-14 grid gap-6 sm:grid-cols-2">
          {points.map((point) => (
            <div key={point.title} className="flex items-start gap-3 rounded-xl border border-border p-5">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" strokeWidth={1.75} />
              <div>
                <h3 className="font-heading text-base text-foreground">{point.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{point.body}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-16 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-8">
          <Link
            href="/features"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <ArrowLeft className="size-3.5" strokeWidth={2} />
            看其它功能
          </Link>
          <Link
            href="/book/demo-salon"
            className="inline-flex items-center gap-1.5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            查看预约页 Demo
            <ArrowRight className="size-3.5" strokeWidth={2} />
          </Link>
        </div>
      </section>
    </div>
  )
}
