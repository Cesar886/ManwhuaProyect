import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const DISCORD_API = 'https://discord.com/api/v10'

function getDiscordConfig(request) {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET

  // Determine redirect URI based on environment
  const origin = request.headers.get('origin') || request.headers.get('referer')
  let redirectUri = process.env.NEXT_PUBLIC_DISCORD_REDIRECT_URI

  // For production, use the production URL
  if (process.env.NODE_ENV === 'production' || (origin && origin.includes('manhwaimperial.site'))) {
    redirectUri = process.env.DISCORD_REDIRECT_URI_PROD || 'https://manhwaimperial.site/auth/discord/callback'
  }

  return { clientId, clientSecret, redirectUri }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { success: false, message: 'Codigo de autorizacion requerido' },
        { status: 400 }
      )
    }

    const { clientId, clientSecret, redirectUri } = getDiscordConfig(request)

    if (!clientId || !clientSecret) {
      console.error('Discord OAuth not configured: missing CLIENT_ID or CLIENT_SECRET')
      return NextResponse.json(
        { success: false, message: 'Discord OAuth no configurado' },
        { status: 500 }
      )
    }

    // Exchange code for tokens
    const tokenResponse = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('Discord token exchange error:', tokenResponse.status, errorText)

      let errorMessage = 'Error al obtener token de Discord'
      try {
        const errorData = JSON.parse(errorText)
        if (errorData.error === 'invalid_grant') {
          errorMessage = 'Codigo de autorizacion invalido o expirado'
        } else if (errorData.error_description) {
          errorMessage = errorData.error_description
        }
      } catch {}

      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: 401 }
      )
    }

    const tokens = await tokenResponse.json()
    const { access_token, refresh_token, expires_in } = tokens

    if (!access_token) {
      return NextResponse.json(
        { success: false, message: 'No se recibio token de acceso de Discord' },
        { status: 401 }
      )
    }

    // Get user info from Discord
    const userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    })

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('Discord user fetch error:', userResponse.status, errorText)
      return NextResponse.json(
        { success: false, message: 'Error al obtener informacion del usuario de Discord' },
        { status: 401 }
      )
    }

    const discordUser = await userResponse.json()

    // Validate required fields
    if (!discordUser.id) {
      return NextResponse.json(
        { success: false, message: 'Respuesta invalida de Discord' },
        { status: 401 }
      )
    }

    // Build avatar URL with proper format detection
    let avatarUrl = null
    if (discordUser.avatar) {
      const isAnimated = discordUser.avatar.startsWith('a_')
      const extension = isAnimated ? 'gif' : 'png'
      avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${extension}?size=256`
    } else {
      // Default avatar based on discriminator or user id
      const defaultIndex = discordUser.discriminator === '0'
        ? (BigInt(discordUser.id) >> 22n) % 6n
        : parseInt(discordUser.discriminator) % 5
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`
    }

    // Build user object
    const user = {
      id: discordUser.id,
      discordId: discordUser.id,
      username: discordUser.username,
      name: discordUser.global_name || discordUser.username,
      email: discordUser.email || null,
      avatar: avatarUrl,
      banner: discordUser.banner
        ? `https://cdn.discordapp.com/banners/${discordUser.id}/${discordUser.banner}.png?size=600`
        : null,
      provider: 'discord',
      verified: discordUser.verified || false,
    }

    // Set auth cookies (httpOnly for security)
    const isProduction = process.env.NODE_ENV === 'production'
    const cookieStore = await cookies()

    cookieStore.set('discord_token', access_token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      maxAge: expires_in || 604800, // Default 7 days if not provided
      path: '/',
    })

    if (refresh_token) {
      cookieStore.set('discord_refresh_token', refresh_token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: '/',
      })
    }

    // Store user info in a separate cookie for client access
    cookieStore.set('discord_user', JSON.stringify({
      id: user.id,
      username: user.username,
      name: user.name,
      avatar: user.avatar,
    }), {
      httpOnly: false, // Accessible from client
      secure: isProduction,
      sameSite: 'lax',
      maxAge: expires_in || 604800,
      path: '/',
    })

    return NextResponse.json({
      success: true,
      user,
      message: 'Login con Discord exitoso',
    })
  } catch (error) {
    console.error('Discord auth error:', error)
    return NextResponse.json(
      { success: false, message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
