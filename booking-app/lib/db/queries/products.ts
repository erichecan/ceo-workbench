import { prisma } from '@/lib/db'

export interface ProductInput {
  name: string
  sku?: string | null
  price: number
  stockQty: number
  lowStockThreshold: number
}

export async function listProducts(workspaceId: string, opts?: { includeArchived?: boolean }) {
  return prisma.product.findMany({
    where: { workspaceId, ...(opts?.includeArchived ? {} : { isArchived: false }) },
    orderBy: { name: 'asc' },
  })
}

export async function getProduct(id: string, workspaceId: string) {
  return prisma.product.findFirst({ where: { id, workspaceId } })
}

export async function createProduct(workspaceId: string, data: ProductInput) {
  return prisma.product.create({ data: { workspaceId, ...data } })
}

export async function updateProduct(id: string, workspaceId: string, data: Partial<ProductInput>) {
  return prisma.product.updateMany({ where: { id, workspaceId }, data })
}

export async function archiveProduct(id: string, workspaceId: string) {
  return prisma.product.updateMany({ where: { id, workspaceId }, data: { isArchived: true } })
}
