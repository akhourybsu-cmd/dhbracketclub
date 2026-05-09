import { TrendingUp, TrendingDown, Flame, Snowflake } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TICKER_MAP } from '@/lib/portfolioWars/tickers';
import { Sparkline } from './Sparkline';

interface PickCardProps {
  ticker: string;
  startPrice: number | null;
  latestPrice: number | null;
  pct: number | null;
  bestBadge?: boolean;
  worstBadge?: boolean;
}

export function StockPickCard({
  ticker, startPrice, latestPrice, pct, bestBadge, worstBadge,
}: PickCardProps) {
  const meta = TICKER_MAP[ticker];
  const positive = (pct ?? 0) >= 0;
  const hasPct = pct != null;

  return (
    <div
      className="relative rounded-xl p-3 flex items-center gap-3 overflow-hidden"
      style={{
        background:
          'linear-gradient(180deg, hsl(220 45% 9%), hsl(220 50% 6%))',
        border: hasPct
          ? (positive ? '1px solid hsl(152 80% 50% / 0.30)' : '1px solid hsl(0 75% 60% / 0.30)')
          : '1px solid hsl(220 30% 18% / 0.7)',
        boxShadow: hasPct
          ? (positive
              ? 'inset 0 1px 0 hsl(152 80% 50% / 0.10), 0 4px 12px -8px hsl(152 80% 50% / 0.4)'
              : 'inset 0 1px 0 hsl(0 75% 60% / 0.10), 0 4px 12px -8px hsl(0 75% 60% / 0.4)')
          : undefined,
      }}
    >
      {/* Ticker badge */}
      <div
        className="w-11 h-11 rounded-lg flex items-center justify-center font-black text-[11px] font-mono flex-shrink-0"
        style={{
          background: hasPct
            ? (positive ? 'hsl(152 80% 50% / 0.14)' : 'hsl(0 75% 60% / 0.14)')
            : 'hsl(220 30% 14%)',
          color: hasPct
            ? (positive ? 'hsl(152 80% 70%)' : 'hsl(0 80% 75%)')
            : 'hsl(38 100% 65%)',
          border: hasPct
            ? (positive ? '1px solid hsl(152 80% 50% / 0.32)' : '1px solid hsl(0 75% 60% / 0.32)')
            : '1px solid hsl(38 100% 60% / 0.28)',
        }}
      >
        {ticker.slice(0, 4)}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-[12px] font-extrabold truncate">{ticker}</span>
          {bestBadge && (
            <span
              className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-0.5"
              style={{ background: 'hsl(152 80% 50% / 0.18)', color: 'hsl(152 80% 70%)' }}
            >
              <Flame className="w-2.5 h-2.5" /> Best
            </span>
          )}
          {worstBadge && (
            <span
              className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded flex items-center gap-0.5"
              style={{ background: 'hsl(0 75% 60% / 0.18)', color: 'hsl(0 80% 72%)' }}
            >
              <Snowflake className="w-2.5 h-2.5" /> Anchor
            </span>
          )}
        </div>
        <div className="text-[10px] text-white/55 truncate">{meta?.name || meta?.sector || ''}</div>
        {startPrice != null && latestPrice != null && (
          <div className="text-[10px] tabular-nums font-mono text-white/55 mt-0.5">
            ${Number(startPrice).toFixed(2)} → ${Number(latestPrice).toFixed(2)}
          </div>
        )}
      </div>

      {/* Sparkline + pct */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        <Sparkline ticker={ticker} start={startPrice} end={latestPrice} />
        <span
          className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[11px] font-black tabular-nums font-mono',
          )}
          style={{
            background: hasPct
              ? (positive ? 'hsl(152 80% 50% / 0.18)' : 'hsl(0 75% 60% / 0.18)')
              : 'hsl(220 30% 14%)',
            color: hasPct
              ? (positive ? 'hsl(152 80% 70%)' : 'hsl(0 80% 75%)')
              : 'hsl(220 10% 60%)',
          }}
        >
          {hasPct ? (positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />) : null}
          {hasPct ? `${positive ? '+' : ''}${pct!.toFixed(2)}%` : '—'}
        </span>
      </div>
    </div>
  );
}
