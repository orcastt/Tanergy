export interface CreditInfo {
  balance: number
  is_logged_in: boolean
}

export interface CreditPackage {
  id: string
  name: string
  credits: number
  price_cents: number
  pro_price_cents: number
}

export const NODE_CREDIT_COSTS: Record<string, number> = {
  research: 5,
  outline_generator: 3,
  writer: 10,
  reviewer: 12,
  image_planner: 3,
  image_gen: 15,
  image_list: 15,
  html_formatter: 4,
}
