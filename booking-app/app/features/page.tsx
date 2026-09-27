import { MarketingNav } from '@/components/marketing/MarketingNav'
import {
  Globe, CalendarDays, Users, UserCheck, Scissors, ReceiptText, Clock, Wrench,
} from 'lucide-react'

const BUILT_FEATURES = [
  {
    icon: Globe,
    title: '顾客在线预约页',
    body: '专属链接（如 /book/你的店），顾客不用注册，选服务、填时间、留电话就能提交预约请求。',
  },
  {
    icon: CalendarDays,
    title: '日历日 / 周视图',
    body: '预约按状态上色，顾客线上提交的会单独标出来，避免和你手动录入的搞混。',
  },
  {
    icon: Clock,
    title: '新预约提醒',
    body: '后台侧边栏实时显示"线上提交、还没确认"的预约数量，不用天天翻日历找有没有新单。',
  },
  {
    icon: Scissors,
    title: '服务项目管理',
    body: '按分类组织服务，支持固定价 / 起价 / 免费三种定价方式，可以单独关闭某个服务的线上预约。',
  },
  {
    icon: UserCheck,
    title: '员工排班与提成',
    body: '员工按角色管理，日历按人上色，每人可设置独立的提成比例。',
  },
  {
    icon: Users,
    title: '客户档案',
    body: '顾客第一次在线预约会按电话号码自动建档，后续预约自动关联同一个客户。',
  },
  {
    icon: ReceiptText,
    title: '结账收银',
    body: '一次结账可以组合税费、小费、折扣、礼品卡、储值卡，账目算得清楚。',
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

      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <h1 className="font-heading text-3xl text-primary">功能清单</h1>
            <p className="mt-3 text-muted-foreground">
              分两栏说清楚：哪些是系统现在已经在跑的，哪些是能做、但需要额外开发时间的。不把还没做的说成已经有的。
            </p>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1633526543814-9718c8922b7a?auto=format&fit=crop&w=700&q=80"
            alt="预约日历示意（Unsplash 免费商用占位图，待替换为真实客户门店照片）"
            className="aspect-[7/5] w-full rounded-2xl object-cover shadow-md"
          />
        </div>

        <h2 className="mt-14 font-heading text-xl text-foreground">现在就有</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {BUILT_FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-xl border border-border p-5">
              <Icon className="mb-2.5 size-5 text-primary" strokeWidth={1.5} />
              <h3 className="font-heading text-base text-foreground">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-14 flex items-center gap-2 font-heading text-xl text-foreground">
          <Wrench className="size-5 text-muted-foreground" strokeWidth={1.5} />
          可以做，但需要定制开发
        </h2>
        <div className="mt-5 flex flex-col gap-3">
          {CUSTOM_FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-dashed border-border p-5">
              <h3 className="text-base font-medium text-foreground">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
