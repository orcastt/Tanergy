import { googleAuth } from "./auth"
import { useAuthStore } from "../store/authStore"

function getGoogleClientId(): string {
  return import.meta.env.VITE_GOOGLE_CLIENT_ID || ""
}

export function getGoogleAuthUrl(): string {
  const clientId = getGoogleClientId()
  const redirectUri = `${window.location.origin}/login`
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "consent",
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function handleGoogleCallback(code: string): Promise<void> {
  const { token, user } = await googleAuth(code)
  useAuthStore.getState().login(token, user)
}
