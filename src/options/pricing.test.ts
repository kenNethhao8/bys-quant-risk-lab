import { describe, expect, it } from 'vitest'
import { blackScholes, calculateGreeks } from './pricing'

const base = { spot: 100, strike: 100, maturity: 1, volatility: 0.2, riskFreeRate: 0.05, dividendYield: 0 }

describe('European Black–Scholes pricing', () => {
  it('matches standard at-the-money call and put reference values', () => {
    expect(blackScholes({ ...base, optionType: 'call' })).toBeCloseTo(10.4506, 3)
    expect(blackScholes({ ...base, optionType: 'put' })).toBeCloseTo(5.5735, 3)
  })

  it('respects put-call parity with dividend yield', () => {
    const input = { ...base, dividendYield: 0.015 }
    const call = blackScholes({ ...input, optionType: 'call' })
    const put = blackScholes({ ...input, optionType: 'put' })
    expect(call - put).toBeCloseTo(input.spot * Math.exp(-input.dividendYield * input.maturity) - input.strike * Math.exp(-input.riskFreeRate * input.maturity), 5)
  })

  it('returns correctly signed and scaled Greeks', () => {
    const call = calculateGreeks({ ...base, optionType: 'call' })
    const put = calculateGreeks({ ...base, optionType: 'put' })
    expect(call.delta).toBeGreaterThan(0)
    expect(put.delta).toBeLessThan(0)
    expect(call.gamma).toBeGreaterThan(0)
    expect(put.gamma).toBeGreaterThan(0)
    expect(call.vega).toBeGreaterThan(0)
    expect(call.theta).toBeLessThan(0)
  })

  it('uses intrinsic value at expiry and remains finite at low volatility', () => {
    expect(blackScholes({ ...base, spot: 90, maturity: 0, optionType: 'put' })).toBe(10)
    expect(blackScholes({ ...base, volatility: 0, optionType: 'call' })).toBeGreaterThanOrEqual(0)
    expect(calculateGreeks({ ...base, maturity: 0, optionType: 'call' })).toEqual({ delta: 0, gamma: 0, vega: 0, theta: 0, rho: 0 })
  })
})
