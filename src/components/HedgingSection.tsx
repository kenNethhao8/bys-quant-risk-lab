import { useMemo, type ReactNode } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { assets } from '../data'
import { marketPrices } from '../data/marketPrices'
import { calculateHedgeAnalytics, getLatestSpots } from '../options/portfolioOptions'
import { createDefaultSpyPut, type OptionPosition } from '../options/types'

const money = (value: number) => `${value < 0 ? '−' : ''}$${Math.abs(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const decimal = (value: number, digits = 2) => value.toLocaleString('en-US', { maximumFractionDigits: digits, minimumFractionDigits: digits })
const percent = (value: number) => `${(value * 100).toFixed(1)}%`
const spots = getLatestSpots(marketPrices.prices)

type Props = {
  weights: Record<string, number>
  positions: OptionPosition[]
  onChange: (positions: OptionPosition[]) => void
  portfolioValue: number
}

export function HedgingSection({ weights, positions, onChange, portfolioValue }: Props) {
  const hedge = useMemo(() => calculateHedgeAnalytics({ assets, weights, positions, spots, portfolioValue }), [weights, positions, portfolioValue])
  const update = (id: string, field: keyof OptionPosition, value: string) => {
    onChange(positions.map((position) => {
      if (position.id !== id) return position
      if (field === 'optionType' || field === 'side' || field === 'underlying' || field === 'label') return { ...position, [field]: value }
      if (field === 'premiumOverride') return { ...position, premiumOverride: value === '' ? null : Math.max(0, Number(value) || 0) }
      const integerFields: (keyof OptionPosition)[] = ['contracts', 'multiplier']
      const numeric = integerFields.includes(field) ? Math.max(0, Math.round(Number(value) || 0)) : Math.max(0, Number(value) || 0)
      return { ...position, [field]: numeric }
    }))
  }
  const addPosition = () => onChange([...positions, { ...createDefaultSpyPut(spots.SPY), id: `option-${Date.now()}`, label: 'New SPY protective put' }])
  const removePosition = (id: string) => onChange(positions.filter((position) => position.id !== id))
  const combined = hedge.worstCombinedScenario

  return <section id="hedging" className="content-grid hedging-section">
    <article className="panel span-12 hedge-intro">
      <div className="panel-heading"><div><p>European Black–Scholes illustration</p><h2>Hedging & Greeks</h2></div><button className="add-option" onClick={addPosition}><Plus size={14} /> Add option position</button></div>
      <p className="panel-intro">Explore the portfolio effect of a hypothetical option overlay. The cash portfolio is unchanged; premiums and scenario P&amp;L are theoretical, not live quotes or trading instructions.</p>
      {positions.length === 0 ? <div className="empty-hedge"><b>No option hedge has been included in this illustrative portfolio.</b><span>Add a European option position to view theoretical premiums, Greeks, and protection scenarios.</span></div> : <div className="option-editor-list">{positions.map((position, index) => {
        const analysis = hedge.positions.find((item) => item.position.id === position.id)
        return <article className="option-editor" key={position.id}>
          <div className="option-editor-head"><div><span>Position {index + 1}</span><b>{position.label || 'Untitled option'}</b></div><button className="delete-option" aria-label={`Remove ${position.label}`} onClick={() => removePosition(position.id)}><Trash2 size={14} /> Remove</button></div>
          <div className="option-fields">
            <Field label="Label"><input value={position.label} onChange={(event) => update(position.id, 'label', event.target.value)} /></Field>
            <Field label="Underlying"><select value={position.underlying} onChange={(event) => update(position.id, 'underlying', event.target.value)}>{assets.filter((asset) => asset.ticker !== 'CASH').map((asset) => <option key={asset.ticker}>{asset.ticker}</option>)}</select></Field>
            <Field label="Type"><select value={position.optionType} onChange={(event) => update(position.id, 'optionType', event.target.value)}><option value="put">Put</option><option value="call">Call</option></select></Field>
            <Field label="Side"><select value={position.side} onChange={(event) => update(position.id, 'side', event.target.value)}><option value="long">Long</option><option value="short">Short</option></select></Field>
            <Field label="Contracts"><input type="number" min="0" step="1" value={position.contracts} onChange={(event) => update(position.id, 'contracts', event.target.value)} /></Field>
            <Field label="Multiplier"><input type="number" min="1" step="1" value={position.multiplier} onChange={(event) => update(position.id, 'multiplier', event.target.value)} /></Field>
            <Field label="Strike ($)"><input type="number" min="0" step="0.01" value={position.strike} onChange={(event) => update(position.id, 'strike', event.target.value)} /></Field>
            <Field label="Maturity (years)"><input type="number" min="0" step="0.01" value={position.maturity} onChange={(event) => update(position.id, 'maturity', event.target.value)} /></Field>
            <Field label="IV (%)"><input type="number" min="1" step="1" value={position.volatility * 100} onChange={(event) => update(position.id, 'volatility', String(Number(event.target.value) / 100))} /></Field>
            <Field label="Risk-free (%)"><input type="number" min="0" step="0.1" value={position.riskFreeRate * 100} onChange={(event) => update(position.id, 'riskFreeRate', String(Number(event.target.value) / 100))} /></Field>
            <Field label="Dividend yield (%)"><input type="number" min="0" step="0.1" value={position.dividendYield * 100} onChange={(event) => update(position.id, 'dividendYield', String(Number(event.target.value) / 100))} /></Field>
            <Field label="Premium override ($/share)"><input type="number" min="0" step="0.01" placeholder={analysis ? analysis.theoreticalPremium.toFixed(2) : 'Auto'} value={position.premiumOverride ?? ''} onChange={(event) => update(position.id, 'premiumOverride', event.target.value)} /></Field>
          </div>
          {analysis && <div className="option-valuation"><span>Spot <b>${decimal(analysis.spot)}</b></span><span>Theoretical premium <b>${decimal(analysis.theoreticalPremium)}</b></span><span>Entry premium <b>${decimal(analysis.entryPremium)}</b></span><span>Position value <b>{money(analysis.marketValue)}</b></span></div>}
        </article>
      })}</div>}
    </article>

    <article className="panel span-5" aria-label="Portfolio Greek exposure"><div className="panel-heading"><div><p>Portfolio-level exposure</p><h2>Net Greeks</h2></div><span className="help-tag">Options + sleeve delta</span></div>
      <div className="greek-grid"><Greek label="Delta" value={decimal(hedge.netGreeks.delta, 1)} note="share-equivalent / $1 move" /><Greek label="Gamma" value={decimal(hedge.netGreeks.gamma, 3)} note="delta change / $1 move" /><Greek label="Vega" value={money(hedge.netGreeks.vega)} note="P&amp;L per IV +1 point" /><Greek label="Theta" value={money(hedge.netGreeks.theta)} note="daily theoretical decay" /><Greek label="Rho" value={money(hedge.netGreeks.rho)} note="P&amp;L per rate +1 point" /></div>
      <p className="hedge-note">Basic assets contribute delta as estimated shares held (allocated dollars ÷ latest frozen spot). Gamma, vega, theta, and rho come from the option overlay only.</p>
    </article>
    <article className="panel span-7"><div className="panel-heading"><div><p>Protection comparison</p><h2>Hedge effectiveness</h2></div></div>
      <div className="hedge-summary"><div><span>Net theoretical premium</span><b className={hedge.netPremiumCost > 0 ? 'loss' : 'gain'}>{money(hedge.netPremiumCost)}</b><small>Long premium less short premium received</small></div><div><span>Combined downside, without hedge</span><b className="loss">{money(combined?.withoutHedge ?? 0)}</b><small>Equities −20%, IV +10 pts, 30 days</small></div><div><span>Combined downside, with hedge</span><b className={(combined?.withHedge ?? 0) < 0 ? 'loss' : 'gain'}>{money(combined?.withHedge ?? 0)}</b><small>Asset P&amp;L plus repriced options</small></div><div><span>Downside buffer</span><b className={(combined?.downsideBuffer ?? 0) >= 0 ? 'gain' : 'loss'}>{money(combined?.downsideBuffer ?? 0)}</b><small>Incremental option P&amp;L</small></div></div>
      <p className="hedge-note">A long protective put is expected to improve adverse SPY/underlying scenarios but generally creates a premium drag when the underlying rises. This is an educational payoff illustration, not a hedge recommendation.</p>
    </article>

    <article className="panel span-7"><div className="panel-heading"><div><p>Scenario repricing</p><h2>With and without hedge</h2></div></div>
      <div className="hedge-scenarios"><div className="hedge-scenario head"><span>Scenario</span><span>Without hedge</span><span>Option P&amp;L</span><span>With hedge</span></div>{hedge.scenarios.map((scenario) => <div className="hedge-scenario" key={scenario.id}><span><b>{scenario.name}</b><small>{scenario.description}</small></span><b className={scenario.withoutHedge < 0 ? 'loss' : 'gain'}>{money(scenario.withoutHedge)}</b><b className={scenario.optionPnl < 0 ? 'loss' : 'gain'}>{money(scenario.optionPnl)}</b><b className={scenario.withHedge < 0 ? 'loss' : 'gain'}>{money(scenario.withHedge)}</b></div>)}</div>
    </article>
    <article className="panel span-5"><div className="panel-heading"><div><p>Price path</p><h2>Underlying sleeve payoff</h2></div></div>
      {hedge.payoff.length > 0 ? <><div className="payoff-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={hedge.payoff} margin={{ top: 8, right: 6, left: -18, bottom: 0 }}><XAxis dataKey="change" tickFormatter={(value) => percent(Number(value))} tickLine={false} axisLine={false} /><YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tickLine={false} axisLine={false} width={38} /><Tooltip formatter={(value, name) => [money(Number(value)), name === 'withoutHedge' ? 'Without hedge' : name === 'putPnl' ? 'Option P&L' : 'With hedge']} labelFormatter={(value) => `Underlying move: ${percent(Number(value))}`} /><ReferenceLine x={(hedge.primaryStrike! / hedge.primarySpot! - 1)} stroke="#b78a3e" strokeDasharray="4 4" label={{ value: 'Strike', fill: '#8b6e45', fontSize: 10 }} /><Line dataKey="withoutHedge" stroke="#9d8770" strokeWidth={1.7} dot={false} /><Line dataKey="putPnl" stroke="#6e8a79" strokeWidth={1.7} dot={false} /><Line dataKey="withHedge" stroke="#b78a3e" strokeWidth={2.4} dot={false} /></LineChart></ResponsiveContainer></div><p className="hedge-note">Shown for the {hedge.primaryUnderlying} sleeve at current Black–Scholes inputs. Strike ${decimal(hedge.primaryStrike!)}; values include the theoretical entry premium.</p></> : <p className="hedge-note">Add an option position to see a theoretical payoff profile.</p>}
    </article>
  </section>
}

function Field({ label, children }: { label: string; children: ReactNode }) { return <label><span>{label}</span>{children}</label> }
function Greek({ label, value, note }: { label: string; value: string; note: string }) { return <div><span>{label}</span><b>{value}</b><small>{note}</small></div> }
