import { Volume2, VolumeX, Vibrate, MousePointerClick, Swords, Trophy, Sparkles, RotateCcw, Music } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useSoundSettings, type SoundCategory } from '@/hooks/useSoundSettings';
import { useMusicPref } from '@/hooks/useAmbientMusic';

const CATEGORY_META: Record<SoundCategory, { label: string; desc: string; Icon: typeof MousePointerClick }> = {
  ui:      { label: 'UI & Menus',     desc: 'Taps, sheet open/close, tab switches', Icon: MousePointerClick },
  combat:  { label: 'Combat',         desc: 'Rune chains, hits, abilities, healing', Icon: Swords },
  rewards: { label: 'Rewards',        desc: 'Coins, stars, level-ups, fanfares',     Icon: Trophy },
  ambient: { label: 'Ambient & Boot', desc: 'Boot drone and idle world sounds',      Icon: Sparkles },
};

const CATEGORY_ORDER: SoundCategory[] = ['ui', 'combat', 'rewards', 'ambient'];

interface Props {
  /** When true, render without the outer card chrome (e.g. inside a sheet). */
  embedded?: boolean;
}

/**
 * Centralised sound + haptics preferences. Controls all in-app audio
 * (Rune Delve themed cues, Chat pings, Lockbox/Drafts beeps, etc.) plus
 * mobile vibration. Persisted to `localStorage` and synced across tabs.
 */
export function SoundSettingsCard({ embedded = false }: Props) {
  const { settings, setMaster, setHaptics, setCategory, reset } = useSoundSettings();
  const { enabled: musicEnabled, setEnabled: setMusicEnabled } = useMusicPref();
  const masterOff = !settings.master;
  const ambientOff = masterOff || !settings.categories.ambient;

  const Wrapper = embedded
    ? ({ children }: { children: React.ReactNode }) => <div className="space-y-3">{children}</div>
    : ({ children }: { children: React.ReactNode }) => (
        <section className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur p-4 space-y-3">
          {children}
        </section>
      );

  return (
    <Wrapper>
      <header className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[14px] font-extrabold tracking-tight flex items-center gap-2">
            {settings.master ? <Volume2 className="w-4 h-4 text-primary" /> : <VolumeX className="w-4 h-4 text-muted-foreground" />}
            Sound & Haptics
          </h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Control in-app sounds and mobile vibration.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 px-2 py-1 rounded-md"
          aria-label="Reset sound settings to defaults"
        >
          <RotateCcw className="w-3 h-3" /> Reset
        </button>
      </header>

      {/* Master */}
      <Row
        title="Master Sound"
        desc="When off, all in-app audio is silenced."
        Icon={settings.master ? Volume2 : VolumeX}
        checked={settings.master}
        onChange={setMaster}
      />

      {/* Haptics */}
      <Row
        title="Haptics (Vibration)"
        desc="Mobile vibration feedback for taps, hits, and rewards."
        Icon={Vibrate}
        checked={settings.haptics}
        onChange={setHaptics}
        disabled={masterOff}
      />

      {/* Music */}
      <Row
        title="Background Music"
        desc="Subtle fantasy ambient on the Rune Delve home screen."
        Icon={Music}
        checked={musicEnabled}
        onChange={setMusicEnabled}
        disabled={ambientOff}
      />

      {/* Categories */}
      <div className="pt-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground mb-2">
          Sound Categories
        </p>
        <div className="space-y-2">
          {CATEGORY_ORDER.map(cat => {
            const meta = CATEGORY_META[cat];
            return (
              <Row
                key={cat}
                title={meta.label}
                desc={meta.desc}
                Icon={meta.Icon}
                checked={settings.categories[cat]}
                onChange={(v) => setCategory(cat, v)}
                disabled={masterOff}
                compact
              />
            );
          })}
        </div>
      </div>
    </Wrapper>
  );
}

interface RowProps {
  title: string;
  desc: string;
  Icon: typeof MousePointerClick;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  compact?: boolean;
}

function Row({ title, desc, Icon, checked, onChange, disabled, compact }: RowProps) {
  return (
    <label
      className={
        'flex items-center gap-3 rounded-xl border border-border/40 bg-background/40 ' +
        (compact ? 'px-3 py-2' : 'px-3 py-2.5') +
        (disabled ? ' opacity-50 cursor-not-allowed' : ' cursor-pointer hover:bg-background/70 transition-colors')
      }
    >
      <span className="w-7 h-7 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
        <Icon className="w-3.5 h-3.5" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-bold leading-tight">{title}</p>
        <p className="text-[10.5px] text-muted-foreground leading-snug mt-0.5">{desc}</p>
      </div>
      <Switch
        checked={checked && !disabled}
        onCheckedChange={onChange}
        disabled={disabled}
        aria-label={title}
      />
    </label>
  );
}

export default SoundSettingsCard;
