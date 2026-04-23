import { apiPost } from "./api";

const TOKEN_KEY = "admin_token";
const EMAIL_KEY = "admin_email";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(EMAIL_KEY);
}

export function isLoggedIn(): boolean {
  return !!getToken();
}

export function getAdminEmail(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(EMAIL_KEY);
}

export async function sendOtp(email: string): Promise<void> {
  await apiPost("/api/v1/auth/send-otp", { email });
}

export async function verifyOtp(
  email: string,
  code: string
): Promise<string> {
  const data = await apiPost<{ token: string }>("/api/v1/auth/verify-otp", {
    email,
    code,
  });
  setToken(data.token);
  localStorage.setItem(EMAIL_KEY, email);
  return data.token;
}

export async function login(
  email: string,
  code: string
): Promise<string> {
  return verifyOtp(email, code);
}

export function logout(): void {
  clearToken();
  if (typeof window !== "undefined") {
    window.location.href = "/login";
  }
}
