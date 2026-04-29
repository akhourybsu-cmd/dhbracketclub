import { useState } from 'react';
import { Zap, Shield, BatteryCharging, Magnet, Check, Lock, X } from 'lucide-react';
import { useBoostCatalog, usePendingBoost, useSalvageWallet, usePurchaseBoost, type BoostDef } from '@/hooks/useNexusRewards';
import { toast } from 'sonner';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  zap: Zap,
  shield: Shield,
  'battery-charging': BatteryCharging,
  magnet: Magnet,
};

/**
 * Boost picker for the Loadout screen.
 * One pending boost at a time. Selecting locks it for the next run; the engine
 * consumes it when the battle starts (consume_boost RPC).
 */
export function NexusBoostPicker() {
  const { data: catalog = [], isLoading } = useBoostCatalog();
  const { data: pending } = usePendingBoost();
  const { data: wallet } = useSalvageWallet();
  const purchase = usePurchaseBoost();
  const [confirmCode, setConfirmCode] = useState<string | null>(null);
  const balance = wallet?.balance ?? 0;
  const pendingCode = pending?.code ?? null;

  const handlePick = (b: BoostDef) => {
    if (pendingCode === b.code) return;
    setConfirmCode(b.code);
  };

  const handleConfirm = async () => {
    if (!confirmCode) return;
    const b = catalog.find(x => x.code === confirmCode);
    if (!b) return setConfirmCode(null);
    try {
      const res = await purchase.mutateAsync(b.code);
      if (res.ok) toast.success(`${b.name} loaded · -${res.spent}⬢`);
      setConfirmCode(null);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not purchase boost');
      setConfirmCode(null);
    }
  };

  return (
    <section className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="nx-title text-[9px]" style={{ color: 'hsl(195 95% 80%)', letterSpacing: '0.22em' }}>
          ◢ COMBAT BOOST · OPTIONAL
        </h2>
        <span className="text-[10px] tabular-nums font-bold" style={{ color: 'hsl(195 95% 80%)' }}>
          ⬢ {balance}
        </span>
      </div>

      {isLoading ? (
        <div className="h-20 nx-clip-sm bg-white/5 animate-pulse" />
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {catalog.map(b => {
            const Icon = ICONS[b.icon] ?? Zap;
            const isPending = pendingCode === b.code;
            const canAfford = balance >= b.cost_tokens;
            const disabled = isPending || (!canAfford && !isPending);
            return (
              <button
                key={b.code}
                onClick={() => handlePick(b)}
                disabled={purchase.isPending}
                className="shrink-0 w-[160px] p-2.5 nx-clip-sm text-left active:scale-[0.97] transition relative"
                style={{
                  background: isPending
                    ? 'linear-gradient(180deg, hsl(150 70% 18%), hsl(150 70% 10%))'
                    : 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
                  border: isPending
                    ? '1px solid hsl(150 80% 55%)'
                    : canAfford
                      ? '1px solid hsl(195 90% 60% / 0.45)'
                      : '1px solid hsl(0 0% 100% / 0.1)',
                  boxShadow: isPending
                    ? '0 0 14px -4px hsl(150 80% 55% / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.08)'
                    : 'inset 0 1px 0 hsl(0 0% 100% / 0.05)',
                  opacity: !canAfford && !isPending ? 0.55 : 1,
                }}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center shrink-0"
                    style={{
                      background: isPending ? 'hsl(150 80% 55% / 0.18)' : 'hsl(195 90% 60% / 0.15)',
                      border: isPending ? '1.5px solid hsl(150 80% 55%)' : '1.5px solid hsl(195 90% 60% / 0.55)',
                      color: isPending ? 'hsl(150 90% 78%)' : 'hsl(195 95% 80%)',
                    }}
                  >
                    {isPending ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-black truncate" style={{ color: isPending ? 'hsl(150 90% 88%)' : 'hsl(0 0% 95%)' }}>
                      {b.name}
                    </div>
                    <div className="nx-title text-[8px]" style={{ color: 'hsl(195 95% 80%)' }}>
                      {isPending ? 'LOADED' : `⬢ ${b.cost_tokens}`}
                    </div>
                  </div>
                </div>
                <div className="text-[10px] leading-snug text-foreground/70">{b.description}</div>
                {!canAfford && !isPending && (
                  <div className="absolute top-1.5 right-1.5">
                    <Lock className="w-3 h-3 text-foreground/40" />
                  </div>
                )}
              </button>
            );
          })}
          {catalog.length === 0 && (
            <div className="text-[11px] text-foreground/55 px-2 py-3">No boosts available.</div>
          )}
        </div>
      )}

      {pendingCode && (
        <div className="mt-2 text-[10px] text-foreground/55">
          Boost will be consumed when the battle begins. Replacing it before deploy will not refund tokens.
        </div>
      )}

      {/* Confirm modal */}
      {confirmCode && (() => {
        const b = catalog.find(x => x.code === confirmCode);
        if (!b) return null;
        const replacing = !!pendingCode && pendingCode !== b.code;
        return (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 bg-black/70 backdrop-blur-sm"
            onClick={() => setConfirmCode(null)}
          >
            <div
              className="relative w-full max-w-sm p-4 nx-clip-sm"
              style={{
                background: 'linear-gradient(180deg, hsl(218 50% 11%), hsl(218 55% 7%))',
                border: '1px solid hsl(195 90% 60% / 0.45)',
                boxShadow: '0 0 24px -4px hsl(195 90% 60% / 0.5)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <button
                onClick={() => setConfirmCode(null)}
                className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center text-foreground/55"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="nx-title text-[9px] mb-1" style={{ color: 'hsl(195 95% 80%)', letterSpacing: '0.2em' }}>
                CONFIRM BOOST PURCHASE
              </div>
              <div className="text-base font-black mb-1">{b.name}</div>
              <div className="text-[12px] text-foreground/80 mb-3">{b.description}</div>
              {replacing && (
                <div className="text-[11px] mb-2 px-2 py-1.5 nx-clip-sm" style={{ background: 'hsl(38 80% 50% / 0.15)', border: '1px solid hsl(38 90% 60% / 0.4)', color: 'hsl(38 95% 78%)' }}>
                  Replaces your loaded {pendingCode} boost. Old tokens are not refunded.
                </div>
              )}
              <div className="flex items-center justify-between text-[12px] mb-3">
                <span className="text-foreground/60">Balance after</span>
                <span className="font-black tabular-nums" style={{ color: 'hsl(195 95% 80%)' }}>
                  ⬢ {Math.max(0, balance - b.cost_tokens)}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmCode(null)}
                  className="flex-1 py-2.5 nx-clip-sm text-xs font-bold uppercase tracking-wider"
                  style={{ background: 'hsl(0 0% 100% / 0.05)', border: '1px solid hsl(0 0% 100% / 0.15)', color: 'hsl(0 0% 80%)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={purchase.isPending}
                  className="flex-1 py-2.5 nx-clip-sm text-xs font-black uppercase tracking-wider"
                  style={{
                    background: 'linear-gradient(180deg, hsl(195 95% 60%), hsl(195 95% 42%))',
                    color: 'hsl(195 30% 8%)',
                    boxShadow: '0 0 14px hsl(195 90% 55% / 0.55)',
                  }}
                >
                  {purchase.isPending ? '…' : `Spend ⬢ ${b.cost_tokens}`}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </section>
  );
}
