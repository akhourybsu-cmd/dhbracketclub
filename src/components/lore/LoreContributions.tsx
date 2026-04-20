import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { Pencil, Trash2, Check, X, Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  useLoreContributions,
  useAddLoreContribution,
  useUpdateLoreContribution,
  useDeleteLoreContribution,
  type LoreContribution,
} from '@/hooks/useLoreContributions';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function LoreContributions({ loreId }: { loreId: string }) {
  const { user } = useAuth();
  const { data: contributions = [], isLoading } = useLoreContributions(loreId);
  const { mutate: add, isPending: adding } = useAddLoreContribution();
  const [draft, setDraft] = useState('');

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content) return;
    add(
      { loreId, content },
      {
        onSuccess: () => {
          setDraft('');
          toast.success('Context added');
        },
        onError: (err: any) => toast.error(err?.message || 'Could not add context'),
      },
    );
  };

  return (
    <div className="border-t border-border/30 pt-5 mt-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          Context & Additions
        </p>
        {contributions.length > 0 && (
          <span className="text-[10px] font-mono text-muted-foreground/60 tabular-nums">
            {contributions.length}
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-2">
          <div className="h-12 skeleton-shimmer rounded-lg" />
          <div className="h-12 skeleton-shimmer rounded-lg" />
        </div>
      ) : contributions.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/70 italic mb-4">
          Be the first to add context.
        </p>
      ) : (
        <ul className="space-y-2.5 mb-4">
          <AnimatePresence initial={false}>
            {contributions.map((c) => (
              <ContributionRow key={c.id} contribution={c} loreId={loreId} isOwner={user?.id === c.user_id} />
            ))}
          </AnimatePresence>
        </ul>
      )}

      {user && (
        <form onSubmit={onSubmit} className="relative">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add your context, side of the story, or extra detail…"
            rows={2}
            className="resize-none text-[13px] leading-relaxed rounded-xl pr-12 min-h-[60px] bg-background/40 border-border/50 focus-visible:ring-1 focus-visible:ring-[hsl(var(--lore))]/40"
            maxLength={1000}
          />
          <button
            type="submit"
            disabled={adding || !draft.trim()}
            className="absolute right-2 bottom-2 p-2 rounded-lg disabled:opacity-30 transition-colors hover:bg-[hsl(var(--lore))]/10"
            style={{ color: 'hsl(var(--lore))' }}
            aria-label="Add context"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      )}
    </div>
  );
}

function ContributionRow({
  contribution,
  loreId,
  isOwner,
}: {
  contribution: LoreContribution;
  loreId: string;
  isOwner: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(contribution.content);
  const { mutate: update, isPending: saving } = useUpdateLoreContribution();
  const { mutate: del, isPending: deleting } = useDeleteLoreContribution();

  const initials = (contribution.profiles?.display_name || '?').slice(0, 2).toUpperCase();

  const onSave = () => {
    const content = draft.trim();
    if (!content || content === contribution.content) {
      setEditing(false);
      return;
    }
    update(
      { id: contribution.id, loreId, content },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success('Updated');
        },
        onError: (e: any) => toast.error(e?.message || 'Could not update'),
      },
    );
  };

  const onDelete = () => {
    if (!confirm('Delete this addition?')) return;
    del(
      { id: contribution.id, loreId },
      {
        onSuccess: () => toast.success('Removed'),
        onError: (e: any) => toast.error(e?.message || 'Could not delete'),
      },
    );
  };

  return (
    <motion.li
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="flex gap-2.5 group"
    >
      <Avatar className="w-7 h-7 flex-shrink-0 mt-0.5">
        <AvatarImage src={contribution.profiles?.avatar_url || undefined} />
        <AvatarFallback className="text-[10px] font-bold">{initials}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[11px] font-bold truncate">
            {contribution.profiles?.display_name || 'Member'}
          </span>
          <span className="text-[10px] text-muted-foreground/60 font-mono">
            {formatDistanceToNow(new Date(contribution.created_at), { addSuffix: true })}
          </span>
          {contribution.updated_at !== contribution.created_at && !editing && (
            <span className="text-[9px] text-muted-foreground/50 italic">edited</span>
          )}
        </div>

        {editing ? (
          <div className="space-y-1.5">
            <Textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={2}
              maxLength={1000}
              className="resize-none text-[13px] leading-relaxed rounded-lg min-h-[50px] bg-background/40"
              autoFocus
            />
            <div className="flex items-center gap-1">
              <button
                onClick={onSave}
                disabled={saving}
                className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 disabled:opacity-50"
                style={{ background: 'hsl(var(--lore) / 0.15)', color: 'hsl(var(--lore))' }}
              >
                <Check className="w-3 h-3" /> Save
              </button>
              <button
                onClick={() => {
                  setDraft(contribution.content);
                  setEditing(false);
                }}
                className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] leading-relaxed text-foreground/90 whitespace-pre-wrap break-words">
            {contribution.content}
          </p>
        )}
      </div>

      {isOwner && !editing && (
        <div className="flex flex-col gap-0.5 opacity-60 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button
            onClick={() => setEditing(true)}
            className="p-2.5 rounded-md text-muted-foreground/60 hover:text-foreground min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
            aria-label="Edit"
          >
            <Pencil className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            disabled={deleting}
            className="p-2.5 rounded-md text-muted-foreground/60 hover:text-destructive min-w-[44px] min-h-[44px] inline-flex items-center justify-center"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )}
    </motion.li>
  );
}
