import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function isSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    const originUrl = new URL(origin);
    const expectedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim()
      || request.headers.get('host')
      || new URL(request.url).host;
    const expectedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0].trim()
      || new URL(request.url).protocol.slice(0, -1);
    return originUrl.host.toLowerCase() === expectedHost.toLowerCase()
      && originUrl.protocol === `${expectedProtocol}:`;
  } catch {
    return false;
  }
}

function validSlug(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 255
    && /^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(value);
}

function validEndpoint(value) {
  try {
    return typeof value === 'string' && value.length <= 2048 && new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(request) {
  if (!isSameOrigin(request)) return json({ error: 'Origen no permitido.' }, 403);
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_SUBJECT) {
    return json({ error: 'Las notificaciones push no están configuradas.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'El cuerpo de la solicitud no es JSON válido.' }, 400);
  }

  const subscription = body?.subscription;
  const slug = body?.slug;
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;

  if (!validSlug(slug) || !validEndpoint(endpoint)
    || typeof p256dh !== 'string' || p256dh.length < 20 || p256dh.length > 512
    || typeof auth !== 'string' || auth.length < 8 || auth.length > 512) {
    return json({ error: 'La suscripción o el manhwa no son válidos.' }, 400);
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const saved = await transaction.pushSubscription.upsert({
        where: { endpoint },
        update: {
          p256dh,
          auth,
          userAgent: request.headers.get('user-agent')?.slice(0, 500) || null,
        },
        create: {
          endpoint,
          p256dh,
          auth,
          userAgent: request.headers.get('user-agent')?.slice(0, 500) || null,
        },
        select: { id: true },
      });

      await transaction.pushFollow.upsert({
        where: {
          subscriptionId_manhwaSlug: {
            subscriptionId: saved.id,
            manhwaSlug: slug,
          },
        },
        update: {},
        create: {
          subscriptionId: saved.id,
          manhwaSlug: slug,
        },
      });
    });

    return json({ success: true }, 201);
  } catch (error) {
    console.error('No se pudo guardar la suscripción push.', error);
    return json({ error: 'No se pudo guardar la suscripción.' }, 500);
  }
}
