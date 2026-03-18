import { useEffect, useState, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, Save, RefreshCw, Settings, Copy } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

const DEFAULT_SCORING = [
  { round_number: 1, points_per_correct_pick: 1 },
  { round_number: 2, points_per_correct_pick: 2 },
  { round_number: 3, points_per_correct_pick: 4 },
  { round_number: 4, points_per_correct_pick: 8 },
  { round_number: 5, points_per_correct_pick: 16 },
  { round_number: 6, points_per_correct_pick: 32 },
];

const ROUND_LABELS = ['Round of 64', 'Round of 32', 'Sweet 16', 'Elite 8', 'Final Four', 'Championship'];

export default function PoolSettingsPage() {
  const { poolId } = useParams<{ poolId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [lockTime, setLockTime] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [visibility, setVisibility] = useState('private');
  const [allowLateEntries, setAllowLateEntries] = useState(false);
  const [scoringRules, setScoringRules] = useState<{ id?: string; round_number: number; points_per_correct_pick: number }[]>([]);

  const fetchPool = useCallback(async () => {
    if (!poolId || !user) return;

    // Admin guard
    const { data: membership } = await supabase
      .from('pool_members')
      .select('role')
      .eq('pool_id', poolId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (membership?.role !== 'admin') {
      toast.error("You don't have access to pool settings.");
      navigate(`/pools/${poolId}`, { replace: true });
      return;
    }
    setIsAdmin(true);

    const [{ data: pool }, { data: rules }] = await Promise.all([
      supabase.from('pools').select('*').eq('id', poolId).single(),
      supabase.from('scoring_rules').select('*').eq('pool_id', poolId).order('round_number'),
    ]);

    if (pool) {
      setName(pool.name);
      setDescription(pool.description || '');
      setInviteCode(pool.invite_code);
      setVisibility(pool.visibility || 'private');
      // Format lock_time for datetime-local input
      const lt = new Date(pool.lock_time);
      setLockTime(toLocalDatetimeString(lt));
    }

    if (rules && rules.length > 0) {
      setScoringRules(rules);
    } else {
      setScoringRules(DEFAULT_SCORING);
    }

    setLoading(false);
  }, [poolId, user, navigate]);

  useEffect(() => { fetchPool(); }, [fetchPool]);

  const toLocalDatetimeString = (d: Date) => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const handleSave = async () => {
    if (!poolId) return;
    setSaving(true);
    try {
      const lockDate = new Date(lockTime);
      if (isNaN(lockDate.getTime())) throw new Error('Invalid lock time');

      const { error: poolError } = await supabase
        .from('pools')
        .update({
          name: name.trim(),
          description: description.trim() || null,
          lock_time: lockDate.toISOString(),
          visibility,
        })
        .eq('id', poolId);

      if (poolError) throw poolError;

      // Update scoring rules
      for (const rule of scoringRules) {
        if (rule.id) {
          await supabase
            .from('scoring_rules')
            .update({ points_per_correct_pick: rule.points_per_correct_pick })
            .eq('id', rule.id);
        }
      }

      if (user) {
        await supabase.from('admin_logs').insert({
          pool_id: poolId,
          actor_user_id: user.id,
          action_type: 'pool_settings_updated',
          action_payload: { name: name.trim(), lock_time: lockDate.toISOString(), visibility },
        });
      }

      toast.success('Settings saved!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const regenerateInviteCode = async () => {
    if (!poolId) return;
    const newCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('pools').update({ invite_code: newCode }).eq('id', poolId);
    if (error) {
      toast.error('Failed to regenerate code');
    } else {
      setInviteCode(newCode);
      toast.success('New invite code generated!');
    }
  };

  const copyInviteCode = () => {
    navigator.clipboard.writeText(inviteCode);
    toast.success('Copied!');
  };

  const updateScoringRule = (roundNumber: number, value: string) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 0) return;
    setScoringRules(prev =>
      prev.map(r => r.round_number === roundNumber ? { ...r, points_per_correct_pick: num } : r)
    );
  };

  if (loading || !isAdmin) {
    return (
      <div className="loading-spinner">
        <div className="loading-spinner-ring" />
        <p className="loading-spinner-text">Loading settings…</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto">
      <Link to={`/pools/${poolId}`} className="back-link">
        <ArrowLeft /> Back to Pool
      </Link>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="page-header">
          <div className="page-header-icon"><Settings /></div>
          <div>
            <h1 className="page-header-title">Pool Settings</h1>
            <p className="page-header-subtitle">Edit pool details and rules</p>
          </div>
        </div>
      </motion.div>

      {/* Pool Details */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5 mb-5">
        <h2 className="section-header mb-4">Pool Details</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">Pool Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Pool name"
              maxLength={50}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Description <span className="normal-case font-normal tracking-normal">(optional)</span></label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this pool about?"
              maxLength={200}
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Picks Lock Time</label>
            <Input
              type="datetime-local"
              value={lockTime}
              onChange={(e) => setLockTime(e.target.value)}
              className="form-input"
            />
            <p className="text-[10px] text-muted-foreground mt-1">After this time, brackets can no longer be edited.</p>
          </div>
          <div>
            <label className="form-label">Visibility</label>
            <div className="flex gap-2">
              {['private', 'public'].map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setVisibility(v)}
                  className={`flex-1 py-2.5 rounded-lg text-xs font-bold capitalize transition-all ${
                    visibility === v
                      ? 'bg-primary text-primary-foreground shadow-md'
                      : 'bg-secondary text-muted-foreground'
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Invite Code */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-5 mb-5">
        <h2 className="section-header mb-4">Invite Code</h2>
        <div className="inset-panel p-4 mb-3">
          <div className="flex items-center justify-center gap-3">
            <span className="text-2xl font-mono font-extrabold tracking-[0.3em] text-primary">{inviteCode}</span>
            <button onClick={copyInviteCode} className="p-2.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors btn-press">
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={regenerateInviteCode}
          className="w-full gap-2 h-10 rounded-xl text-[12px] font-bold btn-press"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Generate New Code
        </Button>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">Previous code will stop working immediately.</p>
      </motion.div>

      {/* Scoring Rules */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass-card p-5 mb-7">
        <h2 className="section-header mb-4">Scoring Rules</h2>
        <p className="text-[10px] text-muted-foreground mb-4">Points awarded per correct pick in each round.</p>
        <div className="space-y-3">
          {scoringRules.map((rule) => (
            <div key={rule.round_number} className="flex items-center gap-3">
              <span className="text-[11px] font-semibold text-muted-foreground w-28 flex-shrink-0">
                {ROUND_LABELS[rule.round_number - 1] || `Round ${rule.round_number}`}
              </span>
              <Input
                type="number"
                min={0}
                value={rule.points_per_correct_pick}
                onChange={(e) => updateScoringRule(rule.round_number, e.target.value)}
                className="form-input w-20 text-center font-mono font-bold"
              />
              <span className="text-[10px] text-muted-foreground">pts</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Save Button */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Button
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full h-12 rounded-xl font-bold btn-press gap-2 text-[13px]"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </Button>
      </motion.div>
    </div>
  );
}
