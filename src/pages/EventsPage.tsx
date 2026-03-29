import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { CalendarDays, Plus, MapPin, Clock, Users, ChevronRight, X } from 'lucide-react';
import { format, isPast, isToday, isTomorrow, isThisWeek, addDays } from 'date-fns';
import { useSoundEffect } from '@/hooks/useSoundEffect';

type Event = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string | null;
  created_by: string;
  created_at: string;
  rsvp_count?: number;
  user_rsvp?: string | null;
  profiles?: { display_name: string };
};

export default function EventsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { play } = useSoundEffect();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', location: '', starts_at: '', ends_at: '' });

  useEffect(() => {
    fetchEvents();
  }, [user]);

  const fetchEvents = async () => {
    if (!user) return;
    const { data } = await supabase
      .from('events')
      .select('*, profiles:created_by(display_name)')
      .order('starts_at', { ascending: true });

    if (data) {
      // Get RSVPs
      const eventIds = data.map(e => e.id);
      let rsvpMap = new Map<string, number>();
      let userRsvpMap = new Map<string, string>();

      if (eventIds.length > 0) {
        const { data: rsvps } = await supabase
          .from('event_rsvps')
          .select('*')
          .in('event_id', eventIds);
        if (rsvps) {
          rsvps.forEach(r => {
            rsvpMap.set(r.event_id, (rsvpMap.get(r.event_id) || 0) + 1);
            if (r.user_id === user.id) userRsvpMap.set(r.event_id, r.status);
          });
        }
      }

      setEvents(data.map(e => ({
        ...e,
        rsvp_count: rsvpMap.get(e.id) || 0,
        user_rsvp: userRsvpMap.get(e.id) || null,
      })));
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.starts_at || !user) return;
    play('success');
    const { data, error } = await supabase.from('events').insert({
      title: form.title.trim(),
      description: form.description.trim() || null,
      location: form.location.trim() || null,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      created_by: user.id,
    }).select().single();

    if (data) {
      // Auto-RSVP creator as going
      await supabase.from('event_rsvps').insert({ event_id: data.id, user_id: user.id, status: 'going' });
      setShowCreate(false);
      setForm({ title: '', description: '', location: '', starts_at: '', ends_at: '' });
      navigate(`/events/${data.id}`);
    }
  };

  const handleRsvp = async (eventId: string, status: string) => {
    if (!user) return;
    play('tap');
    // Upsert
    const { data: existing } = await supabase
      .from('event_rsvps')
      .select('id, status')
      .eq('event_id', eventId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (existing) {
      if (existing.status === status) {
        await supabase.from('event_rsvps').delete().eq('id', existing.id);
      } else {
        await supabase.from('event_rsvps').update({ status }).eq('id', existing.id);
      }
    } else {
      await supabase.from('event_rsvps').insert({ event_id: eventId, user_id: user.id, status });
    }
    fetchEvents();
  };

  const getTimeLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    if (isPast(d)) return 'Past';
    if (isToday(d)) return 'Today';
    if (isTomorrow(d)) return 'Tomorrow';
    if (isThisWeek(d)) return format(d, 'EEEE');
    return format(d, 'MMM d');
  };

  const upcoming = events.filter(e => !isPast(new Date(e.starts_at)));
  const past = events.filter(e => isPast(new Date(e.starts_at)));

  return (
    <div className="pb-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-extrabold tracking-tight">Events</h1>
          <Button size="sm" onClick={() => setShowCreate(true)} className="h-8 gap-1.5 text-xs font-bold rounded-xl">
            <Plus className="w-3.5 h-3.5" /> New Event
          </Button>
        </div>

        {/* Create form */}
        <AnimatePresence>
          {showCreate && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden mb-6">
              <div className="glass-card p-4 space-y-3">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-bold">New Event</h3>
                  <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-muted/50"><X className="w-3.5 h-3.5" /></button>
                </div>
                <Input placeholder="Event title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="h-9 text-sm" />
                <Textarea placeholder="Description (optional)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className="text-sm min-h-[60px]" />
                <Input placeholder="Location (optional)" value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} className="h-9 text-sm" />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">Start</label>
                    <Input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} className="h-9 text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wider">End (optional)</label>
                    <Input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} className="h-9 text-xs" />
                  </div>
                </div>
                <Button onClick={handleCreate} disabled={!form.title.trim() || !form.starts_at} className="w-full h-9 text-xs font-bold">Create Event</Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <div className="mb-6">
            <h2 className="section-header mb-3">
              <CalendarDays className="w-3.5 h-3.5 inline-block mr-1.5 text-primary" />
              Upcoming
            </h2>
            <div className="space-y-2">
              {upcoming.map((event, i) => (
                <motion.div key={event.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Link to={`/events/${event.id}`} className="block group">
                    <div className="glass-card p-4 transition-all duration-200 group-hover:border-primary/15">
                      <div className="relative z-10">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-[14px] tracking-tight truncate">{event.title}</h3>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="flex items-center gap-1 text-[11px] text-primary font-semibold">
                                <Clock className="w-3 h-3" />
                                {getTimeLabel(event.starts_at)} · {format(new Date(event.starts_at), 'h:mm a')}
                              </span>
                              {event.location && (
                                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                                  <MapPin className="w-3 h-3" />
                                  {event.location}
                                </span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground/15 flex-shrink-0 mt-1" />
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground/40 font-medium flex items-center gap-1">
                            <Users className="w-3 h-3" /> {event.rsvp_count} going
                          </span>
                          <div className="flex gap-1">
                            {['going', 'maybe', 'pass'].map(status => (
                              <button
                                key={status}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRsvp(event.id, status); }}
                                className={cn(
                                  "px-2.5 py-1 rounded-lg text-[10px] font-bold capitalize transition-colors",
                                  event.user_rsvp === status
                                    ? status === 'going' ? 'bg-success/20 text-success' : status === 'maybe' ? 'bg-warning/20 text-warning' : 'bg-destructive/15 text-destructive'
                                    : 'bg-muted/30 text-muted-foreground/50 hover:bg-muted/50'
                                )}
                              >
                                {status === 'pass' ? '✕' : status}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {/* Past */}
        {past.length > 0 && (
          <div>
            <h2 className="section-header mb-3 text-muted-foreground/40">Past Events</h2>
            <div className="space-y-2 opacity-60">
              {past.slice(0, 5).map(event => (
                <Link key={event.id} to={`/events/${event.id}`} className="block">
                  <div className="glass-card p-3 transition-all duration-200 hover:border-border/20">
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-[13px] truncate">{event.title}</h3>
                        <p className="text-[10px] text-muted-foreground/40">{format(new Date(event.starts_at), 'MMM d, yyyy')}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {events.length === 0 && !loading && (
          <div className="text-center py-16">
            <CalendarDays className="w-10 h-10 mx-auto text-muted-foreground/15 mb-3" />
            <p className="text-sm text-muted-foreground/50 font-medium">No events yet</p>
            <p className="text-xs text-muted-foreground/30 mt-1">Plan something with the crew</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
