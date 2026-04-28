// no Link needed — HUD owns navigation
import { TOWER_LIST } from '@/lib/nexus/towers';
import { ENEMY_LIST } from '@/lib/nexus/enemies';
import { ABILITY_LIST } from '@/lib/nexus/abilities';

export default function NexusCodexPage() {
  return (
    <div className="max-w-md mx-auto pb-6 px-1">
      <div className="mb-4 mt-1">
        <h1 className="text-2xl font-black">Codex</h1>
      </div>

      <Section title="Towers">
        {TOWER_LIST.map(t => (
          <Card key={t.kind} glyph={t.glyph} title={t.name} desc={t.tagline} accent="cyan"
                stats={[`⚡ ${t.cost}`, `DMG ${t.damage}`, `RNG ${t.range}`, `${t.fireRate}/s`]} />
        ))}
      </Section>

      <Section title="Enemies">
        {ENEMY_LIST.map(e => (
          <Card key={e.kind} glyph={e.glyph} title={e.name}
                desc={e.kind === 'drone' ? 'Fast and fragile. Comes in waves.' :
                      e.kind === 'walker' ? 'Heavy armor, slow speed.' :
                      e.kind === 'shielded' ? 'Energy shield absorbs first damage.' :
                      e.kind === 'stealth' ? 'Only Rail Battery can target it.' :
                      'Boss. Massive HP and shield. Bring everything.'}
                accent="rose"
                stats={[`HP ${e.hp}`, `SPD ${e.speed}`, e.armor ? `ARM ${e.armor}` : '', e.shield ? `SHD ${e.shield}` : ''].filter(Boolean) as string[]} />
        ))}
      </Section>

      <Section title="Abilities">
        {ABILITY_LIST.map(a => (
          <Card key={a.kind} glyph={a.glyph} title={a.name} desc={a.tagline} accent="amber"
                stats={[`CD ${a.cooldownMs/1000}s`]} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function Card({ glyph, title, desc, stats, accent }: { glyph: string; title: string; desc: string; stats: string[]; accent: 'cyan' | 'rose' | 'amber' }) {
  const colors = {
    cyan: 'border-cyan-500/30 bg-cyan-500/5 text-cyan-300',
    rose: 'border-rose-500/30 bg-rose-500/5 text-rose-300',
    amber: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
  }[accent];
  return (
    <div className="p-2.5 rounded-lg bg-card border border-border">
      <div className="flex items-start gap-2.5">
        <div className={`w-9 h-9 rounded-md border flex items-center justify-center font-black text-sm shrink-0 ${colors}`}>{glyph}</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold">{title}</div>
          <div className="text-[11px] text-muted-foreground leading-snug">{desc}</div>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {stats.map(s => <span key={s} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{s}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}
