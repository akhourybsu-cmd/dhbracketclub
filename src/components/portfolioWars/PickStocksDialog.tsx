import { useEffect, useMemo, useState } from 'react';
import { Search, X, Lock, Sparkles, BarChart3 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { searchTickers, TICKER_MAP } from '@/lib/portfolioWars/tickers';
import { useSubmitPicks, type PwChallenge } from '@/hooks/usePortfolioWars';

const SLOT_LABEL = ['Pick 1', 'Pick 2', 'Pick 3'];

export function PickStocksDialog({
  open, onOpenChange, challenge, currentTickers, onDone,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  challenge: PwChallenge;
  currentTickers: string[];
  onDone: () => void;
}) {
  const [selected, setSelected] = useState<string[]>(currentTickers);
  const [query, setQuery] = useState('');
  const [confirm, setConfirm] = useState(false);
  const submit = useSubmitPicks();

  useEffect(() => { setSelected(currentTickers); setConfirm(false); }, [currentTickers, open]);

  const results = useMemo(() => searchTickers(query, 40), [query]);

  function toggle(symbol: string) {
    setSelected((s) => {
      if (s.includes(symbol)) return s.filter((x) => x !== symbol);
      if (s.length >= 3) {
        toast.error('Roster full — drop a pick to swap.');
        return s;
      }
      return [...s, symbol];
    });
  }

  async function handleSubmit() {
    try {
      await submit.mutateAsync({ challengeId: challenge.id, tickers: selected });
      toast.success('Portfolio locked in. Let the market decide. 📈');
      onOpenChange(false);
      onDone();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to lock picks');
    }
  }

  const ready = selected.length === 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden gap-0"
        style={{
          background: 'linear-gradient(180deg, hsl(220 50% 7%), hsl(220 55% 4%))',
          border: '1px solid hsl(152 80% 50% / 0.28)',
        }}
      >
        <DialogHeader
          className="p-4 pb-3 border-b"
          style={{ borderColor: 'hsl(152 80% 50% / 0.18)' }}
        >
          <DialogTitle className="text-base font-extrabold flex items-center gap-2">
            <BarChart3 className="w-4 h-4" style={{ color: 'hsl(152 80% 60%)' }} />
            Build Your Portfolio
          </DialogTitle>
          <p className="text-[11px] text-white/55">
            Choose 3 weapons · Locks {format(new Date(challenge.lock_at), 'EEE h:mm a')} ET
          </p>
        </DialogHeader>

        {/* Roster slots */}
        <div className="px-4 pt-3 pb-2">
          <div
            className="grid grid-cols-3 gap-2 p-2 rounded-xl"
            style={{
              background: 'hsl(220 60% 3% / 0.6)',
              border: '1px solid hsl(220 30% 14%)',
            }}
          >
            {[0, 1, 2].map((i) => {
              const sym = selected[i];
              const meta = sym ? TICKER_MAP[sym] : null;
              return (
                <div
                  key={i}
                  className={cn(
                    'h-[68px] rounded-lg flex flex-col items-center justify-center text-center px-1 relative transition',
                    sym
                      ? 'border'
                      : 'border border-dashed',
                  )}
                  style={
                    sym
                      ? {
                          background: 'hsl(152 80% 50% / 0.10)',
                          borderColor: 'hsl(152 80% 50% / 0.45)',
                          boxShadow: 'inset 0 0 12px hsl(152 80% 50% / 0.15)',
                        }
                      : {
                          background: 'hsl(220 30% 8% / 0.4)',
                          borderColor: 'hsl(220 25% 22% / 0.7)',
                        }
                  }
                >
                  {sym ? (
                    <>
                      <button
                        onClick={() => toggle(sym)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                        aria-label="Remove"
                      >
                        <X className="w-3 h-3" strokeWidth={3} />
                      </button>
                      <span className="font-black text-[13px] font-mono" style={{ color: 'hsl(152 80% 70%)' }}>
                        {sym}
                      </span>
                      <span className="text-[8.5px] text-white/55 truncate w-full mt-0.5">
                        {meta?.name || ''}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className="text-[9px] font-black uppercase tracking-[0.18em]"
                        style={{ color: 'hsl(38 100% 60% / 0.5)' }}
                      >
                        {SLOT_LABEL[i]}
                      </span>
                      <span className="text-[8px] text-white/30 mt-1">empty</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Search */}
        <div className="px-4 pt-1 pb-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search S&P 500 stocks..."
              className="pl-9 h-10 font-mono text-[13px]"
              style={{ background: 'hsl(220 60% 4%)', borderColor: 'hsl(220 30% 16%)' }}
            />
          </div>
        </div>

        {/* Results */}
        <div className="px-2 pt-1 pb-3 max-h-[38vh] overflow-y-auto">
          {results.map((t) => {
            const isSelected = selected.includes(t.symbol);
            return (
              <button
                key={t.symbol}
                onClick={() => toggle(t.symbol)}
                className={cn(
                  'w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg active:scale-[0.99] transition',
                )}
                style={
                  isSelected
                    ? {
                        background: 'hsl(152 80% 50% / 0.14)',
                        border: '1px solid hsl(152 80% 50% / 0.35)',
                      }
                    : { border: '1px solid transparent' }
                }
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center font-black text-[10.5px] font-mono"
                    style={{
                      background: isSelected ? 'hsl(152 80% 50% / 0.20)' : 'hsl(220 30% 12%)',
                      color: isSelected ? 'hsl(152 80% 75%)' : 'hsl(150 15% 80%)',
                      border: isSelected ? '1px solid hsl(152 80% 50% / 0.4)' : '1px solid hsl(220 25% 18%)',
                    }}
                  >
                    {t.symbol.slice(0, 4)}
                  </div>
                  <div className="text-left min-w-0">
                    <div className="text-[12px] font-extrabold leading-tight">{t.symbol}</div>
                    <div className="text-[10px] text-white/55 truncate">{t.name}</div>
                  </div>
                </div>
                {t.sector && (
                  <span className="text-[8.5px] font-bold uppercase tracking-wider text-white/45 flex-shrink-0">
                    {t.sector}
                  </span>
                )}
              </button>
            );
          })}
          {results.length === 0 && (
            <p className="text-center text-[12px] text-white/50 py-6">No matches.</p>
          )}
        </div>

        {/* Bottom action bar */}
        <div
          className="p-3 border-t flex gap-2 sticky bottom-0"
          style={{
            background: 'linear-gradient(180deg, hsl(220 55% 4% / 0.6), hsl(220 60% 3%))',
            borderColor: 'hsl(152 80% 50% / 0.18)',
            paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))',
          }}
        >
          <Button variant="ghost" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {!confirm ? (
            <Button
              className="flex-1 font-black uppercase tracking-wider text-[12px]"
              disabled={!ready}
              onClick={() => setConfirm(true)}
              style={
                ready
                  ? {
                      background: 'linear-gradient(135deg, hsl(152 80% 48%), hsl(152 80% 38%))',
                      color: 'hsl(220 60% 4%)',
                      boxShadow: '0 4px 18px hsl(152 80% 40% / 0.5)',
                    }
                  : undefined
              }
            >
              {ready ? <><Lock className="w-3.5 h-3.5" /> Lock In Portfolio</> : `Pick ${3 - selected.length} More`}
            </Button>
          ) : (
            <Button
              className="flex-1 font-black uppercase tracking-wider text-[12px]"
              disabled={submit.isPending}
              onClick={handleSubmit}
              style={{
                background: 'linear-gradient(135deg, hsl(38 100% 60%), hsl(38 100% 50%))',
                color: 'hsl(220 60% 4%)',
                boxShadow: '0 4px 18px hsl(38 100% 50% / 0.5)',
              }}
            >
              {submit.isPending ? 'Locking…' : <><Sparkles className="w-3.5 h-3.5" /> Confirm & Deploy</>}
            </Button>
          )}
        </div>
        {confirm && (
          <p className="text-center text-[10px] text-white/55 italic px-4 pb-3 -mt-1">
            Your portfolio enters the arena Monday at market open.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
