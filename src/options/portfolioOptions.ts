/*
 * Implementation adapted from the user-owned local OptionLab TypeScript pricing logic; used here for educational portfolio-level analysis.
 */
import type { Asset } from '../data'
import { blackScholes, priceAndGreeks } from './pricing'
import type { OptionGreeks, OptionPosition } from './types'

export interface HedgeScenario {
  id: string
  name: string
  description: string
  underlyingMove?: number
  equityMove?: number
  ivShift?: number
  daysElapsed?: number
}

export interface OptionPositionAnalysis {
  position: OptionPosition
  spot: number
  theoreticalPremium: number
  entryPremium: number
  greeks: OptionGreeks
  aggregateGreeks: OptionGreeks
  marketValue: number
}

export interface HedgeScenarioResult extends HedgeScenario {
  withoutHedge: number
  optionPnl: number
  withHedge: number
  downsideBuffer: number
}

export interface PayoffPoint {
  endingPrice: number
  change: number
  withoutHedge: number
  putPnl: number
  withHedge: number
}

export interface HedgeAnalytics {
  positions: OptionPositionAnalysis[]
  assetDelta: number
  netGreeks: OptionGreeks
  netPremiumCost: number
  scenarios: HedgeScenarioResult[]
  payoff: PayoffPoint[]
  primarySpot: number | null
  primaryStrike: number | null
  primaryUnderlying: string | null
  worstCombinedScenario: HedgeScenarioResult | null
}

const zeroGreeks: OptionGreeks = { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 }

export const hedgeScenarios: HedgeScenario[] = [
  { id: 'underlying-down-10', name: 'Underlying −10%', description: 'Each option-underlying sleeve falls 10%.', underlyingMove: -0.10 },
  { id: 'underlying-down-20', name: 'Underlying −20%', description: 'Each option-underlying sleeve falls 20%.', underlyingMove: -0.20 },
  { id: 'underlying-down-30', name: 'Underlying −30%', description: 'Each option-underlying sleeve falls 30%.', underlyingMove: -0.30 },
  { id: 'underlying-up-10', name: 'Underlying +10%', description: 'Each option-underlying sleeve rises 10%.', underlyingMove: 0.10 },
  { id: 'iv-up', name: 'IV +10 pts', description: 'No spot move; implied volatility rises by 10 percentage points.', ivShift: 0.10 },
  { id: 'time-decay', name: '30-day time decay', description: 'No spot move; 30 calendar days pass.', daysElapsed: 30 },
  { id: 'combined-downside', name: 'Combined downside', description: 'All equity sleeves fall 20%, IV rises 10 points, and 30 days pass.', equityMove: -0.20, ivShift: 0.10, daysElapsed: 30 },
]

function sumGreeks(items: OptionGreeks[]): OptionGreeks {
  return items.reduce((total, item) => ({
    delta: total.delta + item.delta,
    gamma: total.gamma + item.gamma,
    vega: total.vega + item.vega,
    theta: total.theta + item.theta,
    rho: total.rho + item.rho,
  }), { ...zeroGreeks })
}

export function optionSign(position: OptionPosition): number {
  return position.side === 'long' ? 1 : -1
}

export function getLatestSpots(prices: Record<string, readonly number[]>): Record<string, number> {
  return Object.fromEntries(Object.entries(prices).map(([ticker, series]) => [ticker, series[series.length - 1]]))
}

export function analyzeOptionPosition(position: OptionPosition, spots: Record<string, number>): OptionPositionAnalysis | null {
  const spot = spots[position.underlying]
  if (!Number.isFinite(spot) || spot <= 0) return null
  const input = { spot, strike: position.strike, maturity: Math.max(position.maturity, 0), volatility: Math.max(position.volatility, 0.01), riskFreeRate: position.riskFreeRate, dividendYield: position.dividendYield, optionType: position.optionType }
  const value = priceAndGreeks(input)
  const entryPremium = position.premiumOverride ?? value.price
  const scale = optionSign(position) * Math.max(0, position.contracts) * Math.max(1, position.multiplier)
  return {
    position,
    spot,
    theoreticalPremium: value.price,
    entryPremium,
    greeks: value,
    aggregateGreeks: {
      delta: value.delta * scale,
      gamma: value.gamma * scale,
      vega: value.vega * scale,
      theta: value.theta * scale,
      rho: value.rho * scale,
    },
    marketValue: value.price * scale,
  }
}

function normalizedWeights(weights: Record<string, number>): Record<string, number> {
  const total = Object.values(weights).reduce((sum, value) => sum + Math.max(0, value), 0)
  return Object.fromEntries(Object.entries(weights).map(([ticker, value]) => [ticker, total > 0 ? Math.max(0, value) / total : 0]))
}

