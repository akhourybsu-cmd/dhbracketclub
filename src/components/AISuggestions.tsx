import { Sparkles, Plus, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Skeleton } from '@/components/ui/skeleton';

interface AISuggestionsProps {
  suggestions: string[];
  loading: boolean;
  onFetch: () => void;
  onAdd: (text: string) => void;
  disabled?: boolean;
}

export default function AISuggestions({ suggestions, loading, onFetch, onAdd, disabled }: AISuggestionsProps) {
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onFetch}
        disabled={loading || disabled}
        className="flex items-center gap-1.5 text-[11px] font-bold transition-colors disabled:opacity-40"
        style={{ color: 'hsl(var(--primary))' }}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
        {loading ? 'Thinking…' : 'Suggest with AI'}
      </button>

      {loading && (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-7 rounded-full" style={{ width: `${60 + i * 12}px` }} />
          ))}
        </div>
      )}

      <AnimatePresence>
        {suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex flex-wrap gap-1.5"
          >
            {suggestions.map((s) => (
              <motion.button
                key={s}
                type="button"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => onAdd(s)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all hover:scale-105 active:scale-95"
                style={{
                  background: 'hsl(var(--primary) / 0.12)',
                  color: 'hsl(var(--primary))',
                  border: '1px solid hsl(var(--primary) / 0.2)',
                }}
              >
                <Plus className="w-3 h-3" />
                {s}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
