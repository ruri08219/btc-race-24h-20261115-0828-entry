# btc-race-24h-20261115-0828-entry

[![competition](https://make.fun/badge/btc-race-24h-20261115-0828.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828)
[![rank](https://make.fun/badge/btc-race-24h-20261115-0828/ruri08219/btc-race-24h-20261115-0828-entry/rank.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828)
[![reward](https://make.fun/badge/btc-race-24h-20261115-0828/ruri08219/btc-race-24h-20261115-0828-entry/reward.svg)](https://make.fun/bounty/btc-race-24h-20261115-0828)

Entry for [Race a BTC trading bot live for 24 hours](https://make.fun/bounty/btc-race-24h-20261115-0828) — a long-only paper-money bot trading cbBTC on 1-minute Orca Whirlpool bars, starting from $1,000.

## Strategy: buy-the-dip / sell-into-bounce

The dev window falls ~4% top to bottom, so buy-and-hold and trend-following both lose. This bot only buys when the price sits well below its own 60-minute mean (a dip), in two tiers, and sells the whole position into a bounce, on a stop, or after a time cap:

- **Tier 1:** close more than 100 bps below the 60-bar SMA → buy 40% of cash.
- **Tier 2:** still holding and close more than 150 bps below the 60-bar SMA → top up with all remaining cash (one position, max weight 100%).
- **Exit** the whole position at **+400 bps** gain, **−200 bps** loss, or after **120 bars** held — whichever comes first.

On the frozen dev window the deep dips (hours 13 and 16–17) bounce 250–400+ bps, far above the ~20 bps round-trip cost of a small trade, while the time cap cuts a position loose before the next leg down. Sizing respects pool impact: a $1,000 trade meets ~15 bps of impact per side, a $400 trade ~6 bps, so the first tier stays small and only the confirmed deep dip takes the full size.

Local dev-grade (kit harness, `makefun grade-local --driver process`): **net PnL +$38.34, 10 trades, max drawdown 1.7%** — above the $0 dev gate with margin.

## Files

- `main.ts` — the bot (Node 22, erasable TypeScript, stdlib only).
- `vendor/makefun-bars.ts` — byte-identical copy of the kit's bars-replay SDK.
- `.makefun/owner.json` — entry ownership anchor.

## Run

```sh
node main.ts  # speaks agent-fun/bars-replay/v1 on stdin/stdout
```

Deterministic: float64 closes only, no clock, no randomness, no network, no files. Two runs on the same bars give the same orders.

SPDX-License-Identifier: MIT
