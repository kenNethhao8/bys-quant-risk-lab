import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AlertTriangle, BarChart3, BookOpen, ChevronRight, CircleHelp, Gauge, LayoutDashboard,
  Printer, ShieldCheck, Sparkles, Target, TrendingDown, Wallet,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { assets, presets, scenarios } from './data'
import { HedgingSection } from './components/HedgingSection'
import { marketPrices } from './data/marketPrices'
import { marketMetadata } from './data/marketMetadata'
import { calculateHedgeAnalytics, getLatestSpots } from './options/portfolioOptions'
import { createDefaultSpyPut, type OptionPosition } from './options/types'
import { calculateAnalytics, formatMoney, formatPercent } from './risk'

const STARTING_VALUE = 100000
const navigation = [
  ['Overview', 'overview', LayoutDashboard], ['Portfolio', 'portfolio', Wallet], ['Risk Analytics', 'analytics', BarChart3],
  ['Stress Tests', 'stress', AlertTriangle], ['Hedging & Greeks', 'hedging', ShieldCheck], ['Optimizer', 'optimizer', Target], ['Methodology', 'methodology', BookOpen],
] as const

const clampWeight = (value: string) => Math.max(0, Math.min(100, Number(value) || 0))
const riskTone = (score: number) => score > 60 ? 'elevated' : score > 35 ? 'moderate' : 'low'

