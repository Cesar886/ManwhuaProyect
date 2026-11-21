import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';

export const dynamic = 'force-dynamic';

function getAuthMeUrl() {
  const rawBase = process.env.INTERNAL_API_URL
    || process.env.NEXT_PUBLIC_API_URL_PROD
    || process.env.NEXT_PUBLIC_API_URL_LOCAL
    || '';
  const base = rawBase.replace(/\/$/, '');
  if (!base) return null;
  return `${base}${base.endsWith('/api') ? '' : '/api'}/auth/me`;
}

export async function GET(request) {
  const authMeUrl = getAuthMeUrl();
  const secret = process.env.PRESENCE_SECRET;
  if (!authMeUrl || !secret) {
    return NextResponse.json({}, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const apiKey = process.env.INTERNAL_API_KEY || process.env.NEXT_PUBLIC_INTERNAL_API_KEY || '';
    const response = await fetch(authMeUrl, {
      method: 'GET',
      cache: 'no-store',
      headers: {
        cookie: request.headers.get('cookie') || '',
        ...(apiKey ? { 'x-api-key': apiKey } : {}),
      },
    });

    if (!response.ok) return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
    const body = await response.json();
    const user = body?.data?.user;
    if (!user?.id || !user?.username || user.showActiveReader === false) {
      return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username, avatar: user.avatarUrl || null },
      secret,
      { expiresIn: '5m' },
    );
    return NextResponse.json({ token }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({}, { headers: { 'Cache-Control': 'no-store' } });
  }
}
