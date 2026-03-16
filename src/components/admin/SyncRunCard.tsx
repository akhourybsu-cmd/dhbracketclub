import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight, CheckCircle2, AlertTriangle, XCircle, SkipForward, Link2, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SyncRun {
  id: string;
  provider_name: string;
  sync_type: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  raw_summary: any;
}

interface SyncEvent {
  id: string;
  entity_type: string;
  entity_id: string | null;
  event_type: string;
  status: string;
  details: any;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  running: 'text-primary bg-primary/15',
  completed: 'text-success bg-success/15',
  completed_with_warnings: 'text-warning bg-warning/15',
  completed_with_errors: 'text-warning bg-warning/15',
  failed: 'text-destructive bg-destructive/15',
};

const EVENT_ICONS: Record<string, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  skipped: SkipForward,
};

const EVENT_COLORS: Record<string, string> = {
  success: 'text-success',
  error: 'text-destructive',
  skipped: 'text-muted-foreground',
};

function formatEventType(type: string): string {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function SummaryStats({ summary }: { summary: any }) {
  if (!summary) return null;

  // Extract key stats from raw_summary depending on sync type
  const stats: { label: string; value: string | number; color?: string }[] = [];

  // Full sync has nested objects
  const games = summary.games || summary;
  const results = summary.results || {};
  const standings = summary.standings || {};

  if (games.matched !== undefined) stats.push({ label: 'Matched', value: games.matched, color: 'text-success' });
  if (games.unmatched !== undefined && games.unmatched > 0) stats.push({ label: 'Unmatched', value: games.unmatched, color: 'text-warning' });
  if (games.updated !== undefined) stats.push({ label: 'Updated', value: games.updated, color: 'text-primary' });
  if (games.teamsResolved !== undefined) stats.push({ label: 'Teams', value: games.teamsResolved });
  if (results.newFinals !== undefined && results.newFinals > 0) stats.push({ label: 'New Finals', value: results.newFinals, color: 'text-success' });
  if (results.skippedFinal !== undefined && results.skippedFinal > 0) stats.push({ label: 'Skipped (final)', value: results.skippedFinal });
  if (standings.bracketsScored !== undefined) stats.push({ label: 'Brackets Scored', value: standings.bracketsScored });
  if (standings.standingsChanged !== undefined) stats.push({ label: 'Rankings Changed', value: standings.standingsChanged, color: standings.standingsChanged > 0 ? 'text-primary' : undefined });

  // Check for errors array
  const errors = games.errors || results.errors || [];
  if (Array.isArray(errors) && errors.length > 0) {
    stats.push({ label: 'Errors', value: errors.length, color: 'text-destructive' });
  }

  if (stats.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
      {stats.map((s, i) => (
        <div key={i} className="flex items-center gap-1">
          <span className="text-[9px] text-muted-foreground">{s.label}:</span>
          <span className={cn("text-[10px] font-bold tabular-nums", s.color || "text-foreground")}>{s.value}</span>
        </div>
      ))}
    </div>
  );
}

function EventRow({ event }: { event: SyncEvent }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const Icon = EVENT_ICONS[event.status] || AlertTriangle;
  const color = EVENT_COLORS[event.status] || 'text-muted-foreground';

  return (
    <div className="border-b border-border/10 last:border-0">
      <button
        onClick={() => event.details && setDetailsOpen(!detailsOpen)}
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-left",
          event.details && "hover:bg-secondary/30 cursor-pointer",
          !event.details && "cursor-default"
        )}
      >
        <Icon className={cn("w-3 h-3 flex-shrink-0", color)} />
        <span className="text-[10px] font-medium flex-1 truncate">
          {formatEventType(event.event_type)}
        </span>
        <span className="text-[9px] text-muted-foreground capitalize">{event.entity_type}</span>
        {event.details && (
          detailsOpen
            ? <ChevronDown className="w-2.5 h-2.5 text-muted-foreground" />
            : <ChevronRight className="w-2.5 h-2.5 text-muted-foreground" />
        )}
      </button>
      <AnimatePresence>
        {detailsOpen && event.details && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <pre className="text-[8px] bg-secondary/40 rounded mx-2 mb-1.5 p-1.5 overflow-x-auto whitespace-pre-wrap text-muted-foreground">
              {JSON.stringify(event.details, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SyncRunCard({ run }: { run: SyncRun }) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventsLoaded, setEventsLoaded] = useState(false);
  const [showRawJson, setShowRawJson] = useState(false);

  const loadEvents = useCallback(async () => {
    if (eventsLoaded) return;
    setLoadingEvents(true);
    const { data } = await supabase
      .from('sync_events')
      .select('*')
      .eq('sync_run_id', run.id)
      .order('created_at', { ascending: true })
      .limit(200);
    setEvents((data as SyncEvent[]) || []);
    setEventsLoaded(true);
    setLoadingEvents(false);
  }, [run.id, eventsLoaded]);

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && !eventsLoaded) loadEvents();
  };

  // Group events by status for quick overview
  const eventCounts = events.reduce((acc, e) => {
    acc[e.status] = (acc[e.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const errorEvents = events.filter(e => e.status === 'error');
  const skippedEvents = events.filter(e => e.status === 'skipped');
  const successEvents = events.filter(e => e.status === 'success');

  const duration = run.finished_at
    ? Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)
    : null;

  return (
    <div className={cn(
      "border rounded-lg overflow-hidden transition-colors",
      run.status === 'failed' ? 'border-destructive/30' :
      run.status.includes('error') || run.status.includes('warning') ? 'border-warning/30' :
      'border-border/30'
    )}>
      {/* Header */}
      <button onClick={handleToggle} className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-secondary/30 transition-colors">
        <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap", STATUS_COLORS[run.status] || 'text-muted-foreground bg-secondary')}>
          {run.status.replace(/_/g, ' ').toUpperCase()}
        </span>
        <span className="text-[11px] font-medium flex-1 truncate">{run.sync_type.replace(/([A-Z])/g, ' $1').trim()}</span>
        <div className="flex items-center gap-1.5">
          {duration !== null && (
            <span className="text-[9px] text-muted-foreground tabular-nums flex items-center gap-0.5">
              <Clock className="w-2.5 h-2.5" />{duration}s
            </span>
          )}
          <span className="text-[10px] text-muted-foreground tabular-nums">{new Date(run.started_at).toLocaleTimeString()}</span>
          {expanded ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </button>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="border-t border-border/20 px-3 py-3 space-y-3">
              {/* Meta row */}
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                <span>Provider: <strong className="text-foreground">{run.provider_name}</strong></span>
                <span>Started: <strong className="text-foreground">{new Date(run.started_at).toLocaleString()}</strong></span>
              </div>

              {/* Error message */}
              {run.error_message && (
                <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                  <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-destructive">{run.error_message}</p>
                </div>
              )}

              {/* Summary Stats */}
              <SummaryStats summary={run.raw_summary} />

              {/* Event counts bar */}
              {eventsLoaded && events.length > 0 && (
                <div className="flex items-center gap-2">
                  {eventCounts.success && (
                    <span className="flex items-center gap-1 text-[9px] text-success">
                      <CheckCircle2 className="w-3 h-3" />{eventCounts.success}
                    </span>
                  )}
                  {eventCounts.skipped && (
                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                      <SkipForward className="w-3 h-3" />{eventCounts.skipped}
                    </span>
                  )}
                  {eventCounts.error && (
                    <span className="flex items-center gap-1 text-[9px] text-destructive">
                      <XCircle className="w-3 h-3" />{eventCounts.error}
                    </span>
                  )}
                  <span className="text-[9px] text-muted-foreground ml-auto">{events.length} events</span>
                </div>
              )}

              {/* Loading state */}
              {loadingEvents && (
                <div className="flex justify-center py-3">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {/* Error events (shown first, always visible) */}
              {errorEvents.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-destructive uppercase tracking-wider mb-1">Errors ({errorEvents.length})</h4>
                  <div className="bg-destructive/5 border border-destructive/15 rounded-lg overflow-hidden">
                    {errorEvents.map(e => <EventRow key={e.id} event={e} />)}
                  </div>
                </div>
              )}

              {/* Skipped/unmatched events */}
              {skippedEvents.length > 0 && (
                <div>
                  <h4 className="text-[10px] font-semibold text-warning uppercase tracking-wider mb-1">Skipped / Unmatched ({skippedEvents.length})</h4>
                  <div className="bg-warning/5 border border-warning/15 rounded-lg overflow-hidden">
                    {skippedEvents.map(e => <EventRow key={e.id} event={e} />)}
                  </div>
                </div>
              )}

              {/* Success events (collapsed by default if many) */}
              {successEvents.length > 0 && (
                <ExpandableSection
                  title={`Successful (${successEvents.length})`}
                  titleClass="text-success"
                  defaultOpen={successEvents.length <= 5}
                >
                  <div className="bg-success/5 border border-success/15 rounded-lg overflow-hidden">
                    {successEvents.map(e => <EventRow key={e.id} event={e} />)}
                  </div>
                </ExpandableSection>
              )}

              {eventsLoaded && events.length === 0 && !loadingEvents && (
                <p className="text-[10px] text-muted-foreground italic">No detailed events recorded for this run.</p>
              )}

              {/* Raw JSON toggle */}
              {run.raw_summary && (
                <div>
                  <button onClick={() => setShowRawJson(!showRawJson)} className="text-[9px] text-muted-foreground hover:text-foreground transition-colors underline">
                    {showRawJson ? 'Hide' : 'Show'} raw JSON
                  </button>
                  <AnimatePresence>
                    {showRawJson && (
                      <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                        <pre className="text-[8px] bg-secondary/50 rounded p-2 overflow-x-auto whitespace-pre-wrap mt-1 max-h-60 overflow-y-auto">
                          {JSON.stringify(run.raw_summary, null, 2)}
                        </pre>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExpandableSection({ title, titleClass, defaultOpen, children }: {
  title: string;
  titleClass?: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button onClick={() => setOpen(!open)} className="flex items-center gap-1 mb-1">
        {open ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        <h4 className={cn("text-[10px] font-semibold uppercase tracking-wider", titleClass)}>{title}</h4>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
