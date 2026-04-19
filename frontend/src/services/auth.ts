import api from "./api"
import type { AuthResponse, SendOtpResponse } from "../types/auth"

export async function sendOtp(email: string): Promise<SendOtpResponse> {
  const { data } = await api.post<SendOtpResponse>("/auth/send-otp", { email })
  return data
}

export async function verifyOtp(email: string, code: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/verify-otp", { email, code })
  return data
}

export async function googleAuth(code: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/google", { code })
  return data
}

export async function getMe(): Promise<{ id: string; email: string; display_name: string; avatar_url: string | null; created_at: string }> {
  const { data } = await api.get("/auth/me")
  return data
}

export async function logout(): Promise<void> {
  await api.post("/auth/logout")
}
