import { motion } from 'framer-motion';
import { Crown, Medal, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Row {
  id: string;
  user_id: string;
  avg_pct: number | null;
  pw_picks: { id: string; ticker: string; position: number }[];
  profile?: { display_name?: string | null; avatar_url?: string | null } | null;
}

function PctChip({ value }: { value: number | null }) {
  if (value == null) return <span className="text-white/40 text-[12px] font-mono">—</span>;
  const positive = value >= 0;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[12px] font-black tabular-nums font-mono"
      style={{
        background: positive ? 'hsl(152 80% 50% / 0.18)' : 'hsl(0 75% 60% / 0.18)',
        color: positive ? 'hsl(152 80% 70%)' : 'hsl(0 80% 75%)',
      }}
    >
      {positive ? '+' : ''}{value.toFixed(2)}%
    </span>
  );
}

function Avatar({ name, url }: { name: string; url?: string | null }) {
  if (url) {
    return <img src={url} alt="" className="w-9 h-9 rounded-full object-cover" loading="lazy" />;
  }
  const initials = name.split(/\s+/).map((s) => s[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center font-black text-[11px]"
      style={{ background: 'hsl(220 40% 14%)', color: 'hsl(150 15% 85%)' }}
    >
      {initials}
    </div>
  );
}

function PodiumCard({
  rank, row, currentUserId,
}: { rank: 1 | 2 | 3; row: Row; currentUserId?: string }) {
  const isMe = row.user_id === currentUserId;
  const palette = {
    1: { color: 'hsl(45 95% 60%)', glow: 'hsl(45 95% 50% / 0.45)', label: 'Champion', Icon: Crown },
    2: { color: 'hsl(220 10% 78%)', glow: 'hsl(220 10% 70% / 0.35)', label: '2nd Place', Icon: Medal },
    3: { color: 'hsl(28 70% 56%)', glow: 'hsl(28 70% 50% / 0.40)', label: '3rd Place', Icon: Award },
  }[rank];
  const Icon = palette.Icon;
  const tickers = (row.pw_picks || []).slice().sort((a, b) => a.position - b.position);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="relative overflow-hidden rounded-xl p-3"
      style={{
        background: `linear-gradient(180deg, ${palette.color.replace(')', ' / 0.10)')}, hsl(220 55% 5%))`,
        border: `1px solid ${palette.color.replace(')', ' / 0.42)')}`,
        boxShadow: `0 6px 24px -10px ${palette.glow}, inset 0 1px 0 ${palette.color.replace(')', ' / 0.20)')}`,
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: palette.color.replace(')', ' / 0.18)'),
            border: `1px solid ${palette.color.replace(')', ' / 0.4)')}`,
          }}
        >
          <Icon className="w-4 h-4" style={{ color: palette.color }} />
        </span>
        <Avatar name={row.profile?.display_name || 'P'} url={row.profile?.avatar_url} />
        <div className="flex-1 min-w-0">
          <div
            className="text-[8.5px] font-black uppercase tracking-[0.2em] mb-0.5"
            style={{ color: palette.color }}
          >
            {palette.label}
          </div>
          <div className="text-[13px] font-extrabold truncate">
            {row.profile?.display_name || 'Player'}
            {isMe && <span className="ml-1 text-[10px]" style={{ color: 'hsl(152 80% 65%)' }}>(you)</span>}
          </div>
          <div className="flex gap-1 mt-1">
            {tickers.map((p) => (
              <span
                key={p.id}
                className="text-[9px] font-black px-1.5 py-0.5 rounded font-mono"
                style={{
                  background: 'hsl(220 30% 10%)',
                  color: 'hsl(150 15% 80%)',
                  border: '1px solid hsl(220 25% 18%)',
                }}
              >
                {p.ticker}
              </span>
            ))}
          </div>
        </div>
        <PctChip value={row.avg_pct} />
      </div>
    </motion.div>
  );
}

function StandardRow({
  rank, row, currentUserId,
}: { rank: number; row: Row; currentUserId?: string }) {
  const isMe = row.user_id === currentUserId;
  const tickers = (row.pw_picks || []).slice().sort((a, b) => a.position - b.position);
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(rank * 0.015, 0.3) }}
      className={cn('rounded-lg p-2.5 flex items-center gap-2.5')}
      style={{
        background: isMe ? 'hsl(152 80% 50% / 0.08)' : 'hsl(220 45% 7% / 0.6)',
        border: isMe ? '1px solid hsl(152 80% 50% / 0.35)' : '1px solid hsl(220 25% 14%)',
      }}
    >
      <span
        className="w-7 text-center font-black tabular-nums text-[12px] font-mono flex-shrink-0"
        style={{ color: 'hsl(150 12% 60%)' }}
      >
        {rank}
      </span>
      <Avatar name={row.profile?.display_name || 'P'} url={row.profile?.avatar_url} />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-extrabold truncate">
          {row.profile?.display_name || 'Player'}
          {isMe && <span className="ml-1 text-[10px]" style={{ color: 'hsl(152 80% 65%)' }}>(you)</span>}
        </div>
        <div className="flex gap-1 mt-0.5">
          {tickers.map((p) => (
            <span
              key={p.id}
              className="text-[8.5px] font-black px-1.5 py-0.5 rounded font-mono"
              style={{
                background: 'hsl(220 30% 10%)',
                color: 'hsl(150 12% 75%)',
              }}
            >
              {p.ticker}
            </span>
          ))}
        </div>
      </div>
      <PctChip value={row.avg_pct} />
    </motion.div>
  );
}

export function LeaderboardList({
  rows, currentUserId, hidePodium,
}: {
  rows: Row[] | undefined;
  currentUserId?: string;
  hidePodium?: boolean;
}) {
  if (!rows?.length) {
    return (
      <div
        className="rounded-xl p-6 text-center text-[12px]"
        style={{ background: 'hsl(220 45% 6% / 0.6)', border: '1px solid hsl(220 25% 14%)', color: 'hsl(150 10% 60%)' }}
      >
        No entries yet. Be the first to pick.
      </div>
    );
  }
  const podium = hidePodium ? [] : rows.slice(0, 3);
  const rest = hidePodium ? rows : rows.slice(3);
  return (
    <div className="space-y-2">
      {podium.length > 0 && (
        <div className="space-y-2">
          {podium.map((r, i) => (
            <PodiumCard key={r.id} rank={(i + 1) as 1 | 2 | 3} row={r} currentUserId={currentUserId} />
          ))}
        </div>
      )}
      {rest.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {rest.map((r, i) => (
            <StandardRow
              key={r.id}
              rank={hidePodium ? i + 1 : i + 4}
              row={r}
              currentUserId={currentUserId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
