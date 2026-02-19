import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const DISCORD_API = 'https://discord.com/api/v10'

async function refreshDiscordToken(refreshToken) {
  const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID
  const clientSecret = process.env.DISCORD_CLIENT_SECRET

  const response = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  })

  if (!response.ok) {
    return null
  }

  return response.json()
}

export async function GET() {
  try {
    const cookieStore = await cookies()
    let discordToken = cookieStore.get('discord_token')?.value
    const refreshToken = cookieStore.get('discord_refresh_token')?.value

    if (!discordToken && !refreshToken) {
      return NextResponse.json(
        { message: 'No autenticado' },
        { status: 401 }
      )
    }

    // Try to get user info with current token
    let userResponse = await fetch(`${DISCORD_API}/users/@me`, {
      headers: {
        Authorization: `Bearer ${discordToken}`,
      },
    })

    // If token expired, try to refresh
    if (!userResponse.ok && userResponse.status === 401 && refreshToken) {
      const newTokens = await refreshDiscordToken(refreshToken)

      if (newTokens?.access_token) {
        discordToken = newTokens.access_token
        const isProduction = process.env.NODE_ENV === 'production'

        // Update cookies with new tokens
        cookieStore.set('discord_token', newTokens.access_token, {
          httpOnly: true,
          secure: isProduction,
          sameSite: 'lax',
          maxAge: newTokens.expires_in || 604800,
          path: '/',
        })

        if (newTokens.refresh_token) {
          cookieStore.set('discord_refresh_token', newTokens.refresh_token, {
            httpOnly: true,
            secure: isProduction,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 30,
            path: '/',
          })
        }

        // Retry with new token
        userResponse = await fetch(`${DISCORD_API}/users/@me`, {
          headers: {
            Authorization: `Bearer ${newTokens.access_token}`,
          },
        })
      }
    }

    if (!userResponse.ok) {
      // Clear invalid cookies
      cookieStore.delete('discord_token')
      cookieStore.delete('discord_refresh_token')
      cookieStore.delete('discord_user')
      return NextResponse.json(
        { message: 'Sesion expirada' },
        { status: 401 }
      )
    }

    const discordUser = await userResponse.json()

    // Build avatar URL with proper format detection
    let avatarUrl = null
    if (discordUser.avatar) {
      const isAnimated = discordUser.avatar.startsWith('a_')
      const extension = isAnimated ? 'gif' : 'png'
      avatarUrl = `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.${extension}?size=256`
    } else {
      const defaultIndex = discordUser.discriminator === '0'
        ? (BigInt(discordUser.id) >> 22n) % 6n
        : parseInt(discordUser.discriminator) % 5
      avatarUrl = `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`
    }

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

    return NextResponse.json({ user })
  } catch (error) {
    console.error('Auth me error:', error)
    return NextResponse.json(
      { message: 'Error interno del servidor' },
      { status: 500 }
    )
  }
}
