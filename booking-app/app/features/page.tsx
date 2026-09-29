import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { ArrowRight, Wrench } from 'lucide-react'
import { BUILT_FEATURES, CUSTOM_FEATURES } from '@/lib/features-data'

export default function FeaturesPage() {
  return (
    <div>
      <MarketingNav />

      <section className="bg-brand-gradient relative overflow-hidden pt-16 pb-20 text-white">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 md:grid-cols-2">
          <div>
            <h1 className="font-heading max-w-2xl text-4xl leading-tight md:text-5xl">
              功能清单
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/85">
              分两栏说清楚：哪些是系统现在已经在跑的，哪些是能做、但需要额外开发时间的。不把还没做的说成已经有的。
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/screenshots/booking-demo.png"
            alt="真实预约页截图（/book/demo-salon，不是效果图）"
            className="w-full rounded-2xl shadow-2xl ring-1 ring-white/10"
          />
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="font-heading text-2xl text-foreground md:text-3xl">现在就有</h2>
        <p className="mt-2 text-sm text-muted-foreground">点进每张卡片能看到真实后台截图和更详细的说明。</p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {BUILT_FEATURES.map(({ slug, icon: Icon, title, summary, points }) => (
            <Link
              key={slug}
              href={`/features/${slug}`}
              className="group rounded-2xl border border-border p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-full bg-accent">
                  <Icon className="size-5 text-primary" strokeWidth={1.75} />
                </div>
                <ArrowRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-1 group-hover:text-primary" strokeWidth={2} />
              </div>
              <h3 className="font-heading mt-4 text-lg text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{summary}</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {points.slice(0, 2).map((point) => (
                  <li key={point.title} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/50" />
                    <span>{point.title}</span>
                  </li>
                ))}
              </ul>
            </Link>
          ))}
        </div>

        <h2 className="mt-20 flex items-center gap-2 font-heading text-2xl text-foreground md:text-3xl">
          <Wrench className="size-6 text-muted-foreground" strokeWidth={1.5} />
          可以做，但需要定制开发
        </h2>
        <div className="mt-8 flex flex-col gap-3">
          {CUSTOM_FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-dashed border-border p-5">
              <h3 className="text-base font-medium text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link
            href="/business-types"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            看看适合我的店吗
            <ArrowRight className="size-3.5" strokeWidth={2} />
          </Link>
        </div>
      </section>

      <section className="bg-brand-gradient py-20 text-center text-white">
        <h2 className="font-heading text-3xl md:text-4xl">先看看 Demo，再决定要不要聊</h2>
        <p className="mt-4 text-white/85">不用注册，几分钟就能看完整个预约流程长什么样。</p>
        <Link
          href="/book/demo-salon"
          className="mt-8 inline-block rounded-full bg-white px-8 py-3.5 text-base font-semibold text-primary shadow-lg transition-transform hover:scale-[1.02]"
        >
          查看预约页 Demo
        </Link>
      </section>
    </div>
  )
}
