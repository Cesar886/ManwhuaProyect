import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { sendNotification, setVapidDetails } from 'web-push';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

function hasValidSecret(request) {
  const expected = process.env.PUSH_SEND_SECRET;
  const authorization = request.headers.get('authorization') || '';
  const provided = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!expected || !provided) return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length
    && timingSafeEqual(expectedBuffer, providedBuffer);
}

function validSlug(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 255
    && /^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(value);
}

function safeChapterPath(value, origin) {
  try {
    const url = new URL(value, origin);
    if (url.origin !== origin
      || !/^\/(?:en\/)?manhwa\/[^/]+\/(?:capitulo|chapter)\/[^/]+\/?$/i.test(url.pathname)
        && !/^\/nsfw\/[^/]+\/capitulo\/[^/]+\/?$/i.test(url.pathname)) return null;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

export async function POST(request) {
  if (!hasValidSecret(request)) return json({ error: 'No autorizado.' }, 401);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) {
    return json({ error: 'Las claves VAPID no están configuradas.' }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'El cuerpo de la solicitud no es JSON válido.' }, 400);
  }

  const slug = body?.slug;
  if (!validSlug(slug)) return json({ error: 'El slug del manhwa no es válido.' }, 400);

  const url = safeChapterPath(body?.url || body?.chapterUrl, new URL(request.url).origin);
  if (!url) return json({ error: 'Indica la URL interna del capítulo que debe abrirse.' }, 400);
  const payload = JSON.stringify({
    title: String(body?.title || 'Nuevo capítulo').slice(0, 100),
    body: String(body?.body || `Hay un nuevo capítulo de ${slug.replace(/-/g, ' ')}.`).slice(0, 300),
    url,
    tag: `manhwa-${slug}`,
  });

  try {
    setVapidDetails(subject, publicKey, privateKey);
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { follows: { some: { manhwaSlug: slug } } },
      select: { id: true, endpoint: true, p256dh: true, auth: true },
    });

    let sent = 0;
    let removed = 0;
    let failed = 0;
    for (let index = 0; index < subscriptions.length; index += 25) {
      const batch = subscriptions.slice(index, index + 25);
      const results = await Promise.allSettled(batch.map(async (subscription) => {
        try {
          await sendNotification({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          }, payload, { TTL: 60 * 60 });
          return 'sent';
        } catch (error) {
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
            return 'removed';
          }
          console.error('Falló el envío de una notificación push.', error);
          return 'failed';
        }
      }));

      for (const result of results) {
        if (result.status === 'rejected') failed += 1;
        else if (result.value === 'sent') sent += 1;
        else if (result.value === 'removed') removed += 1;
        else failed += 1;
      }
    }

    return json({ success: true, matched: subscriptions.length, sent, removed, failed });
  } catch (error) {
    console.error('No se pudo enviar la notificación push.', error);
    return json({ error: 'No se pudo enviar la notificación.' }, 500);
  }
}
