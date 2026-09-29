import type { LucideIcon } from 'lucide-react'
import {
  Globe, CalendarDays, Clock, Scissors, UserCheck, Users, ReceiptText,
  Package, Gift, Wallet, Plug,
} from 'lucide-react'

export interface FeaturePoint {
  title: string
  body: string
}

export interface Feature {
  slug: string
  icon: LucideIcon
  title: string
  summary: string
  intro: string
  screenshot: string
  screenshotAlt: string
  points: FeaturePoint[]
}

export const BUILT_FEATURES: Feature[] = [
  {
    slug: 'online-booking',
    icon: Globe,
    title: '顾客在线预约页',
    summary: '专属链接（如 /book/你的店），顾客不用注册，选服务、填时间、留电话就能提交预约请求。',
    intro:
      '每个门店有自己的专属预约链接，可以直接发在小红书简介、微信朋友圈、Google 商家页上。顾客打开就能选服务、填时间、留电话，不用下载 App、不用注册账号。',
    screenshot: '/screenshots/booking-demo.png',
    screenshotAlt: '真实预约页截图（/book/demo-salon）',
    points: [
      { title: '按服务分类浏览', body: '服务按分类展示，价格和时长一眼看清，不用一条条问店主。' },
      { title: '手机端排版', body: '专门按手机屏幕排版，不用缩放、不用横屏就能操作完成。' },
      { title: '自动建档', body: '顾客提交预约后，后台会按电话号码自动建立客户档案，不用店主手动录入。' },
    ],
  },
  {
    slug: 'calendar',
    icon: CalendarDays,
    title: '日历日 / 周 / 月视图',
    summary: '预约按状态上色，顾客线上提交的会单独标出来，避免和你手动录入的搞混。',
    intro:
      '日历是每天开门第一件要看的东西。除了基础的日 / 周视图，这次还补上了冲突检测、多员工分栏和月视图，让排班更不容易出错。',
    screenshot: '/screenshots/calendar.png',
    screenshotAlt: '真实后台日历页截图（多员工分栏 + 待处理提醒角标）',
    points: [
      { title: '预约冲突检测', body: '同一员工同时段不能重复约，改期一样会拦，不会自己撞单。' },
      { title: '多员工分栏', body: '多个技师同时接客时，日视图按人分栏，不用来回切换筛选。' },
      { title: '月视图', body: '月视图看整月排期，日 / 周视图管当天细节，两种视角配合用。' },
      { title: '筛选与详情', body: '点击预约直接查看详情，支持按员工筛选只看自己的单。' },
    ],
  },
  {
    slug: 'new-appointment-alerts',
    icon: Clock,
    title: '新预约提醒',
    summary: '后台侧边栏实时显示"线上提交、还没确认"的预约数量，不用天天翻日历找有没有新单。',
    intro:
      '顾客在线提交的预约不会直接生效，会先进"待确认"状态，侧边栏用红色角标实时显示数量，店主确认后才正式排进日历。',
    screenshot: '/screenshots/calendar.png',
    screenshotAlt: '后台侧边栏"预约日历"旁的待处理数量角标',
    points: [
      { title: '数量常驻显示', body: '待处理数量常驻在侧边栏，不用打开日历一条条数。' },
      { title: '一键确认或拒绝', body: '不用打开日历逐条查找，列表里直接处理。' },
      { title: '自动同步', body: '确认后自动同步进日历对应时段，不用再手动录入一遍。' },
    ],
  },
  {
    slug: 'services',
    icon: Scissors,
    title: '服务项目管理',
    summary: '按分类组织服务，支持固定价 / 起价 / 免费三种定价方式，可以单独关闭某个服务的线上预约。',
    intro: '服务项目是整套系统的基础——时长、价格、能不能线上约，都是从这里配的。',
    screenshot: '/screenshots/services.png',
    screenshotAlt: '真实服务项目管理页截图',
    points: [
      { title: '三种定价方式', body: '固定价、起价、免费，套餐类服务不用硬拆成单项报价。' },
      { title: '可设置服务时长', body: '每个服务单独设置时长，日历排期按实际时长计算。' },
      { title: '按业态分类', body: '服务按分类组织，可按业态灵活分组，方便顾客浏览。' },
    ],
  },
  {
    slug: 'staff',
    icon: UserCheck,
    title: '员工排班与提成',
    summary: '员工按角色管理，日历按人上色，每人可设置独立的提成比例。',
    intro: '员工按角色分权限管理，日历按人上色，提成比例既能按人设置，也能按服务单独覆盖。',
    screenshot: '/screenshots/team.png',
    screenshotAlt: '真实员工管理页截图',
    points: [
      { title: '三级角色权限', body: '店主 / 管理者 / 普通员工三级权限，管理者能看报表，普通员工只能看自己的单。' },
      { title: '日历按人上色', body: '多个技师同时接客时，一眼能分清谁的预约。' },
      { title: '提成比例可覆盖', body: '每人可设置独立提成比例，具体到某个服务时还能单独覆盖默认比例。' },
    ],
  },
  {
    slug: 'clients',
    icon: Users,
    title: '客户档案',
    summary: '顾客第一次在线预约会按电话号码自动建档，后续预约自动关联同一个客户。',
    intro: '客户档案不用店主手动维护——第一次在线预约就自动建好，后续都会自动关联到同一个人。',
    screenshot: '/screenshots/clients.png',
    screenshotAlt: '真实客户档案页截图',
    points: [
      { title: '自动去重', body: '按电话号码自动识别，不会给同一个人建出好几条重复档案。' },
      { title: '历史预约可查', body: '可以直接查看这个客户过去的预约记录，不用翻日历找。' },
    ],
  },
  {
    slug: 'checkout',
    icon: ReceiptText,
    title: '结账收银',
    summary: '一次结账可以组合税费、小费、折扣、礼品卡、储值卡，账目算得清楚。',
    intro: '结账页把服务、商品、优惠券、礼品卡都揉到一次结算里，账目自动算清楚，不用店主自己心算。',
    screenshot: '/screenshots/checkout.png',
    screenshotAlt: '真实结账/销售记录页截图',
    points: [
      { title: '多方式组合结算', body: '税费、小费、折扣可以在同一次结账里组合计算。' },
      { title: '库存商品可加购', body: '结账时能直接把库存里的商品加进账单，自动扣库存。' },
      { title: '优惠券 / 礼品卡抵扣', body: '输入优惠码或礼品卡号，系统实时验证并计算抵扣金额。' },
    ],
  },
  {
    slug: 'inventory',
    icon: Package,
    title: '库存管理',
    summary: '洗发水、美甲油这类零售商品的库存管理，库存不够会自动标红提醒。',
    intro: '除了服务，很多门店也卖实体商品。库存模块管这类零售品的进销存，不用再拿本子记。',
    screenshot: '/screenshots/inventory.png',
    screenshotAlt: '真实库存管理页截图',
    points: [
      { title: 'SKU / 价格 / 库存', body: '每个商品单独设置 SKU、价格和库存数量。' },
      { title: '低库存自动提醒', body: '库存低于设定阈值会自动标红，不用自己天天数还剩多少。' },
      { title: '归档不影响历史', body: '不再卖的商品可以归档，归档后不会出现在结账商品列表里。' },
      { title: '结账直接扣库存', body: '结账时把商品加进账单，库存会自动扣减，不用手动改数字。' },
    ],
  },
  {
    slug: 'memberships',
    icon: Gift,
    title: '会员权益（优惠券 / 礼品卡）',
    summary: '给老客户发优惠券、卖礼品卡，结账时能直接核销抵扣。',
    intro: '优惠券和礼品卡是两套独立又能一起用的会员权益工具，结账页直接核销，不用店主口算折扣。',
    screenshot: '/screenshots/memberships.png',
    screenshotAlt: '真实会员权益（优惠券/礼品卡）页截图',
    points: [
      { title: '两种折扣方式', body: '优惠券支持按百分比或固定金额两种折扣方式。' },
      { title: '有效期与次数上限', body: '可设置过期时间和使用次数上限，用完或过期自动失效。' },
      { title: '礼品卡余额抵扣', body: '礼品卡记录面值和余额，可关联到具体客户，结账时直接抵扣。' },
    ],
  },
  {
    slug: 'payroll',
    icon: Wallet,
    title: '工资结算',
    summary: '员工打卡记录工时，按提成比例自动算出该发多少钱，不用自己拿计算器对账。',
    intro: '员工打卡、算提成、出结算报表，这三步以前都是店主自己拿表格对账，现在系统自动算。',
    screenshot: '/screenshots/payroll.png',
    screenshotAlt: '真实工资结算页截图',
    points: [
      { title: '上下班打卡', body: '员工打卡记录上下班时间，自动累计工时，不用自己记。' },
      { title: '提成比例可覆盖', body: '提成比例按员工整体设置，具体到某个服务时还能单独覆盖。' },
      { title: '一键生成结算报表', body: '选定周期后一键生成报表，工时和提成总额自动算好。' },
      { title: '草稿 / 已确认状态', body: '结算记录标记状态，避免同一个周期被重复结算。' },
    ],
  },
  {
    slug: 'integrations',
    icon: Plug,
    title: '通知与营销集成',
    summary: '预约创建后可以自动发邮件 / 短信提醒客户，客户信息也能同步进 Mailchimp 做营销。',
    intro:
      '这块接的是 Resend（邮件）、Twilio（短信）、Mailchimp（客户名单同步）三个第三方服务，需要店主自己去申请账号、填进设置页才会真的发送——没填之前系统会跳过，不会报错也不会卡住下单流程。',
    screenshot: '/screenshots/integrations.png',
    screenshotAlt: '真实集成设置页截图（Resend / Twilio / Mailchimp）',
    points: [
      { title: '三个接入点', body: 'Resend 邮件、Twilio 短信、Mailchimp 客户名单同步，三选一或都配都可以。' },
      { title: '未配置自动跳过', body: '没填 API Key 时系统会跳过发送，不影响预约、结账等主流程。' },
      { title: '只有店主能改', body: '涉及密钥，只有店主（OWNER）角色能看到和修改这些设置。' },
      { title: '填完立刻生效', body: '填好 API Key 保存后，下一个新预约就会真的发出通知，不用改代码。' },
    ],
  },
]

export const CUSTOM_FEATURES: FeaturePoint[] = [
  {
    title: '真实空档时间选择',
    body: '顾客选时间时只显示还没被约的空档，而不是自己填一个可能已经被占用的时间。',
  },
  {
    title: '会员次卡自动扣费',
    body: '健身、按摩类门店常见的"买 10 次课，每次自动扣 1 次"这种次卡逻辑还没有——储值卡 / 礼品卡已经有了，能按金额充值和抵扣，但按"次数"计费要另外开发。',
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

export function getFeatureBySlug(slug: string): Feature | undefined {
  return BUILT_FEATURES.find((f) => f.slug === slug)
}
