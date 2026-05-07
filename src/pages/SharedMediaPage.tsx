import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Link2, Image as ImageIcon, Play, Music, Globe, ExternalLink, Loader2, Filter, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { UserAvatar } from '@/components/chat/UserAvatar';
import { ChatAttachmentImage } from '@/components/chat/ChatAttachmentImage';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type MediaType = 'all' | 'link' | 'image' | 'youtube' | 'spotify';

interface MediaItem {
  id: string;
  url: string;
  content_type: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  site_name: string | null;
  embed_type: string | null;
  embed_id: string | null;
  created_at: string;
  message_id: string;
  channel_id?: string;
  user_id?: string;
  sender_name?: string;
  sender_avatar?: string | null;
  channel_name?: string;
}

const TYPE_TABS: { value: MediaType; label: string; icon: React.ElementType }[] = [
  { value: 'all', label: 'All', icon: Globe },
  { value: 'link', label: 'Links', icon: Link2 },
  { value: 'image', label: 'Images', icon: ImageIcon },
  { value: 'youtube', label: 'YouTube', icon: Play },
  { value: 'spotify', label: 'Spotify', icon: Music },
];

export default function SharedMediaPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<MediaType>('all');
  const [channels, setChannels] = useState<{ id: string; name: string }[]>([]);
  const [filterChannel, setFilterChannel] = useState<string>('all');

  const fetchMedia = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      let query = supabase
        .from('message_link_previews')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (activeType !== 'all') {
        query = query.eq('content_type', activeType);
      }

      const { data: previews } = await query;
      if (!previews || previews.length === 0) {
        setItems([]);
        setLoading(false);
        return;
      }

      const messageIds = [...new Set(previews.map(p => p.message_id))];
      const { data: messagesData } = await supabase
        .from('messages')
        .select('id, channel_id, user_id, profiles:user_id(display_name, avatar_url)')
        .in('id', messageIds);

      const msgMap = new Map<string, any>();
      (messagesData || []).forEach((m: any) => msgMap.set(m.id, m));

      const channelIds = [...new Set((messagesData || []).map((m: any) => m.channel_id).filter(Boolean))];
      const { data: chData } = channelIds.length > 0
        ? await supabase.from('channels').select('id, name').in('id', channelIds)
        : { data: [] };
      const chMap = new Map((chData || []).map(c => [c.id, c.name]));

      let result: MediaItem[] = previews.map((p: any) => {
        const msg = msgMap.get(p.message_id);
        return {
          ...p,
          channel_id: msg?.channel_id,
          user_id: msg?.user_id,
          sender_name: msg?.profiles?.display_name || 'Unknown',
          sender_avatar: msg?.profiles?.avatar_url || null,
          channel_name: chMap.get(msg?.channel_id) || 'Unknown',
        };
      });

      // Apply channel filter client-side
      if (filterChannel !== 'all') {
        result = result.filter(item => item.channel_id === filterChannel);
      }

      // Client-side dedup by (message_id, url) as safety net
      const seen = new Set<string>();
      result = result.filter(item => {
        const key = `${item.message_id}:${item.url}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      setItems(result);
    } catch (err) {
      console.error('SharedMedia fetch error:', err);
      setItems([]);
    }

    setLoading(false);
  }, [user, activeType, filterChannel]);

  useEffect(() => { fetchMedia(); }, [fetchMedia]);

  // Fetch channels once
  useEffect(() => {
    supabase.from('channels').select('id, name').order('position').then(({ data }) => {
      if (data) setChannels(data);
    });
  }, []);

  const handleDelete = async (itemId: string) => {
    const { error } = await supabase.from('message_link_previews').delete().eq('id', itemId);
    if (error) {
      toast.error('Failed to remove');
    } else {
      setItems(prev => prev.filter(i => i.id !== itemId));
      toast.success('Removed from shared');
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'youtube': return <Play className="w-3 h-3 text-[#FF0000]" />;
      case 'spotify': return <Music className="w-3 h-3 text-[#1DB954]" />;
      case 'image': return <ImageIcon className="w-3 h-3 text-primary/70" />;
      default: return <Link2 className="w-3 h-3 text-muted-foreground/60" />;
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight">Shared</h1>
        <p className="text-xs text-muted-foreground/60 mt-0.5">Links and media shared across all channels</p>
      </div>

      {/* Type filter tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TYPE_TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeType === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setActiveType(tab.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-semibold whitespace-nowrap transition-all duration-150",
                active
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : "bg-muted/15 text-muted-foreground/60 border border-border/10 hover:bg-muted/30 hover:text-foreground/70"
              )}
            >
              <Icon className="w-3 h-3" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Channel filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-3.5 h-3.5 text-muted-foreground/40" />
        <Select value={filterChannel} onValueChange={setFilterChannel}>
          <SelectTrigger className="h-8 text-xs w-[180px] bg-muted/15 border-border/20">
            <SelectValue placeholder="All channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All channels</SelectItem>
            {channels.map(ch => (
              <SelectItem key={ch.id} value={ch.id}>#{ch.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Media grid */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 text-muted-foreground/40 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, hsl(var(--muted) / 0.4), hsl(var(--muted) / 0.15))' }}>
            <Link2 className="w-6 h-6 text-muted-foreground/40" />
          </div>
          <p className="text-sm text-muted-foreground/60 font-medium">No shared media yet</p>
          <p className="text-[11px] text-muted-foreground/40 mt-1">Links and media shared in chat will appear here</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <MediaItemCard key={item.id} item={item} getTypeIcon={getTypeIcon} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

function MediaItemCard({ item, getTypeIcon, onDelete }: { item: MediaItem; getTypeIcon: (type: string) => React.ReactNode; onDelete: (id: string) => void }) {
  const isPrivateImage = item.content_type === 'image' && item.url.startsWith('lovable-private://');
  let hostname = '';
  try { hostname = new URL(item.url).hostname.replace(/^www\./, ''); } catch {}

  // For private attachments, the outer anchor href can't be the sentinel.
  // Disable the outer anchor; the thumbnail itself opens the signed URL.
  const Wrapper: any = isPrivateImage ? 'div' : 'a';
  const wrapperProps = isPrivateImage
    ? { className: 'block' }
    : { href: item.url, target: '_blank', rel: 'noopener noreferrer', className: 'block' };

  return (
    <div className="glass-card p-3.5 hover:bg-muted/15 transition-colors group relative">
      <Wrapper {...wrapperProps}>
        <div className="flex gap-3 relative z-10">
          {/* Thumbnail */}
          {item.content_type === 'image' ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted/20">
              {isPrivateImage ? (
                <ChatAttachmentImage url={item.url} className="!max-w-none !max-h-none w-full h-full !rounded-none !border-0" />
              ) : (
                <img src={item.url} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
            </div>
          ) : item.content_type === 'youtube' && item.embed_id ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-black/30 relative">
              <img src={`https://img.youtube.com/vi/${item.embed_id}/mqdefault.jpg`} alt="" className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-6 h-6 rounded-full bg-[#FF0000] flex items-center justify-center">
                  <Play className="w-3 h-3 text-white fill-white ml-px" />
                </div>
              </div>
            </div>
          ) : item.image_url ? (
            <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-muted/20">
              <img src={item.image_url} alt="" className="w-full h-full object-cover" loading="lazy" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          ) : (
            <div className="w-16 h-16 rounded-lg flex-shrink-0 bg-muted/12 flex items-center justify-center">
              {getTypeIcon(item.content_type)}
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0 space-y-0.5">
            <p className="text-[12px] font-semibold text-foreground/85 leading-tight line-clamp-1 group-hover:text-primary transition-colors">
              {item.title || hostname || 'Link'}
            </p>
            {item.description && (
              <p className="text-[10px] text-muted-foreground/50 leading-snug line-clamp-1">{item.description}</p>
            )}
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1 text-[9px] text-muted-foreground/40">
                {getTypeIcon(item.content_type)}
                {hostname}
              </span>
              {item.channel_name && (
                <>
                  <span className="text-[8px] text-muted-foreground/30">•</span>
                  <span className="text-[9px] text-muted-foreground/40">#{item.channel_name}</span>
                </>
              )}
              <span className="text-[8px] text-muted-foreground/30">•</span>
              <span className="text-[9px] text-muted-foreground/35">{format(new Date(item.created_at), 'MMM d')}</span>
            </div>
            {item.sender_name && (
              <div className="flex items-center gap-1.5 mt-1">
                <UserAvatar userId={item.user_id || ''} name={item.sender_name} avatarUrl={item.sender_avatar} size={14} />
                <span className="text-[9px] text-muted-foreground/40 font-medium">{item.sender_name}</span>
              </div>
            )}
          </div>

          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground/20 group-hover:text-muted-foreground/50 transition-colors flex-shrink-0 mt-0.5" />
        </div>
      </Wrapper>

      {/* Delete button */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(item.id); }}
        className="absolute top-2.5 right-2.5 p-1.5 rounded-lg bg-destructive/10 text-destructive/60 hover:bg-destructive/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all z-20"
        title="Remove from shared"
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}
