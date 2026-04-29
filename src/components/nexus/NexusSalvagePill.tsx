import { useSalvageWallet } from '@/hooks/useNexusRewards';

/**
 * Salvage Token readout for the Nexus HUD.
 * Hex-coin styling, amber-cyan duotone to differentiate from Cores.
 */
export function NexusSalvagePill() {
  const { data: wallet, isLoading } = useSalvageWallet();
  const balance = wallet?.balance ?? 0;
  return (
    <div
      className="flex items-center gap-1 h-9 px-2.5 rounded-lg"
      style={{
        background:
          'linear-gradient(180deg, hsl(195 90% 60% / 0.14), hsl(195 90% 30% / 0.18))',
        border: '1px solid hsl(195 90% 60% / 0.45)',
        boxShadow: '0 0 8px -2px hsl(195 90% 55% / 0.45)',
      }}
      aria-label={`Salvage tokens: ${balance}`}
      title="Salvage Tokens — earned from Endless milestones & completed Operations"
    >
      <span
        aria-hidden
        className="text-[12px] leading-none"
        style={{ color: 'hsl(195 95% 80%)', filter: 'drop-shadow(0 0 4px hsl(195 90% 60% / 0.8))' }}
      >
        ⬢
      </span>
      <span
        className="text-[11px] font-black tabular-nums"
        style={{ color: 'hsl(195 95% 88%)' }}
      >
        {isLoading ? '…' : balance}
      </span>
    </div>
  );
}
