export type OptionType = 'call' | 'put'
export type PositionSide = 'long' | 'short'

export interface OptionPosition {
  id: string
  label: string
  underlying: string
  optionType: OptionType
  side: PositionSide
  contracts: number
  multiplier: number
  strike: number
  maturity: number
  volatility: number
  riskFreeRate: number
  dividendYield: number
  premiumOverride: number | null
}

export interface OptionGreeks {
  delta: number
  gamma: number
  vega: number
  theta: number
  rho: number
}

export interface OptionValue extends OptionGreeks {
  price: number
}

export function createDefaultSpyPut(spot: number): OptionPosition {
  return {
    id: 'spy-protective-put',
    label: 'SPY downside hedge',
    underlying: 'SPY',
    optionType: 'put',
    side: 'long',
    contracts: 1,
    multiplier: 100,
    strike: Math.round(spot * 0.95 * 100) / 100,
    maturity: 0.25,
    volatility: 0.22,
    riskFreeRate: 0.043,
    dividendYield: 0.013,
    premiumOverride: null,
  }
}
