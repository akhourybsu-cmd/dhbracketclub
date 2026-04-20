import { Link } from 'react-router-dom';
import { ArrowLeft, Flame, Trophy } from 'lucide-react';
import { useRuneDelveHero, useUpdateHero } from '@/hooks/useRuneDelveHero';
import { CLASS_LIST, getClass, levelFromXp, titleForLevel, type HeroClass } from '@/lib/runedelve/classConfig';
import { ClassBadge } from '@/components/runedelve/ClassBadge';
import { useState } from 'react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RuneDelveHeroPage() {
  const { data: hero } = useRuneDelveHero();
  const updateHero = useUpdateHero();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState('');
  const [pickClass, setPickClass] = useState<HeroClass | null>(null);

  if (!hero) return <div className="h-32 rounded-2xl skeleton-shimmer" />;

  const cls = getClass(hero.class);
  const lvl = levelFromXp(hero.xp);
  const xpPct = Math.round((lvl.intoLevel / lvl.needed) * 100);
  const title = titleForLevel(lvl.level);

  const save = async () => {
    const patch: any = {};
    if (name && name !== hero.hero_name) patch.hero_name = name;
    if (pickClass && pickClass !== hero.class) patch.class = pickClass;
    if (Object.keys(patch).length === 0) { setEditing(false); return; }
    try {
      await updateHero.mutateAsync(patch);
      toast.success('Hero updated');
      setEditing(false);
    } catch (e: any) {
      toast.error(e?.message ?? 'Could not update hero');
    }
  };

  return (
    <div className="space-y-4 pb-8">
      <Link to="/rune-delve" className="back-link"><ArrowLeft className="w-4 h-4" /> Back</Link>

      <div className="glass-card p-5 text-center">
        <div className="flex justify-center mb-3"><ClassBadge cls={hero.class} size="lg" /></div>
        {editing ? (
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={hero.hero_name}
            maxLength={24}
            className="form-input text-center w-full mb-2 px-3"
          />
        ) : (
          <h2 className="text-xl font-extrabold tracking-tight">{hero.hero_name}</h2>
        )}
        <p className="text-[11px] font-bold text-muted-foreground mt-0.5">{cls.name} · Lv {lvl.level}{title && ` · ${title}`}</p>

        <div className="mt-3">
          <div className="h-2 rounded-full bg-muted/50 overflow-hidden">
            <div className="h-full bg-primary" style={{ width: `${xpPct}%` }} />
          </div>
          <p className="text-[10px] font-mono text-muted-foreground mt-1 tabular-nums">{lvl.intoLevel} / {lvl.needed} XP</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-4">
          <div><p className="font-mono font-extrabold text-base tabular-nums flex items-center justify-center gap-1"><Flame className="w-3.5 h-3.5 text-gold" />{hero.current_streak}</p><p className="text-[8px] font-bold text-muted-foreground uppercase">Streak</p></div>
          <div><p className="font-mono font-extrabold text-base tabular-nums">{hero.lifetime_runs}</p><p className="text-[8px] font-bold text-muted-foreground uppercase">Runs</p></div>
          <div><p className="font-mono font-extrabold text-base tabular-nums">{hero.lifetime_score.toLocaleString()}</p><p className="text-[8px] font-bold text-muted-foreground uppercase">Total Score</p></div>
        </div>
      </div>

      <div className="glass-card p-4">
        <h3 className="font-bold text-[13px] mb-2">Class · {cls.name}</h3>
        <p className="text-[11px] text-muted-foreground mb-1"><span className="font-bold text-foreground">Passive:</span> {cls.passive}</p>
        <p className="text-[11px] text-muted-foreground"><span className="font-bold text-foreground">Ability:</span> {cls.abilityName} — {cls.abilityDesc}</p>
      </div>

      {editing ? (
        <div className="space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1">Change class</p>
          <div className="grid grid-cols-2 gap-2">
            {CLASS_LIST.map(c => (
              <button
                key={c.id}
                onClick={() => setPickClass(c.id)}
                className={cn('glass-card p-3 text-left btn-press', (pickClass ?? hero.class) === c.id && 'border-primary/50')}
              >
                <div className="flex items-center gap-2"><ClassBadge cls={c.id} size="sm" /><span className="font-bold text-[12px]">{c.name}</span></div>
                <p className="text-[10px] text-muted-foreground mt-1">{c.passive}</p>
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 mt-2">
            <button onClick={() => { setEditing(false); setName(''); setPickClass(null); }} className="h-10 rounded-lg bg-muted/40 text-xs font-bold btn-press">Cancel</button>
            <button onClick={save} disabled={updateHero.isPending} className="h-10 rounded-lg bg-primary text-primary-foreground text-xs font-bold btn-press disabled:opacity-50">Save</button>
          </div>
        </div>
      ) : (
        <button onClick={() => { setEditing(true); setName(hero.hero_name); }} className="w-full h-11 rounded-xl bg-muted/40 text-xs font-bold btn-press">Edit hero</button>
      )}

      <Link to="/rune-delve/leaderboard" className="block">
        <div className="glass-card p-3 flex items-center gap-2 btn-press">
          <Trophy className="w-4 h-4 text-gold" />
          <span className="text-xs font-bold flex-1">View today's leaderboard</span>
          <span className="text-xs text-muted-foreground">→</span>
        </div>
      </Link>
    </div>
  );
}
