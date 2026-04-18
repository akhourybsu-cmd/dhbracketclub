import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Loader2, Sparkles } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { LORE_TYPES, LORE_STATUSES } from './LoreTypeBadge';
import { useCreateLoreEntry } from '@/hooks/useLoreEntries';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export function QuickAddLoreSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const navigate = useNavigate();
  const { mutateAsync, isPending } = useCreateLoreEntry();
  const [type, setType] = useState<string>('quote');
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [era, setEra] = useState('');
  const [status, setStatus] = useState('classic');

  const reset = () => {
    setType('quote'); setTitle(''); setContext('');
    setShowMore(false); setTagInput(''); setTags([]); setEra(''); setStatus('classic');
  };

  const addTag = () => {
    const t = tagInput.trim().replace(/^#/, '').toLowerCase();
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const onSave = async () => {
    if (!title.trim() || !context.trim()) {
      toast.error('Add a title and a quick story');
      return;
    }
    try {
      const created = await mutateAsync({
        type, title: title.trim(), context: context.trim(),
        tags, era: era.trim() || null, status,
      });
      toast.success('Saved to Lore 📜');
      reset();
      onOpenChange(false);
      navigate(`/lore/${created.id}`);
    } catch (err: any) {
      toast.error(err?.message || 'Could not save');
    }
  };

  // Type chip selector — primary 5 only, advanced types via "More" status
  const quickTypes = LORE_TYPES.slice(0, 5);

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl border-t border-border/40 p-0 max-h-[92dvh] flex flex-col"
        style={{ background: 'hsl(var(--background))' }}
      >
        <SheetHeader className="px-5 pt-5 pb-2 text-left">
          <SheetTitle className="text-xl font-extrabold tracking-tight flex items-center gap-2">
            <Sparkles className="w-5 h-5" style={{ color: 'hsl(var(--lore))' }} />
            Add to Lore
          </SheetTitle>
          <p className="text-[12px] text-muted-foreground font-medium">Save a quote, joke, moment, or nickname</p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          {/* Type chips */}
          <div>
            <label className="form-label">Type</label>
            <div className="flex flex-wrap gap-1.5">
              {quickTypes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setType(t.value)}
                  className={cn(
                    'px-3 py-2 rounded-xl text-[12px] font-bold transition-all btn-press inline-flex items-center gap-1.5 min-h-[40px]',
                    type === t.value
                      ? 'text-white shadow-[0_0_16px_hsl(var(--lore)/0.3)]'
                      : 'text-muted-foreground bg-[hsl(var(--surface-elevated))] border border-border/40',
                  )}
                  style={type === t.value ? { background: 'hsl(var(--lore))' } : undefined}
                >
                  <span aria-hidden>{t.emoji}</span>{t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="form-label">Title or phrase</label>
            <Input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={type === 'quote' ? 'The exact quote...' : type === 'nickname' ? 'The nickname' : 'The phrase or title'}
              className="form-input text-[15px] font-semibold h-12"
              maxLength={200}
            />
          </div>

          {/* Context */}
          <div>
            <label className="form-label">What's the story?</label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Quick context — who said it, when, why it's iconic..."
              className="form-input min-h-[88px] resize-none text-[13px] leading-relaxed py-3"
              maxLength={1000}
            />
          </div>

          {/* Optional details */}
          <Collapsible open={showMore} onOpenChange={setShowMore}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-[12px] font-bold text-muted-foreground hover:text-foreground transition-colors min-h-[44px]"
                style={{ background: 'hsl(var(--surface-elevated))', border: '1px solid hsl(var(--border) / 0.4)' }}
              >
                <span>Add more details {showMore ? '' : '(optional)'}</span>
                <ChevronDown className={cn('w-4 h-4 transition-transform', showMore && 'rotate-180')} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-4">
              {/* Tags */}
              <div>
                <label className="form-label">Tags</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                    placeholder="Add tag"
                    className="form-input"
                  />
                  <button
                    type="button"
                    onClick={addTag}
                    className="px-4 rounded-xl font-bold text-[12px] btn-press min-h-[40px]"
                    style={{ background: 'hsl(var(--lore) / 0.18)', color: 'hsl(var(--lore))' }}
                  >Add</button>
                </div>
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((t) => (
                      <button
                        key={t}
                        onClick={() => setTags(tags.filter((x) => x !== t))}
                        className="text-[10px] font-bold font-mono px-2 py-1 rounded-md hover:opacity-80"
                        style={{ background: 'hsl(var(--lore) / 0.12)', color: 'hsl(var(--lore))' }}
                      >#{t} ×</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Era */}
              <div>
                <label className="form-label">When was it (era)</label>
                <Input
                  value={era}
                  onChange={(e) => setEra(e.target.value)}
                  placeholder="Summer 2023, Vegas Trip..."
                  className="form-input"
                />
              </div>

              {/* Status */}
              <div>
                <label className="form-label">Status</label>
                <div className="flex flex-wrap gap-1.5">
                  {LORE_STATUSES.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setStatus(s.value)}
                      className={cn(
                        'px-3 py-2 rounded-xl text-[11px] font-bold transition-all btn-press min-h-[40px]',
                        status === s.value
                          ? 'text-white'
                          : 'text-muted-foreground bg-[hsl(var(--surface-elevated))] border border-border/40',
                      )}
                      style={status === s.value ? { background: 'hsl(var(--lore))' } : undefined}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Sticky save */}
        <div
          className="px-5 py-4 border-t border-border/40"
          style={{ background: 'hsl(var(--background))', paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <button
            onClick={onSave}
            disabled={isPending || !title.trim() || !context.trim()}
            className="w-full h-12 rounded-2xl font-extrabold text-[14px] tracking-tight text-white btn-press flex items-center justify-center gap-2 disabled:opacity-40"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--lore)), hsl(var(--lore) / 0.8))',
              boxShadow: '0 4px 16px hsl(var(--lore) / 0.3)',
            }}
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            Save to Lore
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
