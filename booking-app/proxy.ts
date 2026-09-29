import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, SESSION_COOKIE } from '@/lib/auth'

const PUBLIC_PATHS = [
  '/',
  '/login',
  '/api/auth/login',
  '/book',
  '/api/public',
  '/business-types',
  '/features',
  '/social-media',
]

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone()
  url.pathname = '/login'
  url.search = ''
  return NextResponse.redirect(url)
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(path + '/')
  )
  if (isPublic) return NextResponse.next()

  const token = req.cookies.get(SESSION_COOKIE)?.value
  if (!token) {
    return redirectToLogin(req)
  }

  const session = await verifyToken(token)
  if (!session) {
    return redirectToLogin(req)
  }

  return NextResponse.next()
}

export const config = {
  // 排除 _next 静态资源、favicon，以及 public/ 目录下的常见静态文件后缀
  // （图片/图标等），这些是公开资源，不该被鉴权拦截跳去 /login。
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|webp|gif|ico)$).*)'],
}
