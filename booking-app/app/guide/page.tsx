import Link from 'next/link'

export const metadata = {
  title: 'Beauty SaaS — 功能体验指南',
  description: 'NextGen Nail SaaS 产品体验指南，包含所有角色演示和功能说明'
}

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            💅 NextGen Nail SaaS
          </h1>
          <p className="text-xl text-gray-600 mb-4">
            完整的美甲店管理系统 - 产品体验指南
          </p>
          <p className="text-sm text-gray-500">
            支持顾客预约、员工排班、实时提成、积分管理
          </p>
        </div>

        {/* System Overview */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">系统架构</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-pink-50 to-pink-100 rounded-lg p-6">
              <div className="text-2xl mb-2">📱</div>
              <h3 className="font-bold text-gray-900 mb-2">顾客端</h3>
              <p className="text-sm text-gray-700 mb-4">
                移动 Web App，支持在线预约、积分管理、订单查看
              </p>
              <a href="/" className="text-pink-600 font-semibold text-sm hover:underline">
                访问 →
              </a>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6">
              <div className="text-2xl mb-2">👔</div>
              <h3 className="font-bold text-gray-900 mb-2">员工/技师端</h3>
              <p className="text-sm text-gray-700 mb-4">
                iPad Web App，支持查看日程、客户档案、评价反馈
              </p>
              <a href="/staff" className="text-blue-600 font-semibold text-sm hover:underline">
                访问 →
              </a>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6">
              <div className="text-2xl mb-2">⚙️</div>
              <h3 className="font-bold text-gray-900 mb-2">管理员面板</h3>
              <p className="text-sm text-gray-700 mb-4">
                店铺管理、员工管理、销售报表、财务结算
              </p>
              <a href="/login" className="text-purple-600 font-semibold text-sm hover:underline">
                登录 →
              </a>
            </div>
          </div>
        </div>

        {/* Roles & Demo Accounts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Role 1: Shop Owner/Manager */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👨‍💼</span>
                <div>
                  <h3 className="text-lg font-bold text-white">店主/经理</h3>
                  <p className="text-purple-100 text-sm">Owner / Manager</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <h4 className="font-semibold text-gray-900 mb-3">主要职责</h4>
              <ul className="text-sm text-gray-700 space-y-2 mb-4">
                <li>✓ 查看日历和预约安排</li>
                <li>✓ 管理员工和客户档案</li>
                <li>✓ 处理结账和积分发放</li>
                <li>✓ 查看销售报表和财务数据</li>
                <li>✓ 管理服务项目和价格</li>
              </ul>
              <div className="bg-purple-50 rounded p-4 mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">演示账号</p>
                <p className="font-mono text-sm text-gray-900">📧 owner@demo.com</p>
                <p className="font-mono text-sm text-gray-900">🔐 password123</p>
              </div>
              <Link href="/login" className="w-full inline-block text-center bg-purple-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-purple-700 transition">
                进入管理面板
              </Link>
            </div>
          </div>

          {/* Role 2: Staff/Technician */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👩‍🦰</span>
                <div>
                  <h3 className="text-lg font-bold text-white">技师/员工</h3>
                  <p className="text-blue-100 text-sm">Technician / Staff</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <h4 className="font-semibold text-gray-900 mb-3">主要职责</h4>
              <ul className="text-sm text-gray-700 space-y-2 mb-4">
                <li>✓ 查看今日和本周日程</li>
                <li>✓ 浏览客户档案和偏好</li>
                <li>✓ 接受客户评价反馈</li>
                <li>✓ 查看实时提成和收入</li>
                <li>✓ 管理 Add-on 追加项目</li>
              </ul>
              <div className="bg-blue-50 rounded p-4 mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">演示账号（iPad App）</p>
                <p className="text-sm text-gray-600">
                  员工端为 iPad 专用 Web App，在 /staff 目录下
                </p>
              </div>
              <Link href="/staff" className="w-full inline-block text-center bg-blue-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-blue-700 transition">
                进入员工端
              </Link>
            </div>
          </div>

          {/* Role 3: Customer */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-pink-500 to-pink-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👸</span>
                <div>
                  <h3 className="text-lg font-bold text-white">顾客</h3>
                  <p className="text-pink-100 text-sm">Customer</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <h4 className="font-semibold text-gray-900 mb-3">主要功能</h4>
              <ul className="text-sm text-gray-700 space-y-2 mb-4">
                <li>✓ 在线预约美甲服务</li>
                <li>✓ 选择喜欢的技师</li>
                <li>✓ 添加 Add-on 项目</li>
                <li>✓ 查看积分余额和等级</li>
                <li>✓ 查看预约历史和评价</li>
              </ul>
              <div className="bg-pink-50 rounded p-4 mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">演示入口</p>
                <p className="text-sm text-gray-600">
                  顾客端为移动 Web App，首次访问时显示完整预约流程
                </p>
              </div>
              <a href="/" className="w-full inline-block text-center bg-pink-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-pink-700 transition">
                进入顾客端
              </a>
            </div>
          </div>

          {/* Role 4: Admin */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-green-600 px-6 py-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🔐</span>
                <div>
                  <h3 className="text-lg font-bold text-white">系统管理员</h3>
                  <p className="text-green-100 text-sm">Admin</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <h4 className="font-semibold text-gray-900 mb-3">系统权限</h4>
              <ul className="text-sm text-gray-700 space-y-2 mb-4">
                <li>✓ 完整的系统配置权限</li>
                <li>✓ 所有数据查看和导出</li>
                <li>✓ 用户和权限管理</li>
                <li>✓ 系统监控和日志</li>
                <li>✓ 财务和积分审核</li>
              </ul>
              <div className="bg-green-50 rounded p-4 mb-4">
                <p className="text-xs font-semibold text-gray-700 mb-2">系统管理</p>
                <p className="text-sm text-gray-600">
                  使用店主账号登录，在管理面板中管理所有设置
                </p>
              </div>
              <Link href="/login" className="w-full inline-block text-center bg-green-600 text-white py-2 px-4 rounded-lg font-semibold hover:bg-green-700 transition">
                系统登录
              </Link>
            </div>
          </div>
        </div>

        {/* Feature Modules */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">核心功能模块</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              {
                icon: '📅',
                title: '预约管理',
                desc: '14 天日历、时间段选择、动态时长计算、多技师对比'
              },
              {
                icon: '💰',
                title: '结账系统',
                desc: '价格可调、折扣、小费、多种支付方式支持、实时手续费计算'
              },
              {
                icon: '⭐',
                title: '积分系统',
                desc: '100 积分=$1、会员等级（Silver/Gold/Premium）、积分兑换、跨门店通用'
              },
              {
                icon: '👥',
                title: '客户档案',
                desc: '客户信息、偏好备注、预约历史、评价反馈、积分记录'
              },
              {
                icon: '💼',
                title: '员工管理',
                desc: '员工信息、排班日历、实时提成、评价反馈、服务统计'
              },
              {
                icon: '📊',
                title: '销售报表',
                desc: '当日营收、交易笔数、支付方式分布、折扣统计、利润分析'
              },
              {
                icon: '🔐',
                title: '权限系统',
                desc: 'JWT 认证、角色权限管理（Owner/Manager/Staff/Customer）、工作区隔离'
              },
              {
                icon: '📱',
                title: '跨端响应',
                desc: '顾客移动端、员工平板端、管理员桌面端，统一设计语言'
              }
            ].map((feature, idx) => (
              <div key={idx} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition">
                <div className="text-2xl mb-2">{feature.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Access Points */}
        <div className="bg-white rounded-lg shadow-sm p-8 mb-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">访问入口</h2>
          <div className="space-y-4">
            <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
              <span className="text-2xl mt-1">📍</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">顾客端 (Customer Booking)</h3>
                <p className="text-sm text-gray-600 mb-2">移动 Web App - 预约、积分、订单</p>
                <code className="bg-gray-100 px-3 py-1 rounded text-sm text-gray-900 font-mono">
                  http://localhost:3000 (开发环境)
                </code>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
              <span className="text-2xl mt-1">📍</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">员工端 (Staff Dashboard)</h3>
                <p className="text-sm text-gray-600 mb-2">iPad Web App - 日程、客户档案、提成</p>
                <code className="bg-gray-100 px-3 py-1 rounded text-sm text-gray-900 font-mono">
                  http://localhost:3000/staff (开发环境)
                </code>
              </div>
            </div>

            <div className="flex items-start gap-4 pb-4 border-b border-gray-200">
              <span className="text-2xl mt-1">📍</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">管理面板 (Admin Dashboard)</h3>
                <p className="text-sm text-gray-600 mb-2">Next.js Server App - 员工、客户、销售、权限</p>
                <code className="bg-gray-100 px-3 py-1 rounded text-sm text-gray-900 font-mono">
                  http://localhost:3001 (开发环境)
                </code>
                <p className="text-xs text-gray-500 mt-2">
                  登录: owner@demo.com / password123
                </p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <span className="text-2xl mt-1">📍</span>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1">本指南 (Guide Page)</h3>
                <p className="text-sm text-gray-600 mb-2">产品体验指南和演示文档</p>
                <code className="bg-gray-100 px-3 py-1 rounded text-sm text-gray-900 font-mono">
                  http://localhost:3000/guide (本页)
                </code>
              </div>
            </div>
          </div>
        </div>

        {/* Testing Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-blue-900 mb-4">🧪 快速测试流程</h2>
          <div className="space-y-4 text-sm text-blue-900">
            <div>
              <h3 className="font-semibold mb-2">1. 店主登录 → 查看日历</h3>
              <p className="ml-4">访问 /login，使用演示账号登录 → 点击 Calendar 标签 → 查看今日预约列表</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">2. 处理预约 → 结账</h3>
              <p className="ml-4">在日历页点击任一预约卡片 → 打开 Checkout Modal → 调整价格/折扣 → 选支付方式 → 点"Complete & Post Points"</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">3. 查看销售报表</h3>
              <p className="ml-4">点击 Sales 标签 → 查看当日营收、交易笔数、支付方式分布、折扣统计</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">4. 管理员工和客户</h3>
              <p className="ml-4">点击 Team 标签 → 查看员工列表 / 点击 Clients 标签 → 查看客户列表和编辑</p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">5. 顾客预约流程</h3>
              <p className="ml-4">访问顾客端 / → 开始预约流程 → 选择店铺/服务/技师/时间 → 确认提交</p>
            </div>
          </div>
        </div>

        {/* Tech Stack */}
        <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">技术架构</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">顾客端 & 员工端</h3>
              <ul className="text-sm text-gray-700 space-y-2">
                <li>⚛️ React 19 + TypeScript</li>
                <li>🎨 Tailwind CSS v4 + custom design system</li>
                <li>⚡ Vite (快速开发&构建)</li>
                <li>🧩 Shared library (共享 UI、状态、类型)</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">管理面板</h3>
              <ul className="text-sm text-gray-700 space-y-2">
                <li>🔗 Next.js 16 (App Router)</li>
                <li>🗄️ PostgreSQL + Prisma ORM</li>
                <li>🔐 JWT 认证 + Server Actions</li>
                <li>📦 Neon 云数据库</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8 text-gray-600">
          <p className="text-sm">
            NextGen Nail SaaS • 完整的美甲店管理系统
          </p>
          <p className="text-xs mt-2">
            点击下方任一按钮，立即体验产品 ↓
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
          <Link href="/login" className="px-8 py-3 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition text-center">
            → 进入管理面板
          </Link>
          <Link href="/staff" className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition text-center">
            → 进入员工端
          </Link>
          <a href="/" className="px-8 py-3 bg-pink-600 text-white rounded-lg font-semibold hover:bg-pink-700 transition text-center">
            → 进入顾客端
          </a>
        </div>
      </div>
    </div>
  )
}
