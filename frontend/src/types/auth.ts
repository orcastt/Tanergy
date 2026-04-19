export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl: string | null
  createdAt: string
}

export interface AuthResponse {
  token: string
  user: User
  isNewUser: boolean
}

export interface SendOtpResponse {
  message: string
  expiresIn: number
  dev_code?: string
}
