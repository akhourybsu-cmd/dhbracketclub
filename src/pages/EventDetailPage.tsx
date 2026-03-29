import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { CalendarDays, MapPin, Clock, Users, Send, Trash2, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { useSoundEffect } from '@/hooks/useSoundEffect';
import { toast } from 'sonner';

type RSVP = { id: string; user_id: string; status: string; profiles?: { display_name: string } };
type Comment = { id: string; user_id: string; content: string; created_at: string; profiles?: { display_name: string } };

export default function EventDetailPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { play } = useSoundEffect();
  const [event, setEvent] = useState<any>(null);
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!eventId) return;
    const fetch = async () => {
      const [{ data: ev }, { data: rs }, { data: cm }] = await Promise.all([
        supabase.from('events').select('*, profiles:created_by(display_name)').eq('id', eventId).single(),
        supabase.from('event_rsvps').select('*, profiles:user_id(display_name)').eq('event_id', eventId),
        supabase.from('event_comments').select('*, profiles:user_id(display_name)').eq('event_id', eventId).order('created_at'),
      ]);
      if (ev) setEvent(ev);
      if (rs) setRsvps(rs as RSVP[]);
      if (cm) setComments(cm as Comment[]);
      setLoading(false);
    };
    fetch();
  }, [eventId]);

  const handleRsvp = async (status: string) => {
    if (!user || !eventId) return;
    play('tap');
    const existing = rsvps.find(r => r.user_id === user.id);
    if (existing) {
      if (existing.status === status) {
        await supabase.from('event_rsvps').delete().eq('id', existing.id);
      } else {
        await supabase.from('event_rsvps').update({ status }).eq('id', existing.id);
      }
    } else {
      await supabase.from('event_rsvps').insert({ event_id: eventId, user_id: user.id, status });
    }
    const { data } = await supabase.from('event_rsvps').select('*, profiles:user_id(display_name)').eq('event_id', eventId);
    if (data) setRsvps(data as RSVP[]);
  };

  const handleComment = async () => {
    if (!newComment.trim() || !user || !eventId) return;
    play('tap');
    const content = newComment.trim();
    setNewComment('');
    await supabase.from('event_comments').insert({ event_id: eventId, user_id: user.id, content });
    const { data } = await supabase.from('event_comments').select('*, profiles:user_id(display_name)').eq('event_id', eventId).order('created_at');
    if (data) setComments(data as Comment[]);
  };

  const handleDelete = async () => {
    if (!eventId || !user) return;
    await supabase.from('event_comments').delete().eq('event_id', eventId);
    await supabase.from('event_rsvps').delete().eq('event_id', eventId);
    await supabase.from('events').delete().eq('id', eventId);
    toast.success('Event deleted');
    navigate('/events');
  };

  if (loading) return <div className="py-16 text-center text-muted-foreground/40 text-sm">Loading...</div>;
  if (!event) return <div className="py-16 text-center text-muted-foreground/40 text-sm">Event not found</div>;

  const userRsvp = rsvps.find(r => r.user_id === user?.id)?.status;
  const isCreator = user?.id === event.created_by;
  const goingList = rsvps.filter(r => r.status === 'going');
  const maybeList = rsvps.filter(r => r.status === 'maybe');

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <button onClick={() => navigate('/events')} className="flex items-center gap-1 text-xs text-muted-foreground/50 hover:text-foreground mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Events
        </button>

        <h1 className="text-xl font-extrabold tracking-tight mb-2">{event.title}</h1>

        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-2 text-[12px] text-primary font-semibold">
            <Clock className="w-3.5 h-3.5" />
            {format(new Date(event.starts_at), 'EEEE, MMMM d · h:mm a')}
            {event.ends_at && ` — ${format(new Date(event.ends_at), 'h:mm a')}`}
          </div>
          {event.location && (
            <div className="flex items-center gap-2 text-[12px] text-muted-foreground/60">
              <MapPin className="w-3.5 h-3.5" /> {event.location}
            </div>
          )}
          {event.description && (
            <p className="text-[13px] text-foreground/70 leading-relaxed mt-3">{event.description}</p>
          )}
          <p className="text-[10px] text-muted-foreground/30 mt-1">Created by {event.profiles?.display_name}</p>
        </div>

        {/* RSVP buttons */}
        <div className="flex gap-2 mb-6">
          {['going', 'maybe', 'pass'].map(status => (
            <Button
              key={status}
              variant="ghost"
              size="sm"
              onClick={() => handleRsvp(status)}
              className={cn(
                "flex-1 h-9 text-xs font-bold capitalize rounded-xl transition-colors",
                userRsvp === status
                  ? status === 'going' ? 'bg-success/20 text-success border border-success/30'
                    : status === 'maybe' ? 'bg-warning/20 text-warning border border-warning/30'
                    : 'bg-destructive/15 text-destructive border border-destructive/30'
                  : 'bg-muted/30 text-muted-foreground/50 border border-transparent'
              )}
            >
              {status === 'pass' ? 'Can\'t go' : status}
            </Button>
          ))}
        </div>

        {/* Attendees */}
        {goingList.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">
              Going ({goingList.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {goingList.map(r => (
                <span key={r.id} className="px-2.5 py-1 rounded-lg bg-success/10 text-[11px] font-semibold text-success/80">
                  {r.profiles?.display_name}
                </span>
              ))}
            </div>
          </div>
        )}
        {maybeList.length > 0 && (
          <div className="mb-6">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 mb-2">
              Maybe ({maybeList.length})
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {maybeList.map(r => (
                <span key={r.id} className="px-2.5 py-1 rounded-lg bg-warning/10 text-[11px] font-semibold text-warning/80">
                  {r.profiles?.display_name}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Discussion */}
        <div className="border-t border-border/10 pt-4">
          <h3 className="text-[13px] font-bold mb-3">Discussion</h3>
          <div className="space-y-3 mb-4">
            {comments.map(c => (
              <div key={c.id} className="flex gap-2.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0 mt-0.5" style={{
                  background: `linear-gradient(135deg, hsl(${c.user_id.charCodeAt(0) % 360} 60% 45%), hsl(${c.user_id.charCodeAt(1) % 360} 50% 35%))`,
                }}>
                  {(c.profiles?.display_name || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-foreground/80">{c.profiles?.display_name}</span>
                    <span className="text-[9px] text-muted-foreground/30">{format(new Date(c.created_at), 'MMM d · h:mm a')}</span>
                  </div>
                  <p className="text-[12px] text-foreground/70 leading-relaxed">{c.content}</p>
                </div>
              </div>
            ))}
            {comments.length === 0 && <p className="text-xs text-muted-foreground/30">No comments yet</p>}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleComment()}
              placeholder="Add a comment..."
              className="flex-1 h-9 text-xs bg-muted/30 border-border/10"
            />
            <Button size="sm" onClick={handleComment} disabled={!newComment.trim()} className="h-9 w-9 p-0 rounded-xl">
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* Delete */}
        {isCreator && (
          <div className="mt-8 pt-4 border-t border-border/10">
            <Button variant="ghost" size="sm" onClick={handleDelete} className="text-destructive/60 hover:text-destructive text-xs h-8">
              <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete Event
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
