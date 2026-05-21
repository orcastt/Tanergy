'use client'

import type { TangentWorkspace } from '@/features/auth/sessionTypes'
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
  void options.manualCompleteWorkspace
  throw new Error('Checkout completion is disabled during beta. Ask Admin Finance to enable the plan manually.')
}
