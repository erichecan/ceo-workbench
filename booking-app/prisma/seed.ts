import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient, Role, BookingChannel, AppointmentStatus, PaymentMethod } from '../lib/generated/prisma'
import bcrypt from 'bcryptjs'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
const prisma = new PrismaClient({ adapter })

function daysAgo(n: number, hour = 10, minute = 0) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(hour, minute, 0, 0)
  return d
}

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo-salon' },
    update: { taxRate: 13.5 },
    create: {
      name: 'Beauty Studio Dublin',
      slug: 'demo-salon',
      taxRate: 13.5,
    },
  })

  const location = await prisma.location.upsert({
    where: { id: 'loc-main' },
    update: { name: 'Dublin City Centre', address: '12 Grafton Street, Dublin 2, Ireland', timezone: 'Europe/Dublin' },
    create: {
      id: 'loc-main',
      workspaceId: workspace.id,
      name: 'Dublin City Centre',
      address: '12 Grafton Street, Dublin 2, Ireland',
      timezone: 'Europe/Dublin',
    },
  })

  const passwordHash = await bcrypt.hash('password123', 10)

  const ownerMember = await prisma.teamMember.upsert({
    where: { workspaceId_email: { workspaceId: workspace.id, email: 'owner@demo.com' } },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: "Sarah O'Brien",
      email: 'owner@demo.com',
      role: Role.OWNER,
      calendarColor: '#8B5CF6',
    },
  })

  await prisma.user.upsert({
    where: { email: 'owner@demo.com' },
    update: {},
    create: {
      workspaceId: workspace.id,
      email: 'owner@demo.com',
      passwordHash,
      role: Role.OWNER,
      teamMemberId: ownerMember.id,
    },
  })

  const staffMember = await prisma.teamMember.upsert({
    where: { workspaceId_email: { workspaceId: workspace.id, email: 'staff@demo.com' } },
    update: {},
    create: {
      workspaceId: workspace.id,
      name: 'Emma Murphy',
      email: 'staff@demo.com',
      role: Role.LOW,
      calendarColor: '#F472B6',
    },
  })

  await prisma.user.upsert({
    where: { email: 'staff@demo.com' },
    update: {},
    create: {
      workspaceId: workspace.id,
      email: 'staff@demo.com',
      passwordHash,
      role: Role.LOW,
      teamMemberId: staffMember.id,
    },
  })

  // Service categories + services
  const catManicure = await prisma.serviceCategory.upsert({
    where: { id: 'cat-manicure' },
    update: {},
    create: { id: 'cat-manicure', workspaceId: workspace.id, name: 'Manicure', color: '#F472B6', sortOrder: 1 },
  })
  const catPedicure = await prisma.serviceCategory.upsert({
    where: { id: 'cat-pedicure' },
    update: {},
    create: { id: 'cat-pedicure', workspaceId: workspace.id, name: 'Pedicure', color: '#FB923C', sortOrder: 2 },
  })
  const catFacial = await prisma.serviceCategory.upsert({
    where: { id: 'cat-facial' },
    update: {},
    create: { id: 'cat-facial', workspaceId: workspace.id, name: 'Facial', color: '#34D399', sortOrder: 3 },
  })

  const svcGel = await prisma.service.upsert({
    where: { id: 'svc-gel' },
    update: {},
    create: { id: 'svc-gel', workspaceId: workspace.id, categoryId: catManicure.id, name: 'Gel Manicure', price: 6500, duration: 60 },
  })
  const svcClassicMani = await prisma.service.upsert({
    where: { id: 'svc-classic-mani' },
    update: {},
    create: { id: 'svc-classic-mani', workspaceId: workspace.id, categoryId: catManicure.id, name: 'Classic Manicure', price: 3500, duration: 45 },
  })
  const svcGelPedi = await prisma.service.upsert({
    where: { id: 'svc-gel-pedi' },
    update: {},
    create: { id: 'svc-gel-pedi', workspaceId: workspace.id, categoryId: catPedicure.id, name: 'Gel Pedicure', price: 7000, duration: 75 },
  })
  const svcClassicPedi = await prisma.service.upsert({
    where: { id: 'svc-classic-pedi' },
    update: {},
    create: { id: 'svc-classic-pedi', workspaceId: workspace.id, categoryId: catPedicure.id, name: 'Classic Pedicure', price: 4500, duration: 60 },
  })
  const svcHydra = await prisma.service.upsert({
    where: { id: 'svc-hydra-facial' },
    update: {},
    create: { id: 'svc-hydra-facial', workspaceId: workspace.id, categoryId: catFacial.id, name: 'Hydra Facial', price: 9000, duration: 60 },
  })

  const services = [svcGel, svcClassicMani, svcGelPedi, svcClassicPedi, svcHydra]

  // ── Clients ──────────────────────────────────────────────────────────────────
  const clientsData = [
    { id: 'client-demo', name: 'Jane Smith', email: 'jane@example.com', phone: '+353861234567', memberSince: new Date('2024-01-15') },
    { id: 'client-silver', name: 'Aoife Kelly', email: 'aoife@example.com', phone: '+353871234568', memberSince: new Date('2023-06-10') },
    { id: 'client-gold', name: 'Siobhan Walsh', email: 'siobhan@example.com', phone: '+353851234569', memberSince: new Date('2023-01-20') },
    { id: 'client-platinum', name: 'Niamh Ryan', email: 'niamh@example.com', phone: '+353891234570', memberSince: new Date('2022-03-05') },
    { id: 'client-new', name: 'Ciara Burke', email: 'ciara@example.com', phone: '+353861239999', memberSince: new Date('2024-03-01') },
  ]

  const clients: Record<string, { id: string; name: string }> = {}

  for (const cd of clientsData) {
    const c = await prisma.client.upsert({
      where: { id: cd.id },
      update: { name: cd.name, phone: cd.phone, email: cd.email, lastVisitAt: daysAgo(1) },
      create: {
        id: cd.id,
        workspaceId: workspace.id,
        name: cd.name,
        email: cd.email,
        phone: cd.phone,
        memberSince: cd.memberSince,
        lastVisitAt: daysAgo(3),
      },
    })
    clients[cd.id] = c
  }

  // ── Historical sales (last 30 days) ──────────────────────────────────────────
  const historicalSales = [
    { daysBack: 2, clientId: 'client-demo', svcId: 'svc-gel', teamMember: ownerMember, hour: 10 },
    { daysBack: 3, clientId: 'client-silver', svcId: 'svc-hydra-facial', teamMember: staffMember, hour: 14 },
    { daysBack: 4, clientId: 'client-gold', svcId: 'svc-gel-pedi', teamMember: ownerMember, hour: 11 },
    { daysBack: 5, clientId: 'client-platinum', svcId: 'svc-classic-mani', teamMember: staffMember, hour: 16 },
    { daysBack: 6, clientId: 'client-new', svcId: 'svc-classic-mani', teamMember: ownerMember, hour: 9 },
    { daysBack: 7, clientId: 'client-silver', svcId: 'svc-gel', teamMember: staffMember, hour: 13 },
    { daysBack: 9, clientId: 'client-gold', svcId: 'svc-hydra-facial', teamMember: ownerMember, hour: 10 },
    { daysBack: 10, clientId: 'client-platinum', svcId: 'svc-gel-pedi', teamMember: staffMember, hour: 15 },
    { daysBack: 11, clientId: 'client-demo', svcId: 'svc-classic-pedi', teamMember: ownerMember, hour: 11 },
    { daysBack: 12, clientId: 'client-silver', svcId: 'svc-classic-mani', teamMember: staffMember, hour: 14 },
    { daysBack: 13, clientId: 'client-new', svcId: 'svc-gel', teamMember: ownerMember, hour: 10 },
    { daysBack: 14, clientId: 'client-gold', svcId: 'svc-gel', teamMember: staffMember, hour: 12 },
    { daysBack: 16, clientId: 'client-platinum', svcId: 'svc-hydra-facial', teamMember: ownerMember, hour: 10 },
    { daysBack: 17, clientId: 'client-demo', svcId: 'svc-gel', teamMember: staffMember, hour: 15 },
    { daysBack: 18, clientId: 'client-silver', svcId: 'svc-gel-pedi', teamMember: ownerMember, hour: 11 },
    { daysBack: 19, clientId: 'client-gold', svcId: 'svc-classic-mani', teamMember: staffMember, hour: 14 },
    { daysBack: 20, clientId: 'client-new', svcId: 'svc-classic-pedi', teamMember: ownerMember, hour: 9 },
    { daysBack: 21, clientId: 'client-platinum', svcId: 'svc-gel', teamMember: staffMember, hour: 16 },
    { daysBack: 23, clientId: 'client-demo', svcId: 'svc-hydra-facial', teamMember: ownerMember, hour: 10 },
    { daysBack: 24, clientId: 'client-silver', svcId: 'svc-classic-mani', teamMember: staffMember, hour: 13 },
    { daysBack: 25, clientId: 'client-gold', svcId: 'svc-gel-pedi', teamMember: ownerMember, hour: 11 },
    { daysBack: 26, clientId: 'client-platinum', svcId: 'svc-hydra-facial', teamMember: staffMember, hour: 15 },
    { daysBack: 27, clientId: 'client-new', svcId: 'svc-gel', teamMember: ownerMember, hour: 10 },
    { daysBack: 28, clientId: 'client-silver', svcId: 'svc-gel', teamMember: staffMember, hour: 14 },
    { daysBack: 29, clientId: 'client-gold', svcId: 'svc-classic-pedi', teamMember: ownerMember, hour: 12 },
    { daysBack: 30, clientId: 'client-platinum', svcId: 'svc-gel', teamMember: staffMember, hour: 10 },
  ]

  const TAX_RATE = workspace.taxRate / 100

  for (let i = 0; i < historicalSales.length; i++) {
    const h = historicalSales[i]
    const svc = services.find((s) => s.id === h.svcId)!
    const startTime = daysAgo(h.daysBack, h.hour)
    const endTime = new Date(startTime.getTime() + svc.duration * 60000)

    const apptId = `appt-hist-${i}`
    const saleId = `sale-hist-${i}`

    const existingAppt = await prisma.appointment.findUnique({ where: { id: apptId } })
    if (existingAppt) continue

    const subtotal = svc.price
    const taxAmount = Math.round(subtotal * TAX_RATE)
    const total = subtotal + taxAmount

    await prisma.$transaction(async (tx) => {
      const appt = await tx.appointment.create({
        data: {
          id: apptId,
          workspaceId: workspace.id,
          locationId: location.id,
          clientId: h.clientId,
          teamMemberId: h.teamMember.id,
          startTime,
          endTime,
          status: AppointmentStatus.COMPLETED,
          channel: BookingChannel.OFFLINE,
          services: {
            create: [{ serviceId: svc.id, price: svc.price, duration: svc.duration }],
          },
        },
      })

      const sale = await tx.sale.create({
        data: {
          id: saleId,
          workspaceId: workspace.id,
          locationId: location.id,
          appointmentId: appt.id,
          clientId: h.clientId,
          teamMemberId: h.teamMember.id,
          subtotal,
          discountAmount: 0,
          tipAmount: 0,
          taxRate: workspace.taxRate,
          taxAmount,
          total,
          paymentMethod: PaymentMethod.CARD,
          items: {
            create: [{ serviceId: svc.id, name: svc.name, price: svc.price }],
          },
        },
      })

      // Link sale createdAt to historical date
      await tx.sale.update({
        where: { id: sale.id },
        data: { createdAt: startTime },
      })
    })
  }

  // ── Today's appointment (upcoming, not yet completed) ─────────────────────────
  const todayStart = new Date()
  todayStart.setHours(10, 0, 0, 0)
  const todayEnd = new Date(todayStart)
  todayEnd.setMinutes(todayEnd.getMinutes() + svcGel.duration)

  await prisma.appointment.upsert({
    where: { id: 'appt-demo' },
    update: {},
    create: {
      id: 'appt-demo',
      workspaceId: workspace.id,
      locationId: location.id,
      clientId: clients['client-demo'].id,
      teamMemberId: ownerMember.id,
      startTime: todayStart,
      endTime: todayEnd,
      status: AppointmentStatus.CONFIRMED,
      channel: BookingChannel.OFFLINE,
      services: {
        create: [{ serviceId: svcGel.id, price: svcGel.price, duration: svcGel.duration }],
      },
    },
  })

  // ── Tomorrow's appointment ────────────────────────────────────────────────────
  const tmrStart = daysAgo(-1, 14, 30)
  const tmrEnd = new Date(tmrStart.getTime() + svcHydra.duration * 60000)

  await prisma.appointment.upsert({
    where: { id: 'appt-demo-2' },
    update: {},
    create: {
      id: 'appt-demo-2',
      workspaceId: workspace.id,
      locationId: location.id,
      clientId: clients['client-gold'].id,
      teamMemberId: staffMember.id,
      startTime: tmrStart,
      endTime: tmrEnd,
      status: AppointmentStatus.BOOKED,
      channel: BookingChannel.ONLINE,
      services: {
        create: [{ serviceId: svcHydra.id, price: svcHydra.price, duration: svcHydra.duration }],
      },
    },
  })

  console.log('✅ Seed complete — core booking demo data loaded')
  console.log('---')
  console.log('Admin login:  owner@demo.com / password123')
  console.log('Staff login:  staff@demo.com / password123')
  console.log('---')
  console.log('Workspace ID:', workspace.id)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
