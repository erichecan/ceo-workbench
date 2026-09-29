import { getSession } from '@/lib/auth'
import { listProducts } from '@/lib/db/queries/products'
import ProductsTable from '@/components/inventory/ProductsTable'
import { redirect } from 'next/navigation'

export default async function InventoryPage() {
  const session = await getSession()
  if (!session) redirect('/login')
  const products = await listProducts(session.workspaceId)
  return <ProductsTable initialProducts={products} />
}
