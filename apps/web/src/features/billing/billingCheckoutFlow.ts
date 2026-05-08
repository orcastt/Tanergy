'use client'

import type { TangentWorkspace } from '@/features/auth/sessionTypes'
import { completeBillingPayment } from './billingClient'
import type { BillingPaymentMutationResponse } from './billingTypes'

type CheckoutFlowOptions = {
  manualCompleteWorkspace?: TangentWorkspace
}

type CheckoutFlowResult = {
  completed?: BillingPaymentMutationResponse
  message: string
  openedHostedCheckout: boolean
}

export async function continueBillingCheckout(
  checkout: BillingPaymentMutationResponse,
  options: CheckoutFlowOptions = {},
): Promise<CheckoutFlowResult> {
  if (!checkout.payment?.id) throw new Error('Checkout did not return a payment id.')
  if (checkout.checkout?.url) {
    window.location.assign(checkout.checkout.url)
    return {
      message: 'Opening secure checkout.',
      openedHostedCheckout: true,
    }
  }
  const completed = await completeBillingPayment(checkout.payment.id, {
    workspace: options.manualCompleteWorkspace,
  })
  return {
    completed,
    message: 'Checkout completed.',
    openedHostedCheckout: false,
  }
}
