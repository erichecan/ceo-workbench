import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { buttonVariants } from '@/components/ui/button'
import {
  Globe, CalendarDays, Scissors, Users, ReceiptText, UserCheck, PhoneOff, BookX, Clock3, CircleDollarSign,
} from 'lucide-react'

const PAIN_POINTS = [
  {
    icon: PhoneOff,
    title: '电话占线,顾客就走了',
    body: '手上戴着手套接不了电话,或者正在给别的客人做,漏掉的每一通电话都是别人家店的生意。',
  },
  {
    icon: BookX,
    title: '本子记错、记漏预约',
    body: '手写本一忙起来就容易记错时间、记错技师,到店才发现撞单,顾客体验和技师排班都受影响。',
  },
  {
    icon: Clock3,
    title: '下班后顾客约不了',
    body: '很多顾客习惯晚上刷手机的时候顺手约下周的美甲,但店打烊了、老板睡了,这单第二天可能就被别家接走。',
  },
  {
    icon: CircleDollarSign,
    title: '技师提成算不清楚',
    body: '月底对账靠手工翻本子、算提成,数字对不上,技师和老板互相都不放心。',
  },
]

const CORE_FEATURES = [
  {
    icon: Globe,
    title: '24 小时在线预约链接',
    body: '专属链接发到小红书主页、微信朋友圈或 Google 商家页,顾客不用打电话、不用等回复,自己选款式选时间就能提交预约。',
  },
  {
    icon: CalendarDays,
    title: '日历按技师分人上色',
    body: '哪个技师哪个时间段有客一目了然,顾客线上提交的预约会单独标出来,不会和现场手动录入的混在一起。',
  },
  {
    icon: Scissors,
    title: '服务项目按分类和定价管理',
    body: '基础款、延长款、加做设计分类摆放,支持固定价 / 起价 / 免费三种价格类型,某个服务不想开放线上约也可以单独关闭。',
  },
  {
    icon: Users,
    title: '客户自动建档',
    body: '顾客第一次在线预约,系统按电话号码自动建档,下次再约自动认出是老客,不用自己维护一张客户表。',
  },
  {
    icon: UserCheck,
    title: '技师提成比例设置',
    body: '每个技师可以单独设置提成比例,月底不用再翻本子手工核对,账目和技师对得上。',
  },
  {
    icon: ReceiptText,
    title: '结账支持真实场景',
    body: '一次结账能组合税费、小费、折扣、礼品卡、储值卡,美甲店常见的收银场景都覆盖。',
  },
]

export default function NailSalonPage() {
  return (
    <div>
      <MarketingNav />

      <section className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 md:grid-cols-2 md:py-20">
        <div>
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            美甲 / 美睫工作室 · 已有真实门店在用
          </span>
          <h1 className="mt-4 font-heading text-3xl leading-tight text-primary md:text-4xl">
            美甲店的在线预约,
            <br />
            别再靠一部电话和一个本子
          </h1>
          <p className="mt-5 max-w-md text-lg text-muted-foreground">
            顾客自己在线选款式、选技师空档,预约自动进日历,技师提成月底一键对清楚。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/book/lead-99" className={buttonVariants({ size: 'lg' })}>
              看真实门店的预约页架子
            </Link>
            <Link href="/features" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              看完整功能清单
            </Link>
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1534004471323-19f1a470c4c1?auto=format&fit=crop&w=900&q=80"
          alt="美甲工作室实景（Unsplash 免费商用占位图，待替换为真实客户门店照片）"
          className="aspect-[4/5] w-full rounded-2xl object-cover shadow-lg"
        />
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="font-heading text-2xl text-foreground">这些场景,美甲店老板都熟悉</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          不是技术问题,是每天都在发生的生意问题——漏掉的电话、记错的本子,最后都变成流失的顾客。
        </p>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {PAIN_POINTS.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border p-6">
              <Icon className="mb-3 size-6 text-muted-foreground" strokeWidth={1.5} />
              <h3 className="font-heading text-lg text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="font-heading text-2xl text-foreground">一套系统,把这些都接住</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CORE_FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border p-5">
              <Icon className="mb-2.5 size-5 text-primary" strokeWidth={1.5} />
              <h3 className="font-heading text-base text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-16">
        <div className="rounded-2xl border border-border bg-muted/30 p-8 sm:p-10">
          <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
            真实案例
          </span>
          <h2 className="mt-4 font-heading text-2xl text-foreground">已经给真实门店 Shine Nail Studio 部署</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            这不是设计稿,预约页架子已经在生产环境跑通、有独立链接——目前店内的服务项目还在配置中,
            配完就能直接把链接发给顾客用。跟同事讲的时候如实说清楚这一点,不要说成&ldquo;顾客已经在这上面约过&rdquo;。
          </p>
          <div className="mt-6">
            <Link href="/book/lead-99" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
              查看预约页架子（服务项目待配置）→
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 pb-20">
        <h2 className="font-heading text-xl text-foreground">还想要,但需要额外开发的</h2>
        <p className="mt-2 text-sm text-muted-foreground">如实说清楚,不把还没做的说成已经有的。</p>
        <div className="mt-5 flex flex-col gap-3">
          <div className="rounded-xl border border-dashed border-border p-5">
            <h3 className="text-base font-medium text-foreground">短信 / 邮件自动提醒</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              预约提交后自动通知顾客和技师,需要接入短信服务商账号,技术上不难,需要额外费用。
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-border p-5">
            <h3 className="text-base font-medium text-foreground">真实空档时间选择</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
              顾客选时间时只显示技师还没被约的空档,而不是自己填一个可能已经被占用的时间。
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border py-10 text-center text-sm text-muted-foreground">
        想看其他业态？回<Link href="/business-types" className="text-primary hover:underline">适用业态页</Link>看看。
      </footer>
    </div>
  )
}
