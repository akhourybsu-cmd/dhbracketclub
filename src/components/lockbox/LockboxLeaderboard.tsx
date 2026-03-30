import { Trophy } from 'lucide-react';

interface Props {
  scores: any[];
  weekLabel: string;
}

export function LockboxLeaderboard({ scores, weekLabel }: Props) {
  if (scores.length === 0) {
    return (
      <div className="glass-card p-8 text-center">
        <Trophy className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
        <h3 className="font-bold text-sm mb-1">No Scores Yet</h3>
        <p className="text-[11px] text-muted-foreground">Scores update at the end of the week</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold text-muted-foreground mb-2">{weekLabel} STANDINGS</div>
      {scores.map((score: any, i: number) => {
        const medals = ['🥇', '🥈', '🥉'];
        return (
          <div key={score.id} className="glass-card p-3 flex items-center gap-3">
            <div className="w-8 text-center font-bold text-sm">
              {i < 3 ? medals[i] : `#${i + 1}`}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-[13px] truncate">{score.profiles?.display_name || 'Player'}</div>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span>🗡️ {score.crack_points}</span>
                <span>🛡️ {score.defense_points}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-lg">{score.total_points}</div>
              <div className="text-[9px] text-muted-foreground">pts</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
