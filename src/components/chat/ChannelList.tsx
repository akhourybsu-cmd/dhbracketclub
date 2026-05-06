import { useState } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { Hash, Plus, Settings, GripVertical, FolderPlus, Menu } from 'lucide-react';
import { useNavDrawer } from '@/contexts/NavDrawerContext';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, differenceInDays } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { Channel, Category, ChannelMeta } from './types';
import { CHANNEL_EMOJI } from './types';

interface ChannelListProps {
  channels: Channel[];
  categories: Category[];
  channelMeta: Map<string, ChannelMeta>;
  selectedChannel: Channel | null;
  currentUserId?: string;
  loading: boolean;
  onSelectChannel: (ch: Channel) => void;
  onCreateChannel: (name: string, categoryId: string) => void;
  onEditChannel?: (channelId: string, newName: string) => void;
  onReorderChannels?: (categoryId: string, reordered: Channel[]) => void;
  onOpenSettings?: (channel: Channel) => void;
  onCreateCategory?: (name: string) => void;
}

function formatPreviewTime(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  if (differenceInDays(new Date(), d) < 7) return format(d, 'EEE');
  return format(d, 'MMM d');
}

interface ChannelRowProps {
  ch: Channel;
  meta: ChannelMeta | undefined;
  isCurrent: boolean;
  reorderEnabled: boolean;
  onSelect: () => void;
  onOpenSettings?: (ch: Channel) => void;
}

