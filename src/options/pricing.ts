/*
 * Implementation adapted from the user-owned local OptionLab TypeScript pricing logic; used here for educational portfolio-level analysis.
 */
import type { OptionGreeks, OptionType, OptionValue } from './types'

export interface BlackScholesInput {
  spot: number
  strike: number
  maturity: number
  volatility: number
  riskFreeRate: number
  dividendYield?: number
  optionType: OptionType
}

const MIN_VOLATILITY = 1e-8
const MIN_MATURITY = 1e-8

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

export function normalCdf(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const polynomial = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const approximation = 1 - normalPdf(x) * polynomial
  return x >= 0 ? approximation : 1 - approximation
}

export function intrinsicValue(spot: number, strike: number, optionType: OptionType): number {
  return optionType === 'call' ? Math.max(spot - strike, 0) : Math.max(strike - spot, 0)
}

function deterministicValue({ spot, strike, maturity, riskFreeRate, dividendYield = 0, optionType }: BlackScholesInput): number {
  const forwardSpot = spot * Math.exp((riskFreeRate - dividendYield) * Math.max(maturity, 0))
  const payoff = intrinsicValue(forwardSpot, strike, optionType)
  return Math.exp(-riskFreeRate * Math.max(maturity, 0)) * payoff
}

function dValues(input: BlackScholesInput) {
  const { spot, strike, maturity, volatility, riskFreeRate, dividendYield = 0 } = input
  const rootT = Math.sqrt(maturity)
  const denominator = volatility * rootT
  const d1 = (Math.log(spot / strike) + (riskFreeRate - dividendYield + 0.5 * volatility * volatility) * maturity) / denominator
  return { d1, d2: d1 - denominator, rootT }
}

export function blackScholes(input: BlackScholesInput): number {
  const { spot, strike, maturity, volatility, riskFreeRate, dividendYield = 0, optionType } = input
  if (![spot, strike, maturity, volatility, riskFreeRate, dividendYield].every(Number.isFinite) || spot <= 0 || strike <= 0) return 0
  if (maturity <= MIN_MATURITY) return intrinsicValue(spot, strike, optionType)
  if (volatility <= MIN_VOLATILITY) return deterministicValue(input)

  const { d1, d2 } = dValues(input)
  const discountedSpot = spot * Math.exp(-dividendYield * maturity)
  const discountedStrike = strike * Math.exp(-riskFreeRate * maturity)
  if (optionType === 'call') return discountedSpot * normalCdf(d1) - discountedStrike * normalCdf(d2)
  return discountedStrike * normalCdf(-d2) - discountedSpot * normalCdf(-d1)
}

export function calculateGreeks(input: BlackScholesInput): OptionGreeks {
  const { spot, strike, maturity, volatility, riskFreeRate, dividendYield = 0, optionType } = input
  if (![spot, strike, maturity, volatility, riskFreeRate, dividendYield].every(Number.isFinite) || spot <= 0 || strike <= 0 || maturity <= MIN_MATURITY || volatility <= MIN_VOLATILITY) {
    return { delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 }
  }
  const { d1, d2, rootT } = dValues(input)
  const qDiscount = Math.exp(-dividendYield * maturity)
  const rDiscount = Math.exp(-riskFreeRate * maturity)
  const pdf = normalPdf(d1)
  const gamma = qDiscount * pdf / (spot * volatility * rootT)
  const vega = spot * qDiscount * pdf * rootT / 100
  const commonTheta = -(spot * qDiscount * pdf * volatility) / (2 * rootT)
  const delta = optionType === 'call' ? qDiscount * normalCdf(d1) : qDiscount * (normalCdf(d1) - 1)
  const thetaYearly = optionType === 'call'
    ? commonTheta - riskFreeRate * strike * rDiscount * normalCdf(d2) + dividendYield * spot * qDiscount * normalCdf(d1)
    : commonTheta + riskFreeRate * strike * rDiscount * normalCdf(-d2) - dividendYield * spot * qDiscount * normalCdf(-d1)
  const rho = optionType === 'call'
    ? strike * maturity * rDiscount * normalCdf(d2) / 100
    : -strike * maturity * rDiscount * normalCdf(-d2) / 100
  return { delta, gamma, vega, theta: thetaYearly / 365, rho }
}

export function priceAndGreeks(input: BlackScholesInput): OptionValue {
  return { price: blackScholes(input), ...calculateGreeks(input) }
}
