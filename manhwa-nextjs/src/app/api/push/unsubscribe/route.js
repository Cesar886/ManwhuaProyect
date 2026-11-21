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

export async function DELETE(request) {
  if (!isSameOrigin(request)) return json({ error: 'Origen no permitido.' }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'El cuerpo de la solicitud no es JSON válido.' }, 400);
  }

  const endpoint = body?.endpoint;
  const slug = body?.slug;
  if (typeof endpoint !== 'string' || endpoint.length > 2048 || !endpoint.startsWith('https://')
    || (slug !== undefined && (typeof slug !== 'string' || slug.length > 255
      || !/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(slug)))) {
    return json({ error: 'La suscripción no es válida.' }, 400);
  }

  try {
    const subscription = await prisma.pushSubscription.findUnique({
      where: { endpoint },
      select: { id: true },
    });
    if (!subscription) return new NextResponse(null, { status: 204 });

    if (!slug) {
      await prisma.pushSubscription.delete({ where: { id: subscription.id } });
    } else {
      await prisma.pushFollow.deleteMany({
        where: { subscriptionId: subscription.id, manhwaSlug: slug },
      });
      const remainingFollows = await prisma.pushFollow.count({
        where: { subscriptionId: subscription.id },
      });
      if (remainingFollows === 0) {
        await prisma.pushSubscription.delete({ where: { id: subscription.id } });
      }
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('No se pudo eliminar la suscripción push.', error);
    return json({ error: 'No se pudo cancelar la suscripción.' }, 500);
  }
}
