import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import {
  Globe, CalendarDays, Users, UserCheck, Scissors, ReceiptText, Clock, Wrench, ArrowRight,
} from 'lucide-react'

const BUILT_FEATURES = [
  {
    icon: Globe,
    title: '顾客在线预约页',
    body: '专属链接（如 /book/你的店），顾客不用注册，选服务、填时间、留电话就能提交预约请求。',
    points: ['支持按服务分类浏览', '手机端排版，不用缩放就能操作'],
  },
  {
    icon: CalendarDays,
    title: '日历日 / 周 / 月视图',
    body: '预约按状态上色，顾客线上提交的会单独标出来，避免和你手动录入的搞混。',
    points: [
      '同一员工同时段不能重复约，改期一样会拦，不会自己撞单',
      '多个技师同时接客时，日视图按人分栏，不用来回切换',
      '月视图看整月排期，日 / 周视图管当天细节',
      '点击预约直接查看详情，支持按员工筛选',
    ],
  },
  {
    icon: Clock,
    title: '新预约提醒',
    body: '后台侧边栏实时显示"线上提交、还没确认"的预约数量，不用天天翻日历找有没有新单。',
    points: ['一键确认或拒绝', '待处理数量常驻显示'],
  },
  {
    icon: Scissors,
    title: '服务项目管理',
    body: '按分类组织服务，支持固定价 / 起价 / 免费三种定价方式，可以单独关闭某个服务的线上预约。',
    points: ['支持设置服务时长', '可按业态灵活分类'],
  },
  {
    icon: UserCheck,
    title: '员工排班与提成',
    body: '员工按角色管理，日历按人上色，每人可设置独立的提成比例。',
    points: ['支持多员工同时接单', '提成比例可单独调整'],
  },
  {
    icon: Users,
    title: '客户档案',
    body: '顾客第一次在线预约会按电话号码自动建档，后续预约自动关联同一个客户。',
    points: ['自动去重，不建出重复档案', '可查看客户历史预约'],
  },
  {
    icon: ReceiptText,
    title: '结账收银',
    body: '一次结账可以组合税费、小费、折扣、礼品卡、储值卡，账目算得清楚。',
    points: ['支持多种支付方式组合', '账单记录可追溯'],
  },
]

const CUSTOM_FEATURES = [
  {
    title: '短信 / 邮件自动提醒',
    body: '预约提交后自动发短信或邮件提醒顾客和店主，需要接入短信服务商账号（Twilio 等），技术上不难，需要额外的账号和费用。',
  },
  {
    title: '真实空档时间选择',
    body: '顾客选时间时只显示还没被约的空档，而不是自己填一个可能已经被占用的时间。',
  },
  {
    title: '会员卡 / 次卡 / 储值卡',
    body: '按次自动扣费、月卡到期提醒——健身、按摩类门店常见需求，目前系统里没有，需要单独开发。',
  },
  {
    title: '多门店切换查看',
    body: '数据结构已经支持一个账号下挂多个门店，但后台界面目前只按单门店展示，多门店切换的界面需要补。',
  },
  {
    title: '按获客渠道细分统计',
    body: '现在能看出"这个预约是不是线上提交的"，如果要进一步区分是来自小红书、微信还是 Google，需要加对应的渠道标记。',
  },
]

export default function FeaturesPage() {
  return (
    <div>
      <MarketingNav />

      <section className="bg-brand-gradient relative overflow-hidden pt-16 pb-20 text-white">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="font-heading max-w-2xl text-4xl leading-tight md:text-5xl">
            功能清单
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">
            分两栏说清楚：哪些是系统现在已经在跑的，哪些是能做、但需要额外开发时间的。不把还没做的说成已经有的。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="font-heading text-2xl text-foreground md:text-3xl">现在就有</h2>
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {BUILT_FEATURES.map(({ icon: Icon, title, body, points }) => (
            <div key={title} className="rounded-2xl border border-border p-6 shadow-sm">
              <div className="flex size-10 items-center justify-center rounded-full bg-accent">
                <Icon className="size-5 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="font-heading mt-4 text-lg text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {points.map((point) => (
                  <li key={point} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/50" />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
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
