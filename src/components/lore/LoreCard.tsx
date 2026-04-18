import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Quote } from 'lucide-react';
import { LoreEntry } from '@/hooks/useLoreEntries';
import { LoreTypeBadge, LoreStatusBadge } from './LoreTypeBadge';
import { formatDistanceToNow } from 'date-fns';

export function LoreCard({ entry, index = 0 }: { entry: LoreEntry; index?: number }) {
  const reactionCount = entry.reactions?.length || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index }}
    >
      <Link to={`/lore/${entry.id}`} className="block group">
        <div className="glass-card p-4 transition-all duration-200 group-hover:border-[hsl(var(--lore))]/25 relative overflow-hidden">
          {/* Lore arena edge */}
          <div
            className="absolute inset-x-0 top-0 h-px pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--lore) / 0.4), transparent)' }}
          />

          <div className="relative z-10">
            <div className="flex items-center justify-between gap-2 mb-2.5">
              <LoreTypeBadge type={entry.type} />
              <LoreStatusBadge status={entry.status} />
            </div>

            {entry.type === 'quote' && (
              <Quote className="w-4 h-4 mb-1.5 opacity-40" style={{ color: 'hsl(var(--lore))' }} />
            )}

            <h3 className="font-extrabold text-[15px] leading-snug tracking-tight mb-1.5 line-clamp-2">
              {entry.type === 'quote' ? `"${entry.title}"` : entry.title}
            </h3>

            <p className="text-[12px] text-muted-foreground line-clamp-2 leading-relaxed mb-3">
              {entry.context}
            </p>

            {entry.tags && entry.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-2.5">
                {entry.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="text-[9px] font-bold px-1.5 py-0.5 rounded-md font-mono"
                    style={{
                      background: 'hsl(var(--surface-overlay))',
                      color: 'hsl(var(--muted-foreground))',
                    }}
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between text-[10px] text-muted-foreground/70 font-medium">
              <span className="truncate">
                {entry.profiles?.display_name || 'Someone'}
                {entry.era && <> · <span className="font-mono">{entry.era}</span></>}
              </span>
              <div className="flex items-center gap-2 flex-shrink-0">
                {reactionCount > 0 && (
                  <span className="font-bold tabular-nums" style={{ color: 'hsl(var(--lore))' }}>
                    {reactionCount} {reactionCount === 1 ? 'react' : 'reacts'}
                  </span>
                )}
                <span>{formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}</span>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
