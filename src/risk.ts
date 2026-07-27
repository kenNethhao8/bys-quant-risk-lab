import type { Asset } from './data'
import { marketPrices } from './data/marketPrices'

const TRADING_DAYS = 252
export const RISK_FREE_RATE = 0.043
const CONFIDENCE_TAIL = 0.05
const STRESS_EQUITY_CORRELATION_TARGET = 0.9

export type PriceDataset = { dates: readonly string[]; prices: Readonly<Record<string, readonly number[]>> }
export type AlignedSeries = Record<string, { dates: string[]; prices: number[] }>

export type Analytics = {
  portfolioReturns: number[]
  analysisDates: string[]
  equityCurve: { index: number; value: number; benchmark: number; label: string }[]
  annualReturn: number
  annualVolatility: number
  sharpe: number
  maxDrawdown: number
  var95: number
  cvar95: number
  riskContributions: { ticker: string; value: number }[]
  correlations: { left: string; right: string; value: number }[]
  optimizerWeights: Record<string, number>
  riskScore: number
  volatilityStress: { initialShock: number; baseCvar: number; stressCvar: number; cvarChange: number; equityCorrelation: number; volatilityMultiplier: number }
}

const clamp = (value: number, lower: number, upper: number) => Math.max(lower, Math.min(upper, value))
const mean = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
const standardDeviation = (values: number[]) => {
  if (values.length < 2) return 0
  const average = mean(values)
  return Math.sqrt(values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1))
}
const covariance = (left: number[], right: number[]) => {
  const leftMean = mean(left)
  const rightMean = mean(right)
  return left.reduce((sum, value, index) => sum + (value - leftMean) * (right[index] - rightMean), 0) / Math.max(1, left.length - 1)
}
const correlation = (left: number[], right: number[]) => {
  const denominator = standardDeviation(left) * standardDeviation(right)
  return denominator ? clamp(covariance(left, right) / denominator, -1, 1) : 0
}
const normalize = (values: number[]) => {
  const deviation = standardDeviation(values)
  const average = mean(values)
  return deviation ? values.map((value) => (value - average) / deviation) : values.map(() => 0)
}

/** Aligns series to common dates and discards incomplete observations rather than forward-filling prices. */
export function alignPriceSeries(series: Record<string, { dates: readonly string[]; prices: readonly number[] }>): AlignedSeries {
  const maps = Object.entries(series).map(([ticker, item]) => [ticker, new Map(item.dates.map((date, index) => [date, item.prices[index]]))] as const)
  const dates = [...new Set(maps[0]?.[1].keys() ?? [])].filter((date) => maps.every(([, values]) => Number.isFinite(values.get(date)))).sort()
  return Object.fromEntries(maps.map(([ticker, values]) => [ticker, { dates, prices: dates.map((date) => values.get(date)!) }]))
}

export const returnsFromPrices = (prices: readonly number[]) => prices.slice(1).map((price, index) => price / prices[index] - 1)

export function calculateRiskStats(returns: number[]) {
  const sorted = [...returns].sort((a, b) => a - b)
  const cutoff = Math.max(1, Math.ceil(sorted.length * CONFIDENCE_TAIL))
  const tail = sorted.slice(0, cutoff)
  return { var95: -sorted[cutoff - 1], cvar95: -mean(tail) }
}

export function calculateMaxDrawdown(returns: number[]) {
  let value = 1
  let peak = 1
  let maxDrawdown = 0
  returns.forEach((dailyReturn) => {
    value *= 1 + dailyReturn
    peak = Math.max(peak, value)
    maxDrawdown = Math.min(maxDrawdown, value / peak - 1)
  })
  return maxDrawdown
}

