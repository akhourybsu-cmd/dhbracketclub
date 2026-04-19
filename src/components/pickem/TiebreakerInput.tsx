import { useEffect, useState } from 'react';
import { Star, Lock } from 'lucide-react';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { TeamLogo } from './TeamLogo';
import type { NflGame } from '@/hooks/usePickem';
import { isGameLocked } from '@/hooks/usePickem';

type Props = {
  game?: NflGame;
  predicted?: number | null;
  actual?: number | null;
  onChange: (value: number) => void;
};

export function TiebreakerInput({ game, predicted, actual, onChange }: Props) {
  const [value, setValue] = useState<string>(predicted?.toString() ?? '');
  useEffect(() => { setValue(predicted?.toString() ?? ''); }, [predicted]);

  if (!game) return null;
  const locked = isGameLocked(game);

  return (
    <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4">
      <div className="flex items-center gap-1.5 mb-2">
        <Star className="w-3.5 h-3.5 text-gold fill-gold" />
        <p className="text-[11px] font-extrabold uppercase tracking-wider text-gold">Tiebreaker</p>
        {locked && <Lock className="w-3 h-3 text-muted-foreground" />}
      </div>
      <div className="flex items-center gap-2 mb-3">
        <TeamLogo team={game.away_team} size={24} />
        <span className="text-[12px] font-bold">{game.away_team?.abbr}</span>
        <span className="text-[10px] text-muted-foreground">@</span>
        <TeamLogo team={game.home_team} size={24} />
        <span className="text-[12px] font-bold">{game.home_team?.abbr}</span>
        <span className="text-[10px] text-muted-foreground/70 ml-auto">
          {format(new Date(game.kickoff_at), 'EEE h:mm a')}
        </span>
      </div>
      <label className="text-[11px] text-muted-foreground/80 block mb-1.5">
        Predict total combined points
      </label>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={200}
        value={value}
        disabled={locked}
        placeholder="e.g. 47"
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          const n = parseInt(v, 10);
          if (!isNaN(n) && n >= 0 && n <= 200) onChange(n);
        }}
        className="text-base font-bold h-11"
      />
      {actual != null && (
        <p className="text-[11px] mt-2 text-muted-foreground">
          Actual total: <span className="font-bold text-foreground">{actual}</span>
          {predicted != null && <> · Off by <span className="font-bold">{Math.abs(actual - predicted)}</span></>}
        </p>
      )}
    </div>
  );
}