function assetPnl(assets: Asset[], weights: Record<string, number>, portfolioValue: number, optionUnderlyings: string[], scenario: HedgeScenario): number {
  const normalized = normalizedWeights(weights)
  return assets.reduce((total, asset) => {
    if (asset.ticker === 'CASH') return total
    const shock = scenario.equityMove !== undefined && asset.assetClass === 'Equity'
      ? scenario.equityMove
      : optionUnderlyings.includes(asset.ticker) ? scenario.underlyingMove ?? 0 : 0
    return total + portfolioValue * (normalized[asset.ticker] ?? 0) * shock
  }, 0)
}

function optionScenarioPnl(analysis: OptionPositionAnalysis, scenario: HedgeScenario): number {
  const { position, spot, entryPremium } = analysis
  const spotMove = scenario.equityMove !== undefined || position.underlying === analysis.position.underlying
    ? (scenario.equityMove !== undefined ? scenario.equityMove : scenario.underlyingMove ?? 0)
    : 0
  const repriced = blackScholes({
    spot: spot * (1 + spotMove),
    strike: position.strike,
    maturity: Math.max(0, position.maturity - (scenario.daysElapsed ?? 0) / 365),
    volatility: Math.max(0.01, position.volatility + (scenario.ivShift ?? 0)),
    riskFreeRate: position.riskFreeRate,
    dividendYield: position.dividendYield,
    optionType: position.optionType,
  })
  return optionSign(position) * position.contracts * position.multiplier * (repriced - entryPremium)
}

function buildPayoff(primary: OptionPositionAnalysis | undefined, assets: Asset[], weights: Record<string, number>, portfolioValue: number): PayoffPoint[] {
  if (!primary) return []
  const normalized = normalizedWeights(weights)
  const sleeveValue = portfolioValue * (normalized[primary.position.underlying] ?? 0)
  const points: PayoffPoint[] = []
  for (let index = -40; index <= 30; index += 5) {
    const change = index / 100
    const endingPrice = primary.spot * (1 + change)
    const withoutHedge = sleeveValue * change
    const optionPrice = blackScholes({
      spot: endingPrice,
      strike: primary.position.strike,
      maturity: primary.position.maturity,
      volatility: Math.max(0.01, primary.position.volatility),
      riskFreeRate: primary.position.riskFreeRate,
      dividendYield: primary.position.dividendYield,
      optionType: primary.position.optionType,
    })
    const putPnl = optionSign(primary.position) * primary.position.contracts * primary.position.multiplier * (optionPrice - primary.entryPremium)
    points.push({ endingPrice, change, withoutHedge, putPnl, withHedge: withoutHedge + putPnl })
  }
  return points
}

export function calculateHedgeAnalytics(args: {
  assets: Asset[]
  weights: Record<string, number>
  positions: OptionPosition[]
  spots: Record<string, number>
  portfolioValue: number
}): HedgeAnalytics {
  const positions = args.positions.map((position) => analyzeOptionPosition(position, args.spots)).filter((position): position is OptionPositionAnalysis => position !== null)
  const normalized = normalizedWeights(args.weights)
  const assetDelta = args.assets.reduce((total, asset) => {
    const spot = args.spots[asset.ticker]
    if (asset.ticker === 'CASH' || !spot) return total
    return total + args.portfolioValue * (normalized[asset.ticker] ?? 0) / spot
  }, 0)
  const netGreeks = sumGreeks(positions.map((position) => position.aggregateGreeks))
  const netPremiumCost = positions.reduce((total, position) => total + optionSign(position.position) * position.entryPremium * position.position.contracts * position.position.multiplier, 0)
  const primary = positions[0]
  const optionUnderlyings = [...new Set(positions.map((position) => position.position.underlying))]
  const scenarios = hedgeScenarios.map((scenario) => {
    const withoutHedge = assetPnl(args.assets, args.weights, args.portfolioValue, optionUnderlyings, scenario)
    const optionPnl = positions.reduce((total, position) => total + optionScenarioPnl(position, scenario), 0)
    return { ...scenario, withoutHedge, optionPnl, withHedge: withoutHedge + optionPnl, downsideBuffer: optionPnl }
  })
  const combined = scenarios.find((scenario) => scenario.id === 'combined-downside') ?? null
  return {
    positions,
    assetDelta,
    netGreeks: { ...netGreeks, delta: netGreeks.delta + assetDelta },
    netPremiumCost,
    scenarios,
    payoff: buildPayoff(primary, args.assets, args.weights, args.portfolioValue),
    primarySpot: primary?.spot ?? null,
    primaryStrike: primary?.position.strike ?? null,
    primaryUnderlying: primary?.position.underlying ?? null,
    worstCombinedScenario: combined,
  }
}