const cashReturns = (length: number) => Array.from({ length }, () => (1 + RISK_FREE_RATE) ** (1 / TRADING_DAYS) - 1)
const toCurve = (returns: number[], benchmark: number[], dates: string[]) => {
  let portfolio = 100
  let benchmarkValue = 100
  return returns.map((dailyReturn, index) => {
    portfolio *= 1 + dailyReturn
    benchmarkValue *= 1 + (benchmark[index] ?? 0)
    return { index, value: portfolio, benchmark: benchmarkValue, label: new Date(`${dates[index]}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }) }
  })
}
const covarianceMatrix = (returns: number[][]) => returns.map((left) => returns.map((right) => covariance(left, right)))

function getSelectedAssets(assets: Asset[], weights: Record<string, number>) {
  const selected = assets.filter((asset) => (weights[asset.ticker] ?? 0) > 0)
  return selected.length ? selected : assets.filter((asset) => asset.ticker === 'CASH')
}

function buildReturns(assets: Asset[], weights: Record<string, number>, dataset: PriceDataset) {
  const selected = getSelectedAssets(assets, weights)
  const sourceSeries = Object.fromEntries(selected.filter((asset) => asset.ticker !== 'CASH').map((asset) => [asset.ticker, { dates: dataset.dates, prices: dataset.prices[asset.ticker] }]))
  const aligned = Object.keys(sourceSeries).length ? alignPriceSeries(sourceSeries) : {}
  const dates = Object.values(aligned)[0]?.dates ?? [...dataset.dates]
  if (dates.length < 2) throw new Error('At least two aligned market observations are required.')
  const byAsset = Object.fromEntries(selected.map((asset) => [asset.ticker, asset.ticker === 'CASH' ? cashReturns(dates.length - 1) : returnsFromPrices(aligned[asset.ticker].prices)])) as Record<string, number[]>
  const total = selected.reduce((sum, asset) => sum + Math.max(0, weights[asset.ticker] ?? 0), 0)
  const normalizedWeights = Object.fromEntries(selected.map((asset) => [asset.ticker, total ? Math.max(0, weights[asset.ticker] ?? 0) / total : 1 / selected.length])) as Record<string, number>
  return { selected, dates: dates.slice(1), returnsByAsset: byAsset, normalizedWeights }
}

function calculateVolatilityStress(selected: Asset[], weights: Record<string, number>, returnsByAsset: Record<string, number[]>, baseCvar: number) {
  const equityAssets = selected.filter((asset) => asset.assetClass === 'Equity')
  const length = Object.values(returnsByAsset)[0].length
  const zScores = Object.fromEntries(selected.map((asset) => [asset.ticker, normalize(returnsByAsset[asset.ticker])])) as Record<string, number[]>
  const commonEquityFactor = equityAssets.length ? normalize(Array.from({ length }, (_, index) => mean(equityAssets.map((asset) => zScores[asset.ticker][index])))) : Array.from({ length }, () => 0)
  const volatilityMultiplier = 1.6
  const stressedByAsset = Object.fromEntries(selected.map((asset) => {
    const base = returnsByAsset[asset.ticker]
    if (asset.assetClass === 'Cash') return [asset.ticker, base]
    const baseVolatility = standardDeviation(base)
    const assetMean = mean(base)
    const multiplier = asset.assetClass === 'Equity' ? volatilityMultiplier : asset.assetClass === 'Bond' ? 1.15 : 1.08
    if (asset.assetClass !== 'Equity') return [asset.ticker, base.map((value) => assetMean + (value - assetMean) * multiplier)]
    const residual = normalize(zScores[asset.ticker].map((value, index) => value - commonEquityFactor[index]))
    const stressedZ = commonEquityFactor.map((factor, index) => Math.sqrt(STRESS_EQUITY_CORRELATION_TARGET) * factor + Math.sqrt(1 - STRESS_EQUITY_CORRELATION_TARGET) * residual[index])
    return [asset.ticker, stressedZ.map((value) => assetMean + value * baseVolatility * multiplier)]
  })) as Record<string, number[]>
  const stressReturns = Array.from({ length }, (_, index) => selected.reduce((sum, asset) => sum + weights[asset.ticker] * stressedByAsset[asset.ticker][index], 0))
  const stressCvar = calculateRiskStats(stressReturns).cvar95
  const equityPairs = equityAssets.flatMap((asset, index) => equityAssets.slice(index + 1).map((other) => correlation(stressedByAsset[asset.ticker], stressedByAsset[other.ticker])))
  const equityCorrelation = equityPairs.length ? mean(equityPairs) : 1
  const initialShocks: Record<string, number> = { AAPL: -0.1, MSFT: -0.1, NVDA: -0.14, SPY: -0.08, QQQ: -0.1, TLT: 0.01, GLD: 0.02, CASH: 0 }
  const initialShock = selected.reduce((sum, asset) => sum + weights[asset.ticker] * (initialShocks[asset.ticker] ?? 0), 0)
  return { initialShock, baseCvar, stressCvar, cvarChange: stressCvar - baseCvar, equityCorrelation, volatilityMultiplier }
}

export function calculateAnalytics(assets: Asset[], weights: Record<string, number>, dataset: PriceDataset = marketPrices): Analytics {
  const { selected, dates, returnsByAsset, normalizedWeights } = buildReturns(assets, weights, dataset)
  const portfolioReturns = Array.from({ length: dates.length }, (_, index) => selected.reduce((sum, asset) => sum + normalizedWeights[asset.ticker] * returnsByAsset[asset.ticker][index], 0))
  const benchmarkReturns = returnsFromPrices(dataset.prices.SPY.slice(-dates.length - 1))
  const annualReturn = (portfolioReturns.reduce((value, dailyReturn) => value * (1 + dailyReturn), 1)) ** (TRADING_DAYS / portfolioReturns.length) - 1
  const annualVolatility = standardDeviation(portfolioReturns) * Math.sqrt(TRADING_DAYS)
  const { var95, cvar95 } = calculateRiskStats(portfolioReturns)
  const matrix = covarianceMatrix(selected.map((asset) => returnsByAsset[asset.ticker]))
  const weightVector = selected.map((asset) => normalizedWeights[asset.ticker])
  const marginal = matrix.map((row) => row.reduce((sum, value, index) => sum + value * weightVector[index], 0))
  const portfolioVariance = weightVector.reduce((sum, weight, index) => sum + weight * marginal[index], 0)
  const riskContributions = selected.map((asset, index) => ({ ticker: asset.ticker, value: portfolioVariance ? (weightVector[index] * marginal[index]) / portfolioVariance : 0 }))
  const assetVolatilities = selected.map((asset) => standardDeviation(returnsByAsset[asset.ticker]) * Math.sqrt(TRADING_DAYS))
  const inverseRisk = selected.map((asset, index) => 1 / Math.max(assetVolatilities[index], asset.assetClass === 'Cash' ? 0.06 : 0.03))
  const inverseRiskTotal = inverseRisk.reduce((sum, value) => sum + value, 0)
  const rawOptimizerWeights = inverseRisk.map((value) => value / inverseRiskTotal)
  const cashIndex = selected.findIndex((asset) => asset.ticker === 'CASH')
  const cappedCashWeight = cashIndex >= 0 ? Math.min(rawOptimizerWeights[cashIndex], 0.25) : 0
  const nonCashTotal = rawOptimizerWeights.reduce((sum, weight, index) => sum + (index === cashIndex ? 0 : weight), 0)
  const optimizerWeights = Object.fromEntries(selected.map((asset, index) => [asset.ticker, (index === cashIndex ? cappedCashWeight : nonCashTotal ? rawOptimizerWeights[index] / nonCashTotal * (1 - cappedCashWeight) : 0) * 100]))
  const correlations = selected.flatMap((left) => selected.map((right) => ({ left: left.ticker, right: right.ticker, value: correlation(returnsByAsset[left.ticker], returnsByAsset[right.ticker]) })))
  const volatilityStress = calculateVolatilityStress(selected, normalizedWeights, returnsByAsset, cvar95)
  const riskScore = Math.round(clamp(annualVolatility * 260 + cvar95 * 1300 + Math.max(...riskContributions.map((item) => item.value), 0) * 20, 0, 100))
  return {
    portfolioReturns,
    analysisDates: dates,
    equityCurve: toCurve(portfolioReturns, benchmarkReturns, dates),
    annualReturn,
    annualVolatility,
    sharpe: annualVolatility ? (annualReturn - RISK_FREE_RATE) / annualVolatility : 0,
    maxDrawdown: calculateMaxDrawdown(portfolioReturns),
    var95,
    cvar95,
    riskContributions,
    correlations,
    optimizerWeights,
    riskScore,
    volatilityStress,
  }
}

export const formatPercent = (value: number, digits = 1) => `${(value * 100).toFixed(digits)}%`
export const formatMoney = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
