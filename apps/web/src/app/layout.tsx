import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TANGENT Canvas Spike',
  description: 'A clean Web AI image canvas prototype.',
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
