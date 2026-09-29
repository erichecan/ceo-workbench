/**
 * 临时验证脚本：结账联动（M4+M5 单元3 — 库存/优惠券/礼品卡/积分）
 * 用法：npx tsx scripts/verify-checkout.ts
 * 用完即删，不接入 CI。所有测试数据在一个隔离 workspace 下创建，断言结束后用
 * workspace.delete 级联清理，不影响其它数据。
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const TEST_SLUG = `verify-checkout-${Date.now()}`

async function main() {
  const { prisma } = await import('../lib/db')
  const { checkoutSale, CheckoutError } = await import('../lib/db/queries/sales')

  let failures = 0
  function assert(cond: boolean, msg: string) {
    if (cond) {
      console.log(`  PASS: ${msg}`)
    } else {
      console.log(`  FAIL: ${msg}`)
      failures++
    }
  }

  const workspace = await prisma.workspace.create({
    data: { name: 'Verify Checkout WS', slug: TEST_SLUG, pointsPerEuro: 1, pointsValueCents: 1 },
  })
  const location = await prisma.location.create({
    data: { workspaceId: workspace.id, name: 'Main' },
  })
  const client = await prisma.client.create({
    data: { workspaceId: workspace.id, name: 'Verify Client', pointsBalance: 100 },
  })
  const product = await prisma.product.create({
    data: { workspaceId: workspace.id, name: 'Shampoo', price: 2000, stockQty: 3, lowStockThreshold: 1 },
  })
  const coupon = await prisma.coupon.create({
    data: { workspaceId: workspace.id, code: 'VERIFY20', discountType: 'PERCENT', discountValue: 20, isActive: true },
  })
  const giftCard = await prisma.giftCard.create({
    data: { workspaceId: workspace.id, code: 'GCVERIFY01', initialValue: 1000, balance: 1000, isActive: true },
  })

  try {
    console.log('--- 场景1：库存不足应返回 CheckoutError ---')
    try {
      await checkoutSale(workspace.id, {
        locationId: location.id,
        discountAmount: 0,
        tipAmount: 0,
        paymentMethod: 'CASH',
        items: [{ productId: product.id, name: 'Shampoo', price: 2000, quantity: 10 }],
      })
      assert(false, '库存不足应抛出 CheckoutError，但没有抛出')
    } catch (err) {
      assert(err instanceof CheckoutError, `库存不足抛出 CheckoutError (${err instanceof Error ? err.message : err})`)
    }
    const afterFail = await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
    assert(afterFail.stockQty === 3, `库存不足失败时未扣减库存 (stockQty=${afterFail.stockQty})`)

    console.log('--- 场景2：优惠券折扣正确应用 ---')
    const sale1 = await checkoutSale(workspace.id, {
      locationId: location.id,
      clientId: client.id,
      discountAmount: 0,
      tipAmount: 0,
      paymentMethod: 'CASH',
      items: [{ productId: product.id, name: 'Shampoo', price: 2000, quantity: 2 }],
      couponCode: 'VERIFY20',
    })
    // subtotal = 4000, 20% off = 800
    assert(sale1.couponAmount === 800, `优惠券折扣金额正确 (couponAmount=${sale1.couponAmount}，期望 800)`)
    assert(sale1.total === 4000 - 800, `订单总额正确 (total=${sale1.total}，期望 3200)`)
    const afterCoupon = await prisma.coupon.findUniqueOrThrow({ where: { id: coupon.id } })
    assert(afterCoupon.usedCount === 1, `优惠券使用次数已计次 (usedCount=${afterCoupon.usedCount})`)
    const stockAfterSale1 = await prisma.product.findUniqueOrThrow({ where: { id: product.id } })
    assert(stockAfterSale1.stockQty === 1, `库存已正确扣减 (stockQty=${stockAfterSale1.stockQty}，期望 1)`)

    console.log('--- 场景3：礼品卡余额不足应返回 CheckoutError ---')
    try {
      // 订单金额 20000 远大于礼品卡余额 1000，giftCardAmount 请求 1500（未超订单金额但超卡余额）应被拒绝
      await checkoutSale(workspace.id, {
        locationId: location.id,
        discountAmount: 0,
        tipAmount: 0,
        paymentMethod: 'CASH',
        items: [{ name: 'Manual Service', price: 20000, quantity: 1 }],
        giftCardCode: 'GCVERIFY01',
        giftCardAmount: 1500,
      })
      assert(false, '礼品卡余额不足应抛出 CheckoutError，但没有抛出')
    } catch (err) {
      assert(err instanceof CheckoutError, `礼品卡余额不足抛出 CheckoutError (${err instanceof Error ? err.message : err})`)
    }
    const giftCardAfterFail = await prisma.giftCard.findUniqueOrThrow({ where: { id: giftCard.id } })
    assert(giftCardAfterFail.balance === 1000, `礼品卡余额不足失败时未扣减余额 (balance=${giftCardAfterFail.balance})`)

    console.log('--- 场景4：礼品卡正常抵扣 + 积分抵扣与累计 ---')
    const sale2 = await checkoutSale(workspace.id, {
      locationId: location.id,
      clientId: client.id,
      discountAmount: 0,
      tipAmount: 0,
      paymentMethod: 'CASH',
      items: [{ name: 'Manual Service', price: 5000, quantity: 1 }],
      giftCardCode: 'GCVERIFY01',
      giftCardAmount: 1000,
      redeemPoints: 50,
    })
    assert(sale2.giftCardAmount === 1000, `礼品卡抵扣金额正确 (giftCardAmount=${sale2.giftCardAmount})`)
    assert(sale2.pointsRedeemed === 50, `积分抵扣数量正确 (pointsRedeemed=${sale2.pointsRedeemed})`)
    // remaining after giftcard = 5000-1000=4000; pointsValueCents=1 -> 50 points = 50 cents deducted
    assert(sale2.total === 5000 - 1000 - 50, `礼品卡+积分抵扣后总额正确 (total=${sale2.total}，期望 3950)`)
    const giftCardAfterSale2 = await prisma.giftCard.findUniqueOrThrow({ where: { id: giftCard.id } })
    assert(giftCardAfterSale2.balance === 0, `礼品卡余额扣减到 0 (balance=${giftCardAfterSale2.balance})`)
    const clientAfterSale2 = await prisma.client.findUniqueOrThrow({ where: { id: client.id } })
    // pointsBalance: 起始 100 → sale1(场景2，有 clientId) 消费额(4000-800=3200)/100=32 分累计 → 132
    // → sale2 抵扣 50 分、消费额 5000/100=50 分累计 → 132-50+50=132
    assert(
      clientAfterSale2.pointsBalance === 132,
      `客户积分余额正确 (pointsBalance=${clientAfterSale2.pointsBalance}，期望 132)`
    )

    console.log(failures === 0 ? '\n全部通过' : `\n${failures} 项失败`)
  } finally {
    await prisma.workspace.delete({ where: { id: workspace.id } })
    console.log('已清理测试数据 (workspace.delete 级联)')
    await prisma.$disconnect()
  }

  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
