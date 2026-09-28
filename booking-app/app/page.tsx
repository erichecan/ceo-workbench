import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { CalendarDays, Users, ReceiptText, Globe, ArrowRight } from 'lucide-react'

const HERO_IMAGES = [
  {
    src: 'https://images.unsplash.com/photo-1633526543814-9718c8922b7a?auto=format&fit=crop&w=500&q=80',
    alt: '预约日历示意（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
  },
  {
    src: 'https://images.unsplash.com/photo-1619607146034-5a05296c8f9a?auto=format&fit=crop&w=500&q=80',
    alt: '美甲服务实景（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
  },
  {
    src: 'https://images.unsplash.com/photo-1759134198561-e2041049419c?auto=format&fit=crop&w=500&q=80',
    alt: '理发店实景（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
  },
]

const HIGHLIGHTS = [
  {
    icon: Globe,
    eyebrow: '顾客预约',
    title: '顾客自助在线预约，日历自动帮你标好',
    body: '专属预约链接，顾客不用注册就能选服务、填时间、留电话提交预约请求。线上提交的预约会在日历上单独标出来，待确认数量在后台侧边栏随时提醒你，不用天天翻日历找有没有新单。',
    imageUrl: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=700&q=80',
    imageAlt: '美甲店手部护理场景（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
    linkHref: '/book/demo-salon',
    linkLabel: '看看预约页长什么样',
  },
  {
    icon: CalendarDays,
    eyebrow: '服务与员工',
    title: '服务项目和员工排班，一个后台管到底',
    body: '服务按分类组织，支持固定价、起价、免费三种定价方式，可以单独关闭某个服务的线上预约。员工按角色管理，日历按人上色，每人可以设置独立的提成比例，不用再拿表格对账。',
    imageUrl: 'https://images.unsplash.com/photo-1787651343620-8d5303006ecb?auto=format&fit=crop&w=700&q=80',
    imageAlt: '美容 Spa 实景（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
    linkHref: '/features',
    linkLabel: '看完整功能清单',
  },
  {
    icon: Users,
    eyebrow: '客户档案',
    title: '客户与员工都在一个系统里',
    body: '顾客第一次在线预约会按电话号码自动建档，后续预约自动关联同一个客户，不用来回切换表格找人，也不会同一个人建出好几条重复记录。',
    imageUrl: 'https://images.unsplash.com/photo-1630835425197-50feeba99ecd?auto=format&fit=crop&w=700&q=80',
    imageAlt: '按摩推拿门店实景（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
    linkHref: '/business-types',
    linkLabel: '看看适合我的店吗',
  },
  {
    icon: ReceiptText,
    eyebrow: '结账收银',
    title: '结账支持真实场景，账目一次算清楚',
    body: '税费、小费、折扣、礼品卡、储值卡可以组合结算，不用再手动加加减减。一次结账里同时处理多种支付方式，是很多同类系统会漏掉的一项。',
    imageUrl: 'https://images.unsplash.com/photo-1648542036561-e1d66a5ae2b1?auto=format&fit=crop&w=700&q=80',
    imageAlt: '私教工作室实景（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
    linkHref: '/features',
    linkLabel: '看完整功能清单',
  },
]

export default function MarketingHome() {
  return (
    <div>
      <MarketingNav />

      <section className="bg-brand-gradient relative overflow-hidden pt-16 pb-20 text-white">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="font-heading max-w-3xl text-4xl leading-tight md:text-6xl md:leading-[1.1]">
            给美甲、美容、美发这类预约制门店的在线预约与日常管理系统
          </h1>
          <p className="mt-6 max-w-lg text-lg text-white/85">
            一个链接就能收顾客的预约请求，一个日历管好每天的安排，客户、员工、结账都在同一个地方。
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link
              href="/book/demo-salon"
              className="rounded-full bg-white px-7 py-3.5 text-base font-semibold text-primary shadow-lg transition-transform hover:scale-[1.02]"
            >
              查看预约页 Demo
            </Link>
            <Link
              href="/business-types"
              className="inline-flex items-center gap-1.5 text-base font-medium text-white/90 hover:text-white"
            >
              看看适不适合我的店
              <ArrowRight className="size-4" strokeWidth={2} />
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-3 gap-4">
            {HERO_IMAGES.map((img) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={img.src}
                src={img.src}
                alt={img.alt}
                className="aspect-[4/5] w-full rounded-xl object-cover shadow-xl"
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="font-heading text-center text-3xl text-foreground md:text-4xl">
          给你的店配好了什么
        </h2>
        <div className="mt-14 flex flex-col gap-20">
          {HIGHLIGHTS.map(({ icon: Icon, eyebrow, title, body, imageUrl, imageAlt, linkHref, linkLabel }, i) => (
            <div key={title} className="grid items-center gap-10 md:grid-cols-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={imageAlt}
                className={`aspect-[4/3] w-full rounded-2xl object-cover shadow-md ${i % 2 ? 'md:order-2' : ''}`}
              />
              <div>
                <Icon className="mb-3 size-7 text-primary" strokeWidth={1.5} />
                <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">{eyebrow}</p>
                <h3 className="font-heading mt-1.5 text-2xl text-foreground md:text-3xl">{title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{body}</p>
                <Link
                  href={linkHref}
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  {linkLabel}
                  <ArrowRight className="size-3.5" strokeWidth={2} />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-16 text-center text-sm text-muted-foreground">
          还提供{' '}
          <Link href="/social-media" className="font-medium text-primary hover:underline">
            社交媒体代运营
          </Link>{' '}
          服务，内容整理中。
        </p>
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

      <footer className="bg-[#1f1233] py-14 text-white/70">
        <div className="mx-auto flex max-w-5xl flex-col gap-10 px-6 sm:flex-row sm:justify-between">
          <div>
            <p className="font-heading text-lg text-white">Beauty & Wellness Booking</p>
            <p className="mt-2 max-w-xs text-sm text-white/60">
              给美甲、美容、美发这类预约制门店做的在线预约与日常管理系统。
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-white">产品</p>
            <ul className="mt-3 space-y-2 text-sm">
              <li>
                <Link href="/business-types" className="hover:text-white">
                  适用业态
                </Link>
              </li>
              <li>
                <Link href="/features" className="hover:text-white">
                  功能
                </Link>
              </li>
              <li>
                <Link href="/social-media" className="hover:text-white">
                  社交媒体代运营
                </Link>
              </li>
              <li>
                <Link href="/book/demo-salon" className="hover:text-white">
                  预约页 Demo
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-10 text-center text-xs text-white/40">© 2026 Beauty & Wellness Booking</p>
      </footer>
    </div>
  )
}