function ChannelRow({ ch, meta, isCurrent, reorderEnabled, onSelect, onOpenSettings }: ChannelRowProps) {
  const dragControls = useDragControls();
  const isUnread = !!meta?.unread;
  const emoji = (ch.icon && ch.icon !== 'hash') ? ch.icon : CHANNEL_EMOJI[ch.name];
  const hasPreview = !!meta?.lastMessage;

  // Truncate the last message — strip image-only URLs for cleaner preview
  let previewText = meta?.lastMessage || '';
  if (previewText) {
    const lines = previewText.split('\n').filter(l => l.trim());
    const firstTextLine = lines.find(l => !/^https?:\/\/\S+$/.test(l.trim()));
    previewText = firstTextLine || (lines.length > 0 ? '📷 Image' : '');
  }

  return (
    <Reorder.Item
      value={ch}
      dragListener={false}
      dragControls={dragControls}
      className="list-none"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        onClick={onSelect}
        className={cn(
          "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-colors duration-150 cursor-pointer group border border-transparent active:bg-muted/50 active:scale-[0.995]",
          isUnread
            ? "bg-muted/35 hover:bg-muted/45"
            : "hover:bg-muted/25",
        )}
      >
        {/* Icon tile */}
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-base flex-shrink-0 transition-colors relative",
          isUnread ? "bg-primary/12" : "bg-muted/40",
        )}>
          {emoji ? emoji : <Hash className="w-4 h-4 text-muted-foreground/60" />}
          {isCurrent && (
            <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-background" />
          )}
        </div>

        {/* Title + preview */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              "text-[14px] tracking-tight truncate",
              isUnread ? "font-bold text-foreground" : "font-semibold text-foreground/85",
            )}>
              {ch.name}
            </span>
            {meta?.lastMessageAt && (
              <span className={cn(
                "text-[10px] font-medium flex-shrink-0 tabular-nums",
                isUnread ? "text-primary font-semibold" : "text-muted-foreground/55",
              )}>
                {formatPreviewTime(meta.lastMessageAt)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            {hasPreview ? (
              <p className={cn(
                "text-[12px] truncate flex-1 min-w-0",
                isUnread ? "text-foreground/75 font-medium" : "text-muted-foreground/65",
              )}>
                {meta?.lastAuthor && <span className="font-semibold text-foreground/65">{meta.lastAuthor}: </span>}
                {previewText}
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground/45 truncate flex-1 italic">
                {ch.description || 'No messages yet'}
              </p>
            )}
            {isUnread && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
          </div>
        </div>

        {/* Drag handle — long-press to reorder. Hidden by default; visible on group-hover (desktop) or always when reorder enabled. */}
        {reorderEnabled && (
          <button
            onPointerDown={(e) => { e.stopPropagation(); dragControls.start(e); }}
            onClick={(e) => e.stopPropagation()}
            className="hidden lg:flex flex-shrink-0 items-center justify-center w-7 h-7 rounded-md opacity-0 group-hover:opacity-50 hover:!opacity-100 hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-opacity touch-none"
            title="Drag to reorder"
            aria-label="Drag to reorder"
          >
            <GripVertical className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}

        {/* Settings */}
        {onOpenSettings && (
          <button
            onClick={e => { e.stopPropagation(); onOpenSettings(ch); }}
            className="flex-shrink-0 p-1.5 rounded-md opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-muted/50 transition-opacity hidden lg:block"
            title="Channel settings"
            aria-label="Channel settings"
          >
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </Reorder.Item>
  );
}

export function ChannelList({
  channels, categories, channelMeta, selectedChannel,
  loading, onSelectChannel, onCreateChannel, onReorderChannels,
  onOpenSettings, onCreateCategory,
}: ChannelListProps) {
  const { setOpen: setNavOpen } = useNavDrawer();
  const [showNewChannel, setShowNewChannel] = useState(false);
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelCategory, setNewChannelCategory] = useState('');
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Sort channels within each category by most recent activity (unread/recent on top), preserving fallback to position
  const groupedChannels = categories.map(cat => {
    const chs = channels.filter(ch => ch.category_id === cat.id);
    const sorted = [...chs].sort((a, b) => {
      const ma = channelMeta.get(a.id);
      const mb = channelMeta.get(b.id);
      const ta = ma?.lastMessageAt ? new Date(ma.lastMessageAt).getTime() : 0;
      const tb = mb?.lastMessageAt ? new Date(mb.lastMessageAt).getTime() : 0;
      if (ta !== tb) return tb - ta;
      return a.position - b.position;
    });
    return { ...cat, channels: sorted };
  });

  const handleCreate = () => {
    if (!newChannelName.trim()) return;
    onCreateChannel(newChannelName.trim().toLowerCase().replace(/\s+/g, '-'), newChannelCategory || categories[0]?.id || '');
    setNewChannelName('');
    setShowNewChannel(false);
  };

  const handleCreateCat = () => {
    if (!newCategoryName.trim() || !onCreateCategory) return;
    onCreateCategory(newCategoryName.trim());
    setNewCategoryName('');
    setShowNewCategory(false);
  };

  return (
    <div
      className="px-3 pt-2 pb-6 lg:pb-4 lg:px-4"
      style={{ touchAction: 'pan-y', WebkitOverflowScrolling: 'touch' }}
    >
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        {/* Header */}
        <div className="flex items-center gap-2 border-b border-border/10 pb-3 mb-4 px-1">
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setNavOpen(true)}
            className="lg:hidden p-2 -ml-1 rounded-lg hover:bg-muted/40 active:bg-muted/60 min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-foreground/85" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight">Chat</h1>
            <p className="text-[11px] text-muted-foreground/50 font-medium mt-0.5">DH conversations</p>
          </div>
          <div className="flex items-center gap-1">
            {onCreateCategory && (
              <Button size="sm" variant="ghost" onClick={() => setShowNewCategory(true)} className="h-9 w-9 p-0 rounded-full hover:bg-muted/30" title="New Category" aria-label="New Category">
                <FolderPlus className="w-4 h-4" />
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={() => setShowNewChannel(true)} className="h-9 w-9 p-0 rounded-full hover:bg-muted/30" title="New Channel" aria-label="New Channel">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* New Category inline form */}
        <AnimatePresence>
          {showNewCategory && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-4">
              <div className="glass-card p-4 space-y-3">
                <h3 className="text-xs font-bold">New Category</h3>
                <Input placeholder="Category name" value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="h-9 text-sm" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateCat} disabled={!newCategoryName.trim()} className="flex-1 h-8 text-xs font-bold">Create</Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowNewCategory(false)} className="h-8 text-xs">Cancel</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

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

        <div className="space-y-4">
          {groupedChannels.map(group => (
            group.channels.length > 0 && (
              <div key={group.id}>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/60 px-2 mb-1.5">
                  {group.name}
                </p>
                <Reorder.Group
                  axis="y"
                  values={group.channels}
                  onReorder={(newOrder) => onReorderChannels?.(group.id, newOrder)}
                  className="space-y-0.5"
                >
                  {group.channels.map((ch) => (
                    <ChannelRow
                      key={ch.id}
                      ch={ch}
                      meta={channelMeta.get(ch.id)}
                      isCurrent={selectedChannel?.id === ch.id}
                      reorderEnabled={!!onReorderChannels}
                      onSelect={() => onSelectChannel(ch)}
                      onOpenSettings={onOpenSettings}
                    />
                  ))}
                </Reorder.Group>
              </div>
            )
          ))}
        </div>

        {loading && channels.length === 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/70 px-2 mb-1.5">
              <span className="inline-block h-2 w-16 rounded skeleton-shimmer" />
            </p>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
                <div className="w-10 h-10 rounded-xl skeleton-shimmer flex-shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 rounded-md w-24 skeleton-shimmer" />
                  <div className="h-2.5 rounded-md w-40 skeleton-shimmer" />
                </div>
                <div className="h-2.5 w-10 rounded skeleton-shimmer" />
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
