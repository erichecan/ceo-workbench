import { MarketingNav } from '@/components/marketing/MarketingNav'

interface BusinessType {
  name: string
  fit: 'ready' | 'workable'
  summary: string
  detail: string
}

const BUSINESS_TYPES: BusinessType[] = [
  {
    name: '美甲美睫工作室',
    fit: 'ready',
    summary: '已有真实门店在用',
    detail:
      '服务项目按时长和价格类型（固定价/起价/免费）管理，顾客在线选款式、选技师空档，是目前验证最完整的场景。',
  },
  {
    name: '美容 / 护肤 Spa',
    fit: 'ready',
    summary: '开箱即用',
    detail:
      '服务分类、员工排班、客户档案、结账收银这套组合本来就是按美容业态设计的，套餐类服务（用"起价"价格类型）也支持。',
  },
  {
    name: '理发 /理容店',
    fit: 'ready',
    summary: '开箱即用',
    detail: '员工按角色和提成比例管理，日历按员工上色，适合有多个理发师同时接客的门店。',
  },
  {
    name: '按摩 / 推拿',
    fit: 'ready',
    summary: '开箱即用',
    detail: '预约时长和价格灵活配置，结账支持小费——这是按摩类门店常见但很多系统会漏掉的一项。',
  },
  {
    name: '私教 / 小型健身工作室',
    fit: 'workable',
    summary: '核心能用，按次卡/月卡需定制',
    detail:
      '一对一私教预约没问题；但健身房常见的"次卡""月卡"自动扣次逻辑现在没有，需要额外开发，见功能页说明。',
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

      <section className="mx-auto max-w-4xl px-6 py-16">
        <h1 className="font-heading text-3xl text-primary">这套系统适合哪些门店</h1>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          核心是"服务项目 + 时长 + 员工 + 预约日历 + 结账"这一套通用组合，本来就是按预约制门店设计的。
          下面按业态说清楚现在能直接用、还是需要额外开发。
        </p>

        <div className="mt-10 flex flex-col gap-4">
          {BUSINESS_TYPES.map((b) => (
            <div key={b.name} className="rounded-xl border border-border p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-heading text-xl text-foreground">{b.name}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-medium ${FIT_LABEL[b.fit].className}`}>
                  {FIT_LABEL[b.fit].text}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium text-primary">{b.summary}</p>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.detail}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          没看到你的业态？大概率也能用——核心模型是通用的，具体聊聊你门店的预约方式就知道差多少。
        </p>
      </section>
    </div>
  )
}
