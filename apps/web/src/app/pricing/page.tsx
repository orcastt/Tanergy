import type { Metadata } from 'next'
import { PublicPricingPage } from '@/features/billing/PublicPricingPage'

export const metadata: Metadata = {
  title: 'Pricing | Tanergy',
  description: 'Public Tanergy pricing for private beta canvas, collaboration, and Team workspace plans.',
}

export default function PricingPage() {
  return <PublicPricingPage />
}
