// lib/auth.ts
import { NextApiResponse } from 'next'

export async function destroySession(res: NextApiResponse) {
  // Clear all authentication cookies
  res.setHeader('Set-Cookie', [
    'token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly',
    'session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly',
    'role=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly'
  ])
}