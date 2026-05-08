import type { Metadata } from 'next'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tanergy',
  description: 'A vibrant AI image canvas for structured creative work.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      dynamic
      signInFallbackRedirectUrl="/workspaces"
      signInUrl="/sign-in"
      signUpFallbackRedirectUrl="/workspaces"
      signUpUrl="/sign-up"
    >
      <html lang="en">
        <body>{children}</body>
      </html>
    </ClerkProvider>
  )
}
