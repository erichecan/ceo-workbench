import Link from 'next/link'
import { MarketingNav } from '@/components/marketing/MarketingNav'
import { ArrowRight, CheckCircle2, Wrench } from 'lucide-react'

interface BusinessType {
  name: string
  fit: 'ready' | 'workable'
  eyebrow: string
  summary: string
  readyPoints: string[]
  gapPoints: string[]
  imageUrl: string
  imageAlt: string
}

const BUSINESS_TYPES: BusinessType[] = [
  {
    name: '美甲美睫工作室',
    fit: 'ready',
    eyebrow: '已验证场景',
    summary: '已有真实门店在用，是目前打磨最完整的业态。',
    readyPoints: [
      '款式/时长/价格分开管理，支持固定价与起价',
      '顾客在线选款式、选技师空档，提交预约请求',
      '技师按角色和提成比例管理，日历按人上色',
      '客户按电话号码自动建档，回头客一眼认出来',
    ],
    gapPoints: [],
    imageUrl: 'https://images.unsplash.com/photo-1632345031435-8727f6897d53?auto=format&fit=crop&w=700&q=80',
    imageAlt: '美甲店手部护理场景（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
  },
  {
    name: '美容 / 护肤 Spa',
    fit: 'ready',
    eyebrow: '开箱即用',
    summary: '服务分类、员工排班、客户档案、结账收银这套组合本来就是按美容业态设计的。',
    readyPoints: [
      '套餐类服务用"起价"价格类型，不用拆成单项',
      '服务按分类组织，可单独关闭某项的线上预约',
      '结账支持税费、小费、折扣、礼品卡组合结算',
      '客户档案自动关联历史预约，不用来回翻表格',
    ],
    gapPoints: [],
    imageUrl: 'https://images.unsplash.com/photo-1787651343620-8d5303006ecb?auto=format&fit=crop&w=700&q=80',
    imageAlt: '美容 Spa 实景（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
  },
  {
    name: '理发 / 理容店',
    fit: 'ready',
    eyebrow: '开箱即用',
    summary: '适合有多个理发师同时接客的门店，人多不乱。',
    readyPoints: [
      '员工按角色和提成比例管理',
      '日历按员工上色，谁的单子一眼分清',
      '顾客在线预约页支持指定技师',
      '结账收银统一记账，不用各理发师自己收现金',
    ],
    gapPoints: [],
    imageUrl: 'https://images.unsplash.com/photo-1759134198561-e2041049419c?auto=format&fit=crop&w=700&q=80',
    imageAlt: '理发店实景（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
  },
  {
    name: '按摩 / 推拿',
    fit: 'ready',
    eyebrow: '开箱即用',
    summary: '预约时长和价格灵活配置，结账支持小费——很多同类系统会漏掉的一项。',
    readyPoints: [
      '预约时长按项目单独设置，不用套统一模板',
      '结账支持小费，按摩类门店的高频需求',
      '客户档案记录偏好，方便下次安排同一技师',
      '顾客在线预约页支持提前锁定时段',
    ],
    gapPoints: [],
    imageUrl: 'https://images.unsplash.com/photo-1630835425197-50feeba99ecd?auto=format&fit=crop&w=700&q=80',
    imageAlt: '按摩推拿门店实景（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
  },
  {
    name: '私教 / 小型健身工作室',
    fit: 'workable',
    eyebrow: '健身 / 训练业态',
    summary: '一对一私教预约没问题，健身房常见的次卡/月卡逻辑现在还没做。',
    readyPoints: [
      '一对一私教预约与员工排班',
      '客户档案与结账收银',
    ],
    gapPoints: [
      '次卡 / 月卡自动扣次，需要额外开发',
      '课程满员候补、多人团课排班，需要额外开发',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1648542036561-e1d66a5ae2b1?auto=format&fit=crop&w=700&q=80',
    imageAlt: '私教工作室实景（Unsplash 免费商用占位图，待替换为真实客户门店照片）',
  },
]

const FIT_LABEL: Record<BusinessType['fit'], { text: string; className: string }> = {
  ready: { text: '现在就能用', className: 'bg-accent text-accent-foreground' },
  workable: { text: '核心能用 · 部分需定制', className: 'bg-muted text-muted-foreground' },
}

export default function BusinessTypesPage() {
  return (
    <div>
      <MarketingNav />

      <section className="bg-brand-gradient relative overflow-hidden pt-16 pb-20 text-white">
        <div className="mx-auto max-w-5xl px-6">
          <h1 className="font-heading max-w-2xl text-4xl leading-tight md:text-5xl">
            这套系统适合哪些门店
          </h1>
          <p className="mt-5 max-w-xl text-lg text-white/85">
            核心是"服务项目 + 时长 + 员工 + 预约日历 + 结账"这一套通用组合，本来就是按预约制门店设计的。
            下面按业态说清楚：现在能直接用，还是需要额外开发。
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <div className="flex flex-col gap-20">
          {BUSINESS_TYPES.map((b, i) => (
            <div key={b.name} className="grid items-center gap-10 md:grid-cols-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={b.imageUrl}
                alt={b.imageAlt}
                className={`aspect-[4/3] w-full rounded-2xl object-cover shadow-md ${i % 2 ? 'md:order-2' : ''}`}
              />
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <p className="text-xs font-semibold tracking-wide text-primary/70 uppercase">{b.eyebrow}</p>
                  <span className={`rounded-full px-3 py-1 text-xs font-medium ${FIT_LABEL[b.fit].className}`}>
                    {FIT_LABEL[b.fit].text}
                  </span>
                </div>
                <h2 className="font-heading mt-1.5 text-2xl text-foreground md:text-3xl">{b.name}</h2>
                <p className="mt-3 leading-relaxed text-muted-foreground">{b.summary}</p>

                <ul className="mt-5 flex flex-col gap-2.5">
                  {b.readyPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-foreground">
                      <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" strokeWidth={1.75} />
                      <span>{point}</span>
                    </li>
                  ))}
                  {b.gapPoints.map((point) => (
                    <li key={point} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                      <Wrench className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                      <span>{point}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/features"
                  className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  看完整功能清单
                  <ArrowRight className="size-3.5" strokeWidth={2} />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-16 text-center text-sm text-muted-foreground">
          没看到你的业态？大概率也能用——核心模型是通用的，具体聊聊你门店的预约方式就知道差多少。
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
    </div>
  )
}
