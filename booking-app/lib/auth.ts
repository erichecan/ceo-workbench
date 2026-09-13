import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export interface SessionPayload {
  userId: string
  workspaceId: string
  role: string
}

export const SESSION_COOKIE = 'beauty_session'

const jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) throw new Error('JWT_SECRET environment variable is not set')
const secret = new TextEncoder().encode(jwtSecret)

export async function signToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifyToken(token)
}

export function getBearerToken(req: NextRequest): string | null {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null
  return auth.slice(7)
}

export async function requireStaffAuth(req: NextRequest): Promise<SessionPayload | NextResponse> {
  const cookieHeader = req.headers.get('cookie') ?? ''
  const match = cookieHeader.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`))
  const cookieToken = match?.[1] ?? null
  const bearerToken = getBearerToken(req)
  const token = cookieToken ?? bearerToken
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const session = await verifyToken(token)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return session
}

export async function requireOwnerAuth(req: NextRequest): Promise<SessionPayload | NextResponse> {
  const result = await requireStaffAuth(req)
  if (result instanceof NextResponse) return result
  if (result.role !== 'OWNER' && result.role !== 'MANAGER') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return result
}
