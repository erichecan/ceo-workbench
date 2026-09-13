import { prisma } from '@/lib/db'
import { PriceType } from '@/lib/generated/prisma'

export async function getServicesWithCategories(workspaceId: string) {
  return prisma.service.findMany({
    where: { workspaceId, isArchived: false },
    include: { category: true },
    orderBy: { name: 'asc' },
  })
}

export async function getCategories(workspaceId: string) {
  return prisma.serviceCategory.findMany({
    where: { workspaceId },
    orderBy: { sortOrder: 'asc' },
  })
}

export async function createService(
  workspaceId: string,
  data: {
    name: string
    categoryId?: string
    description?: string
    priceType: PriceType
    price: number
    duration: number
    isOnlineBookable: boolean
  }
) {
  return prisma.service.create({ data: { workspaceId, ...data } })
}

export async function updateService(
  id: string,
  workspaceId: string,
  data: Partial<{
    name: string
    description: string
    priceType: PriceType
    price: number
    duration: number
    isOnlineBookable: boolean
    isArchived: boolean
  }> & { categoryId?: string | null }
) {
  return prisma.service.updateMany({ where: { id, workspaceId }, data })
}

export async function archiveService(id: string, workspaceId: string) {
  return prisma.service.updateMany({ where: { id, workspaceId }, data: { isArchived: true } })
}