function App() {
  const [presetId, setPresetId] = useState('growth')
  const [weights, setWeights] = useState<Record<string, number>>(presets[0].weights)
  const [selectedScenario, setSelectedScenario] = useState('tech')
  const [range, setRange] = useState<'1Y' | '3Y' | 'All'>('3Y')
  const [optionPositions, setOptionPositions] = useState<OptionPosition[]>(() => [createDefaultSpyPut(getLatestSpots(marketPrices.prices).SPY)])

  const analytics = useMemo(() => calculateAnalytics(assets, weights), [weights])
  const selectedAssets = assets.filter((asset) => (weights[asset.ticker] ?? 0) > 0)
  const matrixStyle = { gridTemplateColumns: `42px repeat(${selectedAssets.length}, minmax(37px, 1fr))` } as CSSProperties
  const totalWeight = selectedAssets.reduce((sum, asset) => sum + (weights[asset.ticker] ?? 0), 0)
  const allocation = selectedAssets.map((asset) => ({ name: asset.ticker, value: weights[asset.ticker], color: asset.color }))
  const selectedScenarioData = scenarios.find((scenario) => scenario.id === selectedScenario) ?? scenarios[0]
  const scenarioLoss = selectedAssets.reduce((sum, asset) => sum + (weights[asset.ticker] / (totalWeight || 1)) * selectedScenarioData.shocks[asset.ticker as keyof typeof selectedScenarioData.shocks], 0)
  const scenarioResults = scenarios.map((scenario) => ({ scenario, loss: selectedAssets.reduce((sum, asset) => sum + (weights[asset.ticker] / (totalWeight || 1)) * scenario.shocks[asset.ticker as keyof typeof scenario.shocks], 0) }))
  const worstScenario = scenarioResults.reduce((worst, item) => item.loss < worst.loss ? item : worst, scenarioResults[0])
  const largestShock = selectedAssets.reduce((largest, asset) => (
    Math.abs(selectedScenarioData.shocks[asset.ticker as keyof typeof selectedScenarioData.shocks]) > Math.abs(selectedScenarioData.shocks[largest.ticker as keyof typeof selectedScenarioData.shocks]) ? asset : largest
  ), selectedAssets[0] ?? assets[0])
  const riskContributionData = analytics.riskContributions
    .map((entry) => ({ ...entry, value: Math.max(0, entry.value * 100), color: assets.find((asset) => asset.ticker === entry.ticker)?.color ?? '#b78a3e' }))
    .sort((a, b) => b.value - a.value)
  const displayCurve = range === '1Y' ? analytics.equityCurve.slice(-252) : analytics.equityCurve
  const selectedPreset = presets.find((preset) => preset.id === presetId)
  const portfolioName = selectedPreset?.name ?? 'Custom Portfolio'
  const technologyWeight = selectedAssets.filter((asset) => ['AAPL', 'MSFT', 'NVDA', 'QQQ'].includes(asset.ticker)).reduce((sum, asset) => sum + weights[asset.ticker], 0) / (totalWeight || 1)
  const technologyRisk = analytics.riskContributions.filter((entry) => ['AAPL', 'MSFT', 'NVDA', 'QQQ'].includes(entry.ticker)).reduce((sum, entry) => sum + entry.value, 0)
  const currentMetrics = {
    return: analytics.annualReturn,
    volatility: analytics.annualVolatility,
    sharpe: analytics.sharpe,
    cvar: analytics.cvar95,
  }
  const optimizedAnalytics = useMemo(() => calculateAnalytics(assets, analytics.optimizerWeights), [analytics.optimizerWeights])
  const hedgeAnalytics = useMemo(() => calculateHedgeAnalytics({
    assets, weights, positions: optionPositions, spots: getLatestSpots(marketPrices.prices), portfolioValue: STARTING_VALUE,
  }), [weights, optionPositions])

  const selectPreset = (id: string) => {
    const preset = presets.find((item) => item.id === id)
    if (!preset) return
    setPresetId(id)
    setWeights(preset.weights)
  }
  const updateWeight = (ticker: string, value: string) => {
    setPresetId('custom')
    setWeights((current) => ({ ...current, [ticker]: clampWeight(value) }))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><ShieldCheck size={20} /></div><span>BY’s Quant Risk Lab</span></div>
        <div className="nav-label">Research workspace</div>
        <nav>{navigation.map(([label, target, Icon]) => <a href={`#${target}`} key={target}><Icon size={17} />{label}</a>)}</nav>
        <div className="sidebar-footer"><div className="demo-seal">DEMO</div><p>Educational portfolio analytics.<br />Not investment advice.</p></div>
      </aside>

      <main>
        <header id="overview" className="hero">
          <div><p className="eyebrow"><Sparkles size={14} /> Portfolio risk research</p><h1>See the risk beneath<br />your returns.</h1><p className="hero-copy">A teaching-focused workspace for understanding portfolio concentration, tail risk, and scenario resilience.</p></div>
          <div className="hero-controls"><span className="data-date">Frozen Close/Last data through {marketMetadata.endDate}</span><div className="hero-actions"><button className="brief-button" onClick={() => window.print()}><Printer size={14} /> Export Risk Brief</button><label className="select-label">Portfolio<select value={presetId} onChange={(event) => selectPreset(event.target.value)}><option value="custom">Custom Portfolio</option>{presets.map((preset) => <option value={preset.id} key={preset.id}>{preset.name}</option>)}</select></label></div></div>
        </header>

        <section className="metrics-grid" aria-label="Portfolio risk metrics">
          <Metric icon={<Wallet />} label="Portfolio Value" value={formatMoney(STARTING_VALUE)} sub={`${totalWeight.toFixed(0)}% allocated`} />
          <Metric icon={<TrendingDown />} label="Annualized Return" value={formatPercent(analytics.annualReturn)} sub="Based on frozen price history" positive={analytics.annualReturn >= 0} />
          <Metric icon={<Gauge />} label="Annualized Volatility" value={formatPercent(analytics.annualVolatility)} sub="Daily returns, annualized" />
          <Metric icon={<AlertTriangle />} label="95% CVaR" value={formatPercent(analytics.cvar95)} sub="Average loss beyond VaR" negative />
          <Metric icon={<ShieldCheck />} label="Risk Score" value={`${analytics.riskScore} / 100`} sub={`${riskTone(analytics.riskScore)} risk profile`} tone={riskTone(analytics.riskScore)} />
        </section>

        <section className="content-grid performance-section">
          <Panel className="span-7" title="Portfolio performance" kicker="Cumulative growth of $100" action={<div className="segmented">{(['1Y', '3Y', 'All'] as const).map((item) => <button className={range === item ? 'active' : ''} key={item} onClick={() => setRange(item)}>{item === 'All' ? 'Since inception' : item}</button>)}</div>}>
            <div className="chart-head"><div><strong>{formatMoney((displayCurve[displayCurve.length - 1]?.value ?? 100) * 1000)}</strong><span>historical ending value</span></div><span className="benchmark"><i /> SPY benchmark</span></div>
            <div className="line-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={displayCurve.filter((_, index) => index % 18 === 0)} margin={{ top: 8, left: -24, right: 8, bottom: 0 }}><defs><linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#b78a3e" stopOpacity={0.24} /><stop offset="100%" stopColor="#b78a3e" stopOpacity={0} /></linearGradient></defs><XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={35} /><YAxis hide domain={['dataMin - 3', 'dataMax + 3']} /><Tooltip formatter={(value) => [`${Number(value).toFixed(1)}`, 'Indexed value']} labelStyle={{ color: '#342a20' }} /><Area type="monotone" dataKey="benchmark" stroke="#6e8a79" strokeWidth={1.5} strokeDasharray="4 4" fill="none" /><Area type="monotone" dataKey="value" stroke="#b78a3e" strokeWidth={2.4} fill="url(#portfolioFill)" /></AreaChart></ResponsiveContainer></div>
          </Panel>
          <Panel className="span-5" title="Risk narrative" kicker="What matters most">
            <div className="narrative-icon"><CircleHelp size={20} /></div><h3>Concentration is doing the work.</h3><p>Technology holdings represent <b>{formatPercent(technologyWeight)}</b> of capital, but account for about <b>{formatPercent(technologyRisk)}</b> of modeled portfolio risk.</p><div className="narrative-divider" /><p className="fine-print">The largest historical tail loss is estimated at <b>{formatPercent(analytics.cvar95)}</b> on an average day beyond the 95% loss threshold.</p><a href="#analytics" className="text-link">Explore the diagnostics <ChevronRight size={15} /></a></Panel>
        </section>

        <section id="portfolio" className="content-grid">
          <Panel className="span-5" title="Portfolio allocation" kicker="Capital by holding">
            <div className="allocation-layout"><div className="donut"><ResponsiveContainer width="100%" height="100%"><RechartsPieChart><Pie data={allocation} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={2} stroke="none">{allocation.map((entry) => <Cell fill={entry.color} key={entry.name} />)}</Pie><Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Weight']} /></RechartsPieChart></ResponsiveContainer><div className="donut-center"><b>{totalWeight.toFixed(0)}%</b><span>allocated</span></div></div><div className="legend">{allocation.map((entry) => <div key={entry.name}><i style={{ background: entry.color }} /><span>{entry.name}</span><b>{entry.value.toFixed(0)}%</b></div>)}</div></div>
          </Panel>
          <Panel className="span-7" title="Adjust portfolio weights" kicker="Input is normalized in calculations" action={<span className="input-note">Total: {totalWeight.toFixed(0)}%</span>}>
            <div className="weights-table">{assets.map((asset) => <label key={asset.ticker} className={(weights[asset.ticker] ?? 0) === 0 ? 'is-zero' : ''}><span className="asset-chip" style={{ background: asset.color }}>{asset.ticker.slice(0, 1)}</span><span><b>{asset.ticker}</b><small>{asset.name}</small></span><input aria-label={`${asset.ticker} weight`} type="number" min="0" max="100" value={weights[asset.ticker] ?? 0} onChange={(event) => updateWeight(asset.ticker, event.target.value)} /><em>%</em></label>)}</div>
          </Panel>
        </section>

        <section id="analytics" className="content-grid">
          <Panel className="span-6" title="Risk contribution" kicker="Share of portfolio variance" action={<span className="help-tag">Weight ≠ risk</span>}>
            <p className="panel-intro">Contributions use a covariance-matrix approximation: <i>wᵢ(Σw)ᵢ / wᵀΣw</i>.</p><div className="bar-chart"><ResponsiveContainer width="100%" height="100%"><BarChart layout="vertical" data={riskContributionData} margin={{ left: 0, right: 25, top: 2, bottom: 0 }}><XAxis type="number" tickFormatter={(value) => `${value}%`} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="ticker" width={42} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Risk contribution']} cursor={{ fill: '#f2ece0' }} /><Bar dataKey="value" radius={[0, 5, 5, 0]}>{riskContributionData.map((entry) => <Cell key={entry.ticker} fill={entry.color} />)}</Bar></BarChart></ResponsiveContainer></div>
          </Panel>
          <Panel className="span-6" title="Correlation matrix" kicker="Long-run stylised relationships">
            <div className="matrix"><div className="matrix-row matrix-head" style={matrixStyle}><span></span>{selectedAssets.map((asset) => <b key={asset.ticker}>{asset.ticker}</b>)}</div>{selectedAssets.map((left) => <div className="matrix-row" style={matrixStyle} key={left.ticker}><b>{left.ticker}</b>{selectedAssets.map((right) => { const value = analytics.correlations.find((entry) => entry.left === left.ticker && entry.right === right.ticker)?.value ?? 0; return <span key={right.ticker} style={{ backgroundColor: `rgba(183,138,62,${Math.max(0.08, value * 0.58)})` }}>{value.toFixed(2)}</span> })}</div>)}</div>
          </Panel>
          <Panel className="span-12 tail-panel" title="Tail risk snapshot" kicker="Historical simulation • daily horizon • 95% confidence">
            <div className="tail-metrics"><div><span>VaR (95%)</span><b>{formatPercent(analytics.var95)}</b><small>Loss threshold on 1 in 20 days</small></div><div><span>CVaR / Expected Shortfall</span><b>{formatPercent(analytics.cvar95)}</b><small>Average loss after crossing VaR</small></div><div><span>Maximum Drawdown</span><b>{formatPercent(Math.abs(analytics.maxDrawdown))}</b><small>Worst peak-to-trough episode</small></div><div><span>Sharpe Ratio</span><b>{analytics.sharpe.toFixed(2)}</b><small>Uses 4.3% simplified risk-free rate</small></div></div>
          </Panel>
        </section>

        <section id="stress" className="content-grid">
          <Panel className="span-8" title="Stress testing" kicker="Illustrative one-period scenario shocks">
            <div className="scenario-list">{scenarioResults.map(({ scenario, loss }) => <button onClick={() => setSelectedScenario(scenario.id)} className={selectedScenario === scenario.id ? 'scenario active' : 'scenario'} key={scenario.id}><span><b>{scenario.name}</b><small>{scenario.subtitle}</small></span><strong className={loss < 0 ? 'loss' : 'gain'}>{formatPercent(loss)}</strong><ChevronRight size={17} /></button>)}</div>
          </Panel>
          <Panel className="span-4 scenario-detail" title={selectedScenarioData.name} kicker="Selected scenario">
            <div className="scenario-loss"><span>Estimated portfolio impact</span><b className={scenarioLoss < 0 ? 'loss' : 'gain'}>{formatPercent(scenarioLoss)}</b></div><p>{selectedScenarioData.note}</p>{selectedScenarioData.id === 'volatility' && <div className="stress-tail"><span>Base CVaR <b>{formatPercent(analytics.volatilityStress.baseCvar)}</b></span><span>Stress CVaR <b>{formatPercent(analytics.volatilityStress.stressCvar)}</b></span><small>Equity volatility ×{analytics.volatilityStress.volatilityMultiplier.toFixed(1)}; stressed equity correlation {analytics.volatilityStress.equityCorrelation.toFixed(2)}.</small></div>}<div className="impact-row"><span>Largest direct shock</span><b>{largestShock.ticker} · {formatPercent(selectedScenarioData.shocks[largestShock.ticker as keyof typeof selectedScenarioData.shocks])}</b></div><div className="risk-pill"><AlertTriangle size={15} /> {Math.abs(scenarioLoss) > 0.13 ? 'Elevated stress impact' : 'Moderate stress impact'}</div></Panel>
        </section>

        <HedgingSection weights={weights} positions={optionPositions} onChange={setOptionPositions} portfolioValue={STARTING_VALUE} />

        <section id="optimizer" className="content-grid">
          <Panel className="span-12" title="Illustrative reallocation" kicker="Inverse-volatility allocation • not a recommendation">
            <p className="panel-intro">A simple risk-parity-inspired comparison: each selected holding receives a weight inversely related to its annualized volatility, with a 25% cash cap. This reduces concentration, not uncertainty.</p><div className="optimizer-grid"><Metric label="Portfolio" value="Current" sub="Your selected allocation" plain /><Metric label="Ann. Return" value={formatPercent(currentMetrics.return)} sub="Frozen-history estimate" plain /><Metric label="Volatility" value={formatPercent(currentMetrics.volatility)} sub="Annualized daily returns" plain /><Metric label="CVaR" value={formatPercent(currentMetrics.cvar)} sub="95% expected shortfall" plain /><Metric label="Sharpe" value={currentMetrics.sharpe.toFixed(2)} sub="4.3% risk-free assumption" plain /></div><div className="optimizer-grid suggestion"><Metric label="Portfolio" value="Illustrative" sub="Inverse-volatility mix" plain /><Metric label="Ann. Return" value={formatPercent(optimizedAnalytics.annualReturn)} sub="Frozen-history estimate" plain /><Metric label="Volatility" value={formatPercent(optimizedAnalytics.annualVolatility)} sub="Annualized daily returns" plain /><Metric label="CVaR" value={formatPercent(optimizedAnalytics.cvar95)} sub="95% expected shortfall" plain /><Metric label="Sharpe" value={optimizedAnalytics.sharpe.toFixed(2)} sub="4.3% risk-free assumption" plain /></div><div className="reallocation-note"><Sparkles size={16} /><span>Estimated CVaR improvement: <b>{formatPercent(Math.max(0, analytics.cvar95 - optimizedAnalytics.cvar95))}</b>; this may also change expected returns and does not predict future outcomes.</span></div></Panel>
        </section>

        <section id="methodology" className="methodology">
          <div><p className="eyebrow">Methodology</p><h2>Useful models are clear about their limits.</h2></div>
          <div className="method-grid"><Info title="VaR & CVaR" text="VaR marks a loss threshold. CVaR averages the outcomes beyond it, making the tail easier to discuss." /><Info title="Risk contribution" text="Risk comes from weights, volatility, and co-movement—not from capital weights alone." /><Info title="Option overlays" text="European Black–Scholes illustrations reprice a stated option input; Greeks aggregate contract side and multiplier." /><Info title="Frozen market data" text={`Local Nasdaq Close/Last data: ${marketMetadata.startDate} to ${marketMetadata.endDate}. CASH uses a stated fixed-rate proxy.`} /></div>
          <div className="disclaimer">BY’s Quant Risk Lab is a teaching and research demonstration. It does not provide investment, legal, tax, or trading advice. Historical or simulated results do not predict future outcomes.</div>
        </section>
        <section className="risk-brief" aria-label="Portfolio Risk Brief">
          <div className="brief-header"><p>BY’s Quant Risk Lab — Portfolio Risk Brief</p><span>Generated {new Date().toLocaleDateString('en-US')}</span></div>
          <h2>{portfolioName}</h2><p className="brief-source">Frozen Nasdaq Close/Last snapshot · {marketMetadata.startDate} to {marketMetadata.endDate} · CASH: fixed 4.30% annual-rate proxy</p>
          <div className="brief-kpis"><BriefMetric label="Annualized return" value={formatPercent(analytics.annualReturn)} /><BriefMetric label="Volatility" value={formatPercent(analytics.annualVolatility)} /><BriefMetric label="Sharpe" value={analytics.sharpe.toFixed(2)} /><BriefMetric label="Max drawdown" value={formatPercent(Math.abs(analytics.maxDrawdown))} /><BriefMetric label="95% CVaR" value={formatPercent(analytics.cvar95)} /></div>
          <div className="brief-columns"><div><h3>Allocation</h3>{allocation.map((item) => <p key={item.name}>{item.name} <b>{item.value.toFixed(0)}%</b></p>)}</div><div><h3>Risk focus</h3><p>Largest risk contributor: <b>{riskContributionData[0]?.ticker ?? '—'} ({formatPercent((riskContributionData[0]?.value ?? 0) / 100)})</b></p><p>Worst selected scenario: <b>{worstScenario.scenario.name} ({formatPercent(worstScenario.loss)})</b></p><p>Illustrative reallocation CVaR: <b>{formatPercent(optimizedAnalytics.cvar95)}</b></p></div></div>
          <div className="brief-hedge"><h3>Hedge summary</h3>{hedgeAnalytics.positions.length === 0 ? <p>No option hedge has been included in this illustrative portfolio.</p> : <><p>{hedgeAnalytics.positions.map((item) => `${item.position.side} ${item.position.contracts} ${item.position.underlying} ${item.position.optionType}`).join(', ')}</p><p>Theoretical premium: <b>{formatMoney(hedgeAnalytics.netPremiumCost)}</b> · Net delta: <b>{hedgeAnalytics.netGreeks.delta.toFixed(1)}</b></p><p>Combined downside: <b>{formatMoney(hedgeAnalytics.worstCombinedScenario?.withoutHedge ?? 0)}</b> without hedge; <b>{formatMoney(hedgeAnalytics.worstCombinedScenario?.withHedge ?? 0)}</b> with hedge; buffer <b>{formatMoney(hedgeAnalytics.worstCombinedScenario?.downsideBuffer ?? 0)}</b>.</p></>}<p>Theoretical Black–Scholes illustration; not an executable quote or hedge recommendation.</p></div>
          <p className="brief-summary">Technology-linked holdings represent {formatPercent(technologyWeight)} of capital and {formatPercent(technologyRisk)} of modeled portfolio variance. The current historical 95% expected shortfall is {formatPercent(analytics.cvar95)}; the selected illustrative reallocation changes that estimate to {formatPercent(optimizedAnalytics.cvar95)}.</p>
          <p className="brief-disclaimer">Educational and research demonstration only. Close/Last adjustment status is not independently verified; results are not investment advice and do not predict future outcomes.</p>
        </section>
      </main>
    </div>
  )
}

function Panel({ title, kicker, action, className = '', children }: { title: string; kicker: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return <article className={`panel ${className}`}><div className="panel-heading"><div><p>{kicker}</p><h2>{title}</h2></div>{action}</div>{children}</article>
}

function Metric({ icon, label, value, sub, positive, negative, tone, plain }: { icon?: ReactNode; label: string; value: string; sub: string; positive?: boolean; negative?: boolean; tone?: string; plain?: boolean }) {
  return <article className={`metric ${plain ? 'plain-metric' : ''}`}><div className="metric-top">{icon && <span className="metric-icon">{icon}</span>}<span>{label}</span></div><b className={positive ? 'gain' : negative ? 'loss' : tone}>{value}</b><small>{sub}</small></article>
}

function Info({ title, text }: { title: string; text: string }) { return <article><h3>{title}</h3><p>{text}</p></article> }
function BriefMetric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><b>{value}</b></div> }

export default App
