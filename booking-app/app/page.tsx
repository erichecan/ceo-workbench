import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { buttonVariants } from '@/components/ui/button'
import { CalendarDays, Users, ReceiptText, Globe } from 'lucide-react'

const HIGHLIGHTS = [
  {
    icon: Globe,
    title: '顾客自助在线预约',
    body: '专属预约链接，顾客不用注册就能选服务、填时间、提交预约请求。',
  },
  {
    icon: CalendarDays,
    title: '日历一眼看清新预约',
    body: '线上顾客提交的预约会标出来，待确认数量在后台随时提醒你。',
  },
  {
    icon: Users,
    title: '客户与员工都在一个系统里',
    body: '客户自动建档、员工排班和提成比例统一管理，不用来回切换表格。',
  },
  {
    icon: ReceiptText,
    title: '结账支持真实场景',
    body: '税费、小费、折扣、礼品卡、储值卡组合结算，一次性算清楚。',
  },
]

export default function MarketingHome() {
  return (
    <div>
      <MarketingNav />

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h1 className="font-heading text-4xl leading-tight text-primary md:text-5xl">
          给美甲、美容、美发这类预约制门店的
          <br />
          在线预约与日常管理系统
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          一个链接就能收顾客的预约请求，一个日历管好每天的安排，客户、员工、结账都在同一个地方。
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/book/demo-salon" className={buttonVariants({ size: 'lg' })}>
            查看预约页 Demo
          </Link>
          <Link href="/business-types" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            看看适不适合我的店
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2">
          {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border p-6">
              <Icon className="mb-3 size-6 text-primary" strokeWidth={1.5} />
              <h3 className="font-heading text-lg text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        想看完整功能清单？去<Link href="/features" className="text-primary hover:underline">功能页</Link>看看。
      </footer>
    </div>
  )
}
