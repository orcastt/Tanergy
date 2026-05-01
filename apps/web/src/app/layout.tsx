import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TANGENT',
  description: 'A clean Web AI image canvas.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
