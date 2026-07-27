import { describe, expect, it } from 'vitest'
import { assets, presets, scenarios } from './data'
import { marketPrices } from './data/marketPrices'
import {
  alignPriceSeries, calculateAnalytics, calculateMaxDrawdown, calculateRiskStats, returnsFromPrices,
} from './risk'

describe('historical risk calculations', () => {
  it('converts prices into simple daily returns', () => {
    const returns = returnsFromPrices([100, 110, 99])
    expect(returns[0]).toBeCloseTo(0.1, 12)
    expect(returns[1]).toBeCloseTo(-0.1, 12)
  })

  it('uses the left tail for historical VaR and CVaR', () => {
    const returns = [-0.12, ...Array.from({ length: 19 }, () => 0.01)]
    expect(calculateRiskStats(returns)).toEqual({ var95: 0.12, cvar95: 0.12 })
  })

  it('calculates peak-to-trough drawdown', () => {
    expect(calculateMaxDrawdown([0.1, -0.2, 0.05])).toBeCloseTo(-0.2, 10)
  })

  it('aligns series by date and drops incomplete observations', () => {
    const aligned = alignPriceSeries({
      A: { dates: ['2026-01-01', '2026-01-02', '2026-01-03'], prices: [10, 11, 12] },
      B: { dates: ['2026-01-01', '2026-01-03'], prices: [20, 22] },
    })
    expect(aligned.A.dates).toEqual(['2026-01-01', '2026-01-03'])
    expect(aligned.A.prices).toEqual([10, 12])
  })

  it('normalizes selected weights and sums component risk to approximately 100%', () => {
    const analytics = calculateAnalytics(assets, { AAPL: 60, MSFT: 40 }, marketPrices)
    expect(analytics.riskContributions.reduce((sum, item) => sum + item.value, 0)).toBeCloseTo(1, 8)
    expect(Object.values(analytics.optimizerWeights).reduce((sum, weight) => sum + weight, 0)).toBeCloseTo(100, 8)
    expect(analytics.equityCurve[analytics.equityCurve.length - 1]?.benchmark).toBeGreaterThan(0)
  })

  it('increases CVaR when equity volatility and correlation are stressed', () => {
    const analytics = calculateAnalytics(assets, presets[0].weights, marketPrices)
    expect(analytics.volatilityStress.stressCvar).toBeGreaterThanOrEqual(analytics.volatilityStress.baseCvar)
    expect(analytics.volatilityStress.equityCorrelation).toBeGreaterThanOrEqual(0.8)
  })

  it('keeps custom weights and every stress scenario finite', () => {
    const customWeights: Record<string, number> = { SPY: 37, TLT: 31, GLD: 19, CASH: 13 }
    const analytics = calculateAnalytics(assets, customWeights, marketPrices)
    expect(Object.values(analytics).flatMap((value) => typeof value === 'number' ? [value] : []).every(Number.isFinite)).toBe(true)
    expect(analytics.optimizerWeights.CASH).toBeLessThanOrEqual(25)
    const total = 100
    scenarios.forEach((scenario) => {
      const impact = assets.reduce((sum, asset) => sum + ((customWeights[asset.ticker] ?? 0) / total) * (scenario.shocks[asset.ticker as keyof typeof scenario.shocks] ?? 0), 0)
      expect(Number.isFinite(impact)).toBe(true)
    })
  })
})
