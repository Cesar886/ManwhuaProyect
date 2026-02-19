import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

const DISCORD_API = 'https://discord.com/api/v10'

export async function POST() {
  try {
    const cookieStore = await cookies()
    const discordToken = cookieStore.get('discord_token')?.value

    // Optionally revoke the Discord token (best practice but not required)
    if (discordToken) {
      try {
        const clientId = process.env.NEXT_PUBLIC_DISCORD_CLIENT_ID
        const clientSecret = process.env.DISCORD_CLIENT_SECRET

        await fetch(`${DISCORD_API}/oauth2/token/revoke`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            token: discordToken,
          }),
        })
      } catch (revokeError) {
        // Log but don't fail logout if revoke fails
        console.warn('Failed to revoke Discord token:', revokeError)
      }
    }

    // Clear all auth cookies
    cookieStore.delete('discord_token')
    cookieStore.delete('discord_refresh_token')
    cookieStore.delete('discord_user')

    return NextResponse.json({
      success: true,
      message: 'Sesion cerrada exitosamente',
    })
  } catch (error) {
    console.error('Logout error:', error)

    // Still try to clear cookies even on error
    try {
      const cookieStore = await cookies()
      cookieStore.delete('discord_token')
      cookieStore.delete('discord_refresh_token')
      cookieStore.delete('discord_user')
    } catch {}

    return NextResponse.json(
      { success: false, message: 'Error al cerrar sesion' },
      { status: 500 }
    )
  }
}
