import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hash, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Channel, Category, ChannelMeta } from './types';
import { CHANNEL_EMOJI } from './types';

interface ChannelListProps {
  channels: Channel[];
  categories: Category[];
  channelMeta: Map<string, ChannelMeta>;
  selectedChannel: Channel | null;
  loading: boolean;
  onSelectChannel: (ch: Channel) => void;
  onCreateChannel: (name: string, categoryId: string) => void;
}

export function ChannelList({
  channels, categories, channelMeta, selectedChannel,
  loading, onSelectChannel, onCreateChannel,
}: ChannelListProps) {
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState('');

  const groupedChannels = categories.map(cat => ({
    ...cat,
    channels: channels.filter(ch => ch.category_id === cat.id),
  }));

  const handleCreate = () => {
    if (!newChannelName.trim()) return;
    onCreateChannel(newChannelName.trim().toLowerCase().replace(/\s+/g, '-'), newChannelCategory || categories[0]?.id || '');
    setNewChannelName('');
    setShowNewChannel(false);
  };

  return (
    <div className="pb-6 lg:pb-4">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Chat</h1>
            <p className="text-[10px] text-muted-foreground/60 font-medium mt-0.5">DH conversations</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setShowNewChannel(true)} className="h-8 w-8 p-0 rounded-xl">
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <AnimatePresence>
          {showNewChannel && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-xs font-bold">New Channel</h3>
                <Input placeholder="channel-name" value={newChannelName} onChange={e => setNewChannelName(e.target.value)} className="h-9 text-sm" />
                <select value={newChannelCategory} onChange={e => setNewChannelCategory(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreate} disabled={!newChannelName.trim()} className="flex-1 h-8 text-xs font-bold">Create</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewChannel(false)} className="h-8 text-xs">Cancel</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-5">
          {groupedChannels.map(group => (
            group.channels.length > 0 && (
              <div key={group.id}>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 mb-1.5 px-1">{group.name}</p>
                <div className="space-y-0.5">
                  {group.channels.map((ch, i) => {
                    const meta = channelMeta.get(ch.id);
                    const emoji = CHANNEL_EMOJI[ch.name] || '#';
                    return (
                      <motion.button
                        key={ch.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.025 }}
                        onClick={() => onSelectChannel(ch)}
                        className={cn(
                          "w-full flex items-center gap-3 px-3 py-3 rounded-xl text-left transition-all duration-150",
                          "hover:bg-muted/50 active:bg-muted/60 active:scale-[0.99]",
                          selectedChannel?.id === ch.id && "bg-primary/8",
                          meta?.unread && "bg-muted/25"
                        )}
                      >
                        <div className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center text-base flex-shrink-0 transition-colors",
                          meta?.unread ? "bg-primary/12" : "bg-muted/50"
                        )}>
                          {typeof emoji === 'string' && emoji !== '#' ? emoji : <Hash className="w-4 h-4 text-muted-foreground/60" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className={cn(
                              "text-[13px] tracking-tight truncate",
                              meta?.unread ? "font-bold text-foreground" : "font-semibold text-foreground/80"
                            )}>
                              {ch.name}
                            </span>
                            {meta?.unread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                          </div>
                          {meta?.lastMessage ? (
                            <p className={cn(
                              "text-[11px] truncate mt-0.5",
                              meta.unread ? "text-foreground/65 font-medium" : "text-muted-foreground/70"
                            )}>
                              {meta.lastAuthor && <span className="font-semibold">{meta.lastAuthor}: </span>}
                              {meta.lastMessage}
                            </p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{ch.description || 'No messages yet'}</p>
                          )}
                        </div>
                        {meta?.lastMessageAt && (
                          <span className="text-[9px] text-muted-foreground/70 font-medium flex-shrink-0 self-start mt-1">
                            {isToday(new Date(meta.lastMessageAt)) ? format(new Date(meta.lastMessageAt), 'h:mm a') : format(new Date(meta.lastMessageAt), 'MMM d')}
                          </span>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )
          ))}
        </div>

        {loading && channels.length === 0 && (
          <div className="space-y-0.5">
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70 mb-1.5 px-1">
              <span className="inline-block h-2 w-16 rounded skeleton-shimmer" />
            </p>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-xl">
                <div className="w-9 h-9 rounded-xl skeleton-shimmer flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded-md w-24 skeleton-shimmer" />
                  <div className="h-2.5 rounded-md w-40 skeleton-shimmer" />
                </div>
                <div className="h-2 w-10 rounded skeleton-shimmer" />
              </div>
            ))}
          </div>
        )}

        {channels.length === 0 && !loading && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.03))' }}>
              <Hash className="w-7 h-7 text-primary/40" />
            </div>
            <p className="text-sm text-muted-foreground/70 font-semibold">No channels yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Create one to start chatting with the crew</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
