// Sigil Vault — players review their wallet, owned sigils, and pick one to display.
// Reached from the Nexus home page; uses existing reward hooks + sigilStyle tokens
// so the visual treatment matches leaderboards and results panels.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Check, Sparkles } from 'lucide-react';
import { useUserSigils, useSalvageWallet, useSetDisplayedSigil, type UserSigil } from '@/hooks/useNexusRewards';
import { sigilTone, sigilRingShadow, sigilAnimation } from '@/lib/nexus/sigilStyle';
import { SigilGlyph } from '@/components/nexus/SigilGlyph';
import { toast } from 'sonner';

export default function NexusSigilVaultPage() {
  const { data: sigils = [], isLoading } = useUserSigils();
  const { data: wallet } = useSalvageWallet();
  const setDisplayed = useSetDisplayedSigil();

  const displayed = sigils.find((s) => s.is_displayed) ?? null;

  const handleEquip = (sigil: UserSigil) => {
    const next = sigil.is_displayed ? null : sigil.code;
    setDisplayed.mutate(next, {
      onSuccess: () => {
        toast.success(next ? `Displaying ${sigil.name}` : 'Sigil hidden');
      },
      onError: (e: any) => toast.error(e?.message ?? 'Could not update sigil'),
    });
  };

  return (
    <div className="max-w-md mx-auto pb-6">
      <div className="flex items-center justify-between mt-2 mb-3 px-1">
        <Link to="/nexus" className="flex items-center gap-1.5 text-foreground/70 active:scale-95 transition">
          <ArrowLeft className="w-4 h-4" />
          <span className="nx-title text-[10px]">NEXUS</span>
        </Link>
        <div className="nx-title text-[10px] text-foreground/60">SIGIL VAULT</div>
        <div className="w-12" />
      </div>

      {/* Wallet hero */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden mb-4 nx-clip"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 30% 20%, hsl(45 70% 22% / 0.45), transparent 60%),' +
            'linear-gradient(160deg, hsl(218 50% 10%), hsl(220 60% 5%))',
          border: '1px solid hsl(45 90% 60% / 0.35)',
          boxShadow: '0 0 24px -10px hsl(45 90% 60% / 0.5)',
        }}
      >
        <div className="relative p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <Sparkles className="w-3 h-3" style={{ color: 'hsl(45 100% 70%)' }} />
            <span className="nx-title text-[9px]" style={{ color: 'hsl(45 100% 70%)' }}>SALVAGE WALLET</span>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <div className="text-3xl font-black tabular-nums leading-none" style={{ color: 'hsl(45 100% 78%)' }}>
                ⬢ {wallet?.balance ?? 0}
              </div>
              <div className="text-[10px] text-foreground/55 mt-1.5">
                {wallet?.lifetime_earned ?? 0} earned · {wallet?.lifetime_spent ?? 0} spent
              </div>
            </div>
            <div className="text-right">
              <div className="nx-title text-[8px] text-foreground/55 mb-0.5">DISPLAYED</div>
              {displayed ? (
                <div
                  className="inline-flex items-center justify-center w-9 h-9 rounded-full"
                  style={{
                    background: sigilTone(displayed.rarity).bg,
                    boxShadow: sigilRingShadow(displayed.rarity),
                    animation: sigilAnimation(displayed.rarity),
                  }}
                >
                  <SigilGlyph icon={displayed.icon} className="w-4 h-4" />
                </div>
              ) : (
                <div className="text-[10px] text-foreground/40">— none —</div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Owned sigils */}
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="nx-title text-[10px] text-foreground/70">OWNED · {sigils.length}</span>
        {displayed && (
          <button
            onClick={() => handleEquip(displayed)}
            disabled={setDisplayed.isPending}
            className="nx-title text-[9px] text-foreground/60 hover:text-foreground active:scale-95 transition"
          >
            HIDE DISPLAYED
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-md animate-pulse" style={{ background: 'hsl(218 35% 10%)' }} />
          ))}
        </div>
      ) : sigils.length === 0 ? (
        <div
          className="nx-clip-sm p-6 text-center"
          style={{
            background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
            border: '1px dashed hsl(var(--nx-cyan) / 0.25)',
          }}
        >
          <Sparkles className="w-6 h-6 mx-auto mb-2 text-foreground/40" />
          <div className="text-sm font-bold text-foreground/80 mb-1">No sigils yet</div>
          <div className="text-[11px] text-foreground/55 leading-snug max-w-[240px] mx-auto">
            Reach Endless wave 10, 20, or 30 — or contribute to a Co-op Operation — to earn your first sigils.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {sigils.map((s) => {
            const tone = sigilTone(s.rarity);
            const isDisplayed = s.is_displayed;
            return (
              <button
                key={s.sigil_id}
                onClick={() => handleEquip(s)}
                disabled={setDisplayed.isPending}
                className="relative nx-clip-sm p-3 text-left active:scale-[0.97] transition flex flex-col gap-2"
                style={{
                  background: 'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
                  border: `1px solid ${tone.border}`,
                  boxShadow: isDisplayed ? `0 0 14px ${tone.glow}` : undefined,
                }}
              >
                {isDisplayed && (
                  <div
                    className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: tone.border, color: 'hsl(218 50% 8%)' }}
                  >
                    <Check className="w-2.5 h-2.5" strokeWidth={3} />
                  </div>
                )}
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center"
                  style={{
                    background: tone.bg,
                    boxShadow: sigilRingShadow(s.rarity),
                    animation: sigilAnimation(s.rarity),
                    color: tone.fg,
                  }}
                >
                  <SigilGlyph icon={s.icon} className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-bold text-foreground truncate">{s.name}</div>
                  <div className="nx-title text-[8px]" style={{ color: tone.fg }}>{tone.label.toUpperCase()}</div>
                  <div className="text-[10px] text-foreground/55 mt-0.5 line-clamp-2 leading-snug">
                    {s.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 text-center">
        <Link
          to="/nexus/leaderboard"
          className="inline-block nx-title text-[10px] text-foreground/55 hover:text-foreground/80 transition"
        >
          VIEW LEADERBOARD →
        </Link>
      </div>
    </div>
  );
}
