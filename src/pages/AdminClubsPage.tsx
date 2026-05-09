import { useEffect, useState, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { useClub } from '@/contexts/ClubContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Shield, Check, X, Building2, ArrowLeft, Users, Copy, MessageCircle } from 'lucide-react';

type Request = {
  id: string;
  requested_by: string;
  proposed_name: string;
  reason: string | null;
  status: string;
  created_at: string;
  profile?: { display_name: string };
};

type ClubRow = {
  id: string;
  name: string;
  slug: string;
  accent_color: string;
  status: string;
  member_count?: number;
};

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 48) || `club-${Date.now()}`;
}

function genCode(name: string) {
  const base = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'CLUB';
  const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `${base}-${suffix}`;
}

export default function AdminClubsPage() {
  const { isPlatformOwner, loading: clubLoading } = useClub();
  const [requests, setRequests] = useState<Request[]>([]);
  const [clubs, setClubs] = useState<ClubRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  const [actingId, setActingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: reqs }, { data: cbs }] = await Promise.all([
      (supabase as any)
        .from('club_requests')
        .select('id, requested_by, proposed_name, reason, status, created_at, profile:requested_by(display_name)')
        .order('created_at', { ascending: false }),
      (supabase as any)
        .from('clubs')
        .select('id, name, slug, accent_color, status')
        .order('created_at', { ascending: true }),
    ]);
    if (reqs) setRequests(reqs as Request[]);
    if (cbs) {
      // fetch member counts in parallel
      const ids = (cbs as ClubRow[]).map((c) => c.id);
      const counts = await Promise.all(
        ids.map((id) =>
          (supabase as any).from('club_members').select('id', { count: 'exact', head: true }).eq('club_id', id)
        )
      );
      const enriched = (cbs as ClubRow[]).map((c, i) => ({ ...c, member_count: counts[i].count ?? 0 }));
      setClubs(enriched);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!clubLoading && isPlatformOwner) void load();
  }, [clubLoading, isPlatformOwner, load]);

  if (clubLoading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="loading-spinner-ring" /></div>;
  }
  if (!isPlatformOwner) {
    return <Navigate to="/dashboard" replace />;
  }

  const approve = async (req: Request) => {
    setActingId(req.id);
    try {
      // Create the club
      const slug = slugify(req.proposed_name);
      const { data: newClub, error: clubErr } = await (supabase as any)
        .from('clubs')
        .insert({
          name: req.proposed_name,
          slug,
          accent_color: '152 72% 46%',
          owner_admin_id: req.requested_by,
          status: 'active',
        })
        .select()
        .maybeSingle();
      if (clubErr) throw clubErr;

      // Make requester the admin (one-club-per-account: insert; if user already in another club this fails)
      const { error: memErr } = await (supabase as any)
        .from('club_members')
        .insert({ club_id: newClub.id, user_id: req.requested_by, role: 'admin' });
      if (memErr) throw new Error('User is already a member of another club. They must leave it first.');

      // Generate an invite code for the new club
      await (supabase as any).from('invite_codes').insert({
        code: genCode(req.proposed_name),
        is_active: true,
        club_id: newClub.id,
      });

      // Mark request as approved
      await (supabase as any)
        .from('club_requests')
        .update({
          status: 'approved',
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes[req.id] || null,
        })
        .eq('id', req.id);

      toast.success(`${req.proposed_name} approved!`);
      await load();
    } catch (err: any) {
      toast.error(err.message ?? 'Approval failed');
    } finally {
      setActingId(null);
    }
  };

  const reject = async (req: Request) => {
    setActingId(req.id);
    const { error } = await (supabase as any)
      .from('club_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        review_notes: reviewNotes[req.id] || null,
      })
      .eq('id', req.id);
    if (error) toast.error(error.message);
    else { toast.success('Request rejected'); await load(); }
    setActingId(null);
  };

  const requestInfo = async (req: Request) => {
    const note = (reviewNotes[req.id] || '').trim();
    if (!note) {
      toast.error('Add a note explaining what info you need');
      return;
    }
    setActingId(req.id);
    const { error } = await (supabase as any).rpc('admin_set_request_needs_info', {
      _request_id: req.id,
      _admin_note: note,
    });
    if (error) toast.error(error.message);
    else { toast.success('User notified — waiting on their reply'); await load(); }
    setActingId(null);
  };

  const pending = requests.filter((r) => r.status === 'pending' || r.status === 'needs_info');
  const reviewed = requests.filter((r) => !['pending', 'needs_info'].includes(r.status));

  return (
    <div className="min-h-screen bg-background px-4 py-6" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl mx-auto"
      >
        <Link to="/profile" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 btn-press">
          <ArrowLeft className="w-4 h-4" /> Back to Profile
        </Link>

        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, hsl(var(--gold) / 0.22), hsl(var(--gold) / 0.06))',
              border: '1px solid hsl(var(--gold) / 0.3)',
            }}
          >
            <Shield className="w-5 h-5" style={{ color: 'hsl(var(--gold))' }} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: 'hsl(var(--gold))' }}>
              Platform Owner
            </p>
            <h1 className="text-lg font-extrabold leading-tight">Club Management</h1>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-10"><div className="loading-spinner-ring" /></div>
        ) : (
          <>
            {/* Pending requests */}
            <section className="mb-6">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 mb-2 px-1">
                Pending Requests {pending.length > 0 && <span className="ml-1 text-gold">({pending.length})</span>}
              </h2>
              {pending.length === 0 ? (
                <div className="glass-card p-5 text-center">
                  <p className="text-sm text-muted-foreground">No pending requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pending.map((req) => (
                    <div key={req.id} className="glass-card p-4 space-y-3">
                      <div>
                        <p className="text-base font-bold">{req.proposed_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          requested by {req.profile?.display_name ?? 'unknown'}
                        </p>
                      </div>
                      {req.reason && (
                        <p className="text-sm leading-relaxed bg-muted/30 rounded-lg p-3 break-words">
                          {req.reason}
                        </p>
                      )}
                      <Textarea
                        placeholder="Optional review notes (visible to requester)"
                        value={reviewNotes[req.id] ?? ''}
                        onChange={(e) => setReviewNotes((s) => ({ ...s, [req.id]: e.target.value }))}
                        rows={2}
                        className="form-input resize-none text-sm"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className="btn-press"
                          onClick={() => reject(req)}
                          disabled={actingId === req.id}
                        >
                          <X className="w-4 h-4 mr-1.5" /> Reject
                        </Button>
                        <Button
                          className="btn-press"
                          onClick={() => approve(req)}
                          disabled={actingId === req.id}
                        >
                          <Check className="w-4 h-4 mr-1.5" /> Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Active clubs */}
            <section className="mb-6">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 mb-2 px-1">
                All Clubs ({clubs.length})
              </h2>
              <div className="space-y-2">
                {clubs.map((c) => (
                  <div key={c.id} className="glass-card p-3 flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{
                        background: `linear-gradient(135deg, hsl(${c.accent_color} / 0.22), hsl(${c.accent_color} / 0.04))`,
                        border: `1px solid hsl(${c.accent_color} / 0.3)`,
                      }}
                    >
                      <Building2 className="w-5 h-5" style={{ color: `hsl(${c.accent_color})` }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold truncate">{c.name}</p>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                        <Users className="w-3 h-3" /> {c.member_count} members · {c.slug}
                      </p>
                    </div>
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
                      style={{
                        background: c.status === 'active' ? 'hsl(var(--primary) / 0.14)' : 'hsl(var(--muted) / 0.4)',
                        color: c.status === 'active' ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                      }}
                    >
                      {c.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            {/* Reviewed history */}
            {reviewed.length > 0 && (
              <section>
                <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground/80 mb-2 px-1">
                  Recent Reviews
                </h2>
                <div className="space-y-2">
                  {reviewed.slice(0, 10).map((req) => (
                    <div key={req.id} className="glass-card p-3 flex items-center gap-3 opacity-80">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold truncate">{req.proposed_name}</p>
                        <p className="text-[11px] text-muted-foreground">by {req.profile?.display_name ?? 'unknown'}</p>
                      </div>
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md"
                        style={{
                          background: req.status === 'approved' ? 'hsl(var(--primary) / 0.14)' : 'hsl(var(--destructive) / 0.14)',
                          color: req.status === 'approved' ? 'hsl(var(--primary))' : 'hsl(var(--destructive))',
                        }}
                      >
                        {req.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </motion.div>
    </div>
  );
}
