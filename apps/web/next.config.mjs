/** @type {import('next').NextConfig} */
// Temporary cross-platform test helper:
// set NEXT_ALLOWED_DEV_ORIGINS for Cloudflare Tunnel + next dev.
// Remove this before treating the tunnel workflow as a production path.
const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const nextConfig = {
  allowedDevOrigins,
  reactStrictMode: true,
}

export default nextConfig
