// Dip-reversion bot for btc-race-24h-20261115-0828: buy-the-dip / sell-into-bounce, long only.
//
// The dev window falls ~4% top to bottom, so trend-following and plain
// buy-and-hold both lose. This bot only buys when the price sits well below
// its own 60-minute mean (a dip), in two tiers, and sells the whole position
// into a bounce, on a stop, or after a time cap:
//
//   - Tier 1: close > 100 bps below the 60-bar SMA -> buy 40% of cash.
//   - Tier 2: still holding and close > 150 bps below the 60-bar SMA
//     -> top up with all remaining cash (one position, max weight 100%).
//   - Exit the whole position: gain >= +400 bps, or gain <= -200 bps,
//     or held >= 120 bars (whichever comes first).
//
// Why this shape: on the frozen dev window the deep dips (hours 13 and 16-17)
// bounce 250-400+ bps, far above the ~20 bps round-trip cost of a small
// trade, while the time cap cuts a position loose before the next leg down.
// Sizing is capped by the pool impact: a $1,000 trade meets ~15 bps of
// impact per side, a $400 trade ~6 bps, so the first tier stays small and
// only the confirmed deep dip takes the full size.
//
// Deterministic: float64 closes only, no clock, no randomness, no network,
// no files. Two runs on the same bars give the same orders.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SMA_BARS = 60;
/** Tier 1 entry: close this many bps below the 60-bar SMA. */
const TIER1_BPS = 100;
/** Tier 2 entry (top-up): close this many bps below the 60-bar SMA. */
const TIER2_BPS = 150;
/** Tier 1 buys this share of cash (40%). */
const TIER1_NUM = 40n;
const TIER1_DEN = 100n;
/** Take profit: whole-position gain in bps. */
const TAKE_PROFIT_BPS = 400;
/** Stop loss: whole-position loss in bps. */
const STOP_LOSS_BPS = 200;
/** Time cap: exit after this many bars held. */
const MAX_HOLD_BARS = 120;
const MAX_SLIPPAGE_BPS = 100;

const closes: number[] = [];
let heldBars = 0;

function sma60(): number | null {
  if (closes.length < SMA_BARS) return null;
  let s = 0;
  for (let i = closes.length - SMA_BARS; i < closes.length; i++) s += closes[i]!;
  return s / SMA_BARS;
}

/** Whole-position gain in bps at the latest close (value vs cost). */
function gainBps(state: BarsState, symbol: string): number | null {
  const held = state.positions.get(symbol);
  if (held === undefined) return null;
  const value = state.value(symbol, held.qty);
  if (held.cost === 0n) return null;
  return Number(((value - held.cost) * 10_000n) / held.cost);
}

await runBars({
  onBatch(state, batch) {
    for (const bar of batch.bars) {
      closes.push(Number(bar.c) / 1e5);
      if (closes.length > SMA_BARS) closes.shift();
    }
    const symbol = state.hello.symbols[0]!.symbol;
    const held = state.positions.get(symbol);
    if (held !== undefined) heldBars++;
    else heldBars = 0;

    const mean = sma60();
    const close = state.close(symbol);
    if (mean === null || close === null) return [];

    const zBps = ((Number(close) / 1e5 - mean) / mean) * 10_000;
    const orders: (BuyInput | SellInput)[] = [];

    if (held !== undefined) {
      const gain = gainBps(state, symbol);
      if (
        gain !== null &&
        (gain >= TAKE_PROFIT_BPS || gain <= -STOP_LOSS_BPS || heldBars >= MAX_HOLD_BARS)
      ) {
        orders.push({ side: 'sell', symbol, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS });
        return orders;
      }
      // Deepening dip: top up with all remaining cash.
      if (zBps < -TIER2_BPS && state.cash >= BigInt(state.hello.fees.min_notional_quote_units)) {
        const room = state.weightRoom(symbol);
        let notional = state.cash < room ? state.cash : room;
        if (notional >= BigInt(state.hello.fees.min_notional_quote_units)) {
          orders.push({ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS });
        }
      }
      return orders;
    }

    // Flat: tier-1 dip entry with 40% of cash.
    if (zBps < -TIER1_BPS) {
      let notional = (state.cash * TIER1_NUM) / TIER1_DEN;
      const room = state.weightRoom(symbol);
      if (notional > room) notional = room;
      if (notional >= BigInt(state.hello.fees.min_notional_quote_units)) {
        orders.push({ side: 'buy', symbol, notional_quote_units: notional, max_slippage_bps: MAX_SLIPPAGE_BPS });
      }
    }
    return orders;
  },
});
