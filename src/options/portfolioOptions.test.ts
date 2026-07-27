import { describe, expect, it } from 'vitest'
import { assets, presets } from '../data'
import { marketPrices } from '../data/marketPrices'
import { analyzeOptionPosition, calculateHedgeAnalytics, getLatestSpots } from './portfolioOptions'
import { createDefaultSpyPut, type OptionPosition } from './types'

const spots = getLatestSpots(marketPrices.prices)
const basePut = createDefaultSpyPut(spots.SPY)

describe('portfolio option overlay', () => {
  it('makes a long put gain value as the underlying falls', () => {
    const analysis = analyzeOptionPosition(basePut, spots)!
    const down = calculateHedgeAnalytics({ assets, weights: { SPY: 100 }, positions: [basePut], spots, portfolioValue: 100000 })
    expect(analysis.aggregateGreeks.delta).toBeLessThan(0)
    expect(down.scenarios.find((scenario) => scenario.id === 'underlying-down-20')!.optionPnl).toBeGreaterThan(0)
  })

  it('inverts P&L and Greeks for a short put', () => {
    const shortPut: OptionPosition = { ...basePut, side: 'short' }
    const longAnalysis = analyzeOptionPosition(basePut, spots)!
    const shortAnalysis = analyzeOptionPosition(shortPut, spots)!
    expect(shortAnalysis.aggregateGreeks.delta).toBeCloseTo(-longAnalysis.aggregateGreeks.delta, 8)
    expect(shortAnalysis.aggregateGreeks.gamma).toBeCloseTo(-longAnalysis.aggregateGreeks.gamma, 8)
    const scenario = calculateHedgeAnalytics({ assets, weights: { SPY: 100 }, positions: [shortPut], spots, portfolioValue: 100000 }).scenarios.find((item) => item.id === 'underlying-down-20')!
    expect(scenario.optionPnl).toBeLessThan(0)
  })

  it('applies contracts and multiplier to aggregated Greeks', () => {
    const one = analyzeOptionPosition(basePut, spots)!
    const scaled = analyzeOptionPosition({ ...basePut, contracts: 3, multiplier: 50 }, spots)!
    expect(scaled.aggregateGreeks.delta).toBeCloseTo(one.greeks.delta * 150, 8)
    expect(scaled.aggregateGreeks.vega).toBeCloseTo(one.greeks.vega * 150, 8)
  })

  it('improves a long-put -20% loss and creates an upside premium drag', () => {
    const hedge = calculateHedgeAnalytics({ assets, weights: presets[0].weights, positions: [basePut], spots, portfolioValue: 100000 })
    const down = hedge.scenarios.find((scenario) => scenario.id === 'underlying-down-20')!
    const up = hedge.scenarios.find((scenario) => scenario.id === 'underlying-up-10')!
    expect(down.withHedge).toBeGreaterThan(down.withoutHedge)
    expect(up.optionPnl).toBeLessThan(0)
  })

  it('keeps empty overlays finite and produces a stable no-hedge state', () => {
    const empty = calculateHedgeAnalytics({ assets, weights: presets[0].weights, positions: [], spots, portfolioValue: 100000 })
    expect(empty.positions).toHaveLength(0)
    expect(empty.payoff).toHaveLength(0)
    expect(Object.values(empty.netGreeks).every(Number.isFinite)).toBe(true)
    expect(empty.scenarios.every((scenario) => [scenario.withoutHedge, scenario.optionPnl, scenario.withHedge].every(Number.isFinite))).toBe(true)
  })
})
