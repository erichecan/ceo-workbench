import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'

export default function SocialMediaPage() {
  return (
    <div>
      <MarketingNav />

      <section className="bg-brand-gradient relative overflow-hidden pt-16 pb-20 text-white">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="font-heading max-w-2xl text-4xl leading-tight md:text-5xl">
            社交媒体代运营
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">
            内容整理中，详细的服务范围和报价还没放上来。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-muted-foreground">
          先想了解这项服务，可以直接联系我们，我们会告诉你目前具体能做到什么程度。
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          返回首页
        </Link>
      </section>
    </div>
  )
}
