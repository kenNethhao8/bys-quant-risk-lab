export type AssetClass = 'Equity' | 'Bond' | 'Commodity' | 'Cash'

export type Asset = {
  ticker: string
  name: string
  assetClass: AssetClass
  color: string
}

export type PortfolioPreset = {
  id: string
  name: string
  description: string
  weights: Record<string, number>
}

export const assets: Asset[] = [
  { ticker: 'AAPL', name: 'Apple Inc.', assetClass: 'Equity', color: '#9b7750' },
  { ticker: 'MSFT', name: 'Microsoft Corp.', assetClass: 'Equity', color: '#b78a3e' },
  { ticker: 'NVDA', name: 'NVIDIA Corp.', assetClass: 'Equity', color: '#caa664' },
  { ticker: 'SPY', name: 'S&P 500 ETF', assetClass: 'Equity', color: '#6e8a79' },
  { ticker: 'QQQ', name: 'Nasdaq 100 ETF', assetClass: 'Equity', color: '#8da394' },
  { ticker: 'TLT', name: '20+ Year Treasury ETF', assetClass: 'Bond', color: '#8293a4' },
  { ticker: 'GLD', name: 'Gold Trust', assetClass: 'Commodity', color: '#d7be8b' },
  { ticker: 'CASH', name: 'US Treasury Bills', assetClass: 'Cash', color: '#b8afa1' },
]

export const presets: PortfolioPreset[] = [
  {
    id: 'growth',
    name: 'Growth Portfolio',
    description: 'Concentrated technology and index exposure.',
    weights: { AAPL: 18, MSFT: 16, NVDA: 14, QQQ: 24, SPY: 18, GLD: 5, CASH: 5 },
  },
  {
    id: 'balanced',
    name: 'Balanced Portfolio',
    description: 'Diversified across equities, bonds, and real assets.',
    weights: { AAPL: 8, MSFT: 8, SPY: 28, QQQ: 12, TLT: 24, GLD: 12, CASH: 8 },
  },
  {
    id: 'defensive',
    name: 'Defensive Portfolio',
    description: 'Capital preservation with measured equity exposure.',
    weights: { SPY: 14, QQQ: 6, TLT: 36, GLD: 22, CASH: 22 },
  },
]

export const scenarios = [
  {
    id: 'tech',
    name: 'Technology Sell-off',
    subtitle: 'Growth equities repriced sharply',
    shocks: { AAPL: -0.25, MSFT: -0.25, NVDA: -0.25, QQQ: -0.22, SPY: -0.1, TLT: 0.02, GLD: 0.03, CASH: 0 },
    note: 'Technology and growth assets reprice while diversifiers cushion part of the drawdown.',
  },
  {
    id: 'market',
    name: 'Broad Market Correction',
    subtitle: 'Equities decline across sectors',
    shocks: { AAPL: -0.18, MSFT: -0.17, NVDA: -0.23, QQQ: -0.18, SPY: -0.15, TLT: 0.04, GLD: 0.02, CASH: 0 },
    note: 'Equity correlation rises in a broad risk-off event; Treasuries provide partial ballast.',
  },
  {
    id: 'rates',
    name: 'Rate Shock',
    subtitle: 'Long yields move higher by 100 bps',
    shocks: { AAPL: -0.1, MSFT: -0.12, NVDA: -0.17, QQQ: -0.14, SPY: -0.08, TLT: -0.1, GLD: -0.01, CASH: 0 },
    note: 'Long-duration equities and bonds both face pressure as discount rates rise.',
  },
  {
    id: 'inflation',
    name: 'Inflation Surprise',
    subtitle: 'Stocks and bonds under pressure',
    shocks: { AAPL: -0.1, MSFT: -0.1, NVDA: -0.13, QQQ: -0.11, SPY: -0.1, TLT: -0.12, GLD: 0.08, CASH: 0 },
    note: 'An inflation surprise hurts stocks and bonds simultaneously while gold is relatively defensive.',
  },
  {
    id: 'volatility',
    name: 'Volatility Spike',
    subtitle: 'Tail dependence intensifies',
    shocks: { AAPL: -0.11, MSFT: -0.1, NVDA: -0.15, QQQ: -0.12, SPY: -0.09, TLT: 0.01, GLD: 0.02, CASH: 0 },
    note: 'This stylised shock represents higher correlation and volatility rather than a forecasted move.',
  },
]
