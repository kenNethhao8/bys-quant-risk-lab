# BY’s Quant Risk Lab

BY’s Quant Risk Lab is a static portfolio-risk research workspace for teaching and portfolio-analysis demonstration. It measures historical return, volatility, drawdown, correlation, historical VaR/CVaR, component risk contribution, stylised stress outcomes, illustrative reallocation, and European-option hedge overlays with portfolio-level Greeks.

It is not a trading terminal, investment-advice service, or real-time market-data product.

## Run, test, and build

```powershell
npm install
npm run dev
npm run test
npm run build
```

`npm run dev` starts the local site. `npm run build` creates the deployable `dist/` folder.

## Free static deployment

No browser-side API calls, server, database, API key, login, or paid service is required. Deploy the repository on Vercel, Netlify, Cloudflare Pages, or GitHub Pages with:

- Build command: `npm run build`
- Publish directory: `dist`

## Frozen market-data snapshot

The browser imports the committed local file [src/data/marketPrices.ts](src/data/marketPrices.ts). It contains 768 shared US trading-day observations for AAPL, MSFT, NVDA, SPY, QQQ, TLT, and GLD from **2023-07-03 through 2026-07-24**.

| Item | Detail |
| --- | --- |
| Source | Nasdaq historical API, `Close/Last` field |
| Retrieved | 2026-07-27 |
| Frequency | Daily, aligned to common dates; no forward filling |
| Data field | `Close/Last`; this project does not independently verify dividend-adjustment status |
| CASH | Fixed 4.30% annual-rate proxy converted to daily returns; not a traded price series |
| Use | Frozen educational snapshot only; review Nasdaq terms and obtain licensed data before commercial use |

The generated module also stores the exact per-ticker Nasdaq source URLs. It is intentionally a source file so the finished Vite site can run entirely offline after build.

### Refreshing the snapshot

Only a developer running the explicit command below accesses the network; the deployed browser never does.

```powershell
npm run refresh:data
```

The script [scripts/fetch-market-data.mjs](scripts/fetch-market-data.mjs) requests the seven Nasdaq histories, drops dates not shared by every series, validates that at least 700 observations remain, and writes the frozen module. Review the new period, source terms, data quality, corporate-action treatment, and this README before committing a refreshed snapshot.

## Methodology

- **Returns** — simple daily returns are calculated from each local price series.
- **Alignment** — assets are matched on common valid dates. Missing dates are dropped rather than forward-filled.
- **Annualisation** — return and volatility use a 252-trading-day convention.
- **Sharpe ratio** — uses the stated 4.30% simplified annual risk-free-rate assumption.
- **Historical VaR/CVaR** — the 5% daily-return tail; CVaR is the mean loss beyond the VaR cutoff.
- **Risk contribution** — component contribution is `wᵢ(Σw)ᵢ / (wᵀΣw)`, calculated from the historical daily-return covariance matrix.
- **Benchmark** — the performance chart computes a separate SPY indexed return curve from the same frozen price snapshot.
- **Illustrative reallocation** — selected holdings receive weights inverse to their historical annualised volatility. CASH uses a 6% volatility floor and a 25% maximum allocation to prevent a zero-volatility cash proxy from dominating the display. It is not a trade recommendation, constraint-aware optimizer, or forecast.
- **Volatility Spike** — a stylised stress applies an initial equity sell-off, equity volatility multiplier of 1.6, and a target equity co-movement weight of 0.90. Bond, gold, and cash series receive distinct stated treatment. This is a scenario, not a probability forecast.
- **European option overlay** — `src/options/pricing.ts` adapts the user-owned local OptionLab TypeScript pricing logic for European Black–Scholes educational analysis. Inputs are spot, strike, time to maturity, implied volatility, risk-free rate, and continuous dividend yield. No American exercise, discrete dividends, early assignment, liquidity, spread, or transaction-cost model is included.
- **Greeks and units** — Delta is option-price change per $1 underlying move; Gamma is delta change per $1 move; Vega and Rho are dollars per +1 percentage-point change in IV and rates; Theta is daily theoretical option-value decay. Each option Greek is multiplied by its long/short sign, integer contracts, and contract multiplier. Basic assets contribute only a transparent estimated-share delta (`allocated dollars ÷ frozen spot`).
- **Option premium and scenarios** — premiums are Black–Scholes theoretical values unless a user provides a manual per-share override. Directional scenarios reprice the option at underlying −10%, −20%, −30%, and +10%; other scenarios use IV +10 points, 30 calendar days of decay, or a combined equity −20% / IV +10 points / 30-day setup. Maturity floors at zero and IV floors at 1% for numerical stability.

## Portfolio Risk Brief

Use **Export Risk Brief** in the page header, then choose the browser’s Print / Save as PDF action. The page uses print CSS to produce a one-page study brief containing the selected portfolio, data range, allocation, metrics, largest risk contributor, worst scenario, reallocation comparison, risk summary, optional hedge position/premium/Greeks/combined-downside buffer, and disclaimers. It does not send data to a server or create a separate PDF artifact.

## Project structure

- `src/data.ts` — asset metadata, presets, and stress scenarios.
- `src/data/marketPrices.ts` — frozen aligned Nasdaq Close/Last histories and source URLs.
- `src/data/marketMetadata.ts` — snapshot provenance and important limitations.
- `src/risk.ts` — data alignment, historical-return calculations, risk metrics, component risk, and volatility stress logic.
- `src/risk.test.ts` — unit coverage for returns, tails, drawdown, alignment, weights, risk contribution, stress CVaR, and finite scenarios.
- `src/options/types.ts` — editable European option-position model and default SPY protective put.
- `src/options/pricing.ts` — adapted Black–Scholes pricing, intrinsic-value boundary handling, and Greeks.
- `src/options/portfolioOptions.ts` — contract aggregation, asset-delta approximation, option repricing, protection scenarios, and payoff data.
- `src/options/*.test.ts` — pricing parity, Greek signs, expiry behavior, long/short direction, multiplier aggregation, downside buffer, premium drag, and empty-overlay coverage.
- `src/components/HedgingSection.tsx` — editable Hedges & Greeks dashboard section.
- `scripts/fetch-market-data.mjs` — explicit one-off data refresh script.
- `src/App.tsx` and `src/styles.css` — dashboard and print-ready Risk Brief.

## Important limitations

This is a teaching and research demonstration only. Historical Close/Last records may not match total-return or independently verified adjusted-close series. Historical or simulated stress results do not predict future outcomes. The project does not provide investment, legal, tax, or trading advice.

## Option-overlay limitations

The Hedges & Greeks section uses frozen underlying spots plus user-entered volatility and premium assumptions. It has no live option chain, bid/ask spread, market depth, real-time quote, expiry calendar, brokerage connection, order path, account data, or execution capability. Theoretical Black–Scholes illustration; not an executable quote or hedge recommendation.
