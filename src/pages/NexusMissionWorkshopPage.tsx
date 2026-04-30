// Nexus Defense — Mission Workshop (admin-only)
//
// v1 scope: tune Co-op Operation phase targets and Endless scaling curve;
// list/apply/archive drafts. Wave editor + custom missions are follow-ups.
// Simulator → Workshop hand-off via location.state.

import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Wrench, FlaskConical, Save, Upload, Trash2, AlertTriangle, CheckCircle2, Plus, Copy, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  DraftKind, MissionDraftRow,
  EndlessDraftConfig, OperationDraftConfig,
  DEFAULT_ENDLESS_SCALING, DEFAULT_OPERATION_CONFIG,
  defaultEndlessDraftConfig,
  listDrafts, getLiveDraft, createDraft, updateDraft, deleteDraft, applyDraftLive,
  validateEndlessConfig, validateOperationConfig, refreshLiveEndlessCache, clearLiveEndlessCache,
} from '@/lib/nexus/missionDrafts';

type Tab = DraftKind;

interface SimContext {
  source?: 'simulator';
  strategy?: string;
  verdict?: string;
  diagnostics?: string[];
  recommendations?: string[];
  operationPacing?: any;
  avgUnspentAtEnd?: number;
}

export default function NexusMissionWorkshopPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const simCtx = (location.state ?? {}) as SimContext;

  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [tab, setTab] = useState<Tab>(simCtx.source === 'simulator' ? 'endless' : 'operation');
  const [drafts, setDrafts] = useState<MissionDraftRow[]>([]);
  const [liveRow, setLiveRow] = useState<MissionDraftRow | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Admin guard
  useEffect(() => {
    if (!user) return;
    (supabase as any).from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
      .then(({ data }: any) => {
        if (data) setAuthorized(true);
        else { setAuthorized(false); toast.error('Admin only'); navigate('/nexus', { replace: true }); }
      });
  }, [user, navigate]);

  const refresh = async () => {
    setLoading(true);
    try {
      const [list, live] = await Promise.all([listDrafts(tab), getLiveDraft(tab)]);
      setDrafts(list);
      setLiveRow(live);
      if (!activeId && list.length > 0) setActiveId(list[0].id);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (authorized) refresh(); /* eslint-disable-next-line */ }, [authorized, tab]);

  const active = useMemo(() => drafts.find(d => d.id === activeId) ?? null, [drafts, activeId]);

  const handleNew = async () => {
    if (!user) return;
    try {
      const cfg = tab === 'endless' ? defaultEndlessDraftConfig() : DEFAULT_OPERATION_CONFIG;
      const name = tab === 'endless'
        ? `Endless draft ${new Date().toLocaleDateString()}`
        : `Operation draft ${new Date().toLocaleDateString()}`;
      const row = await createDraft({ kind: tab, name, config: cfg, userId: user.id });
      await refresh();
      setActiveId(row.id);
      toast.success('Draft created');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDuplicateLive = async () => {
    if (!user) { toast.error('Not signed in'); return; }
    if (!liveRow) { toast.error('No live config to duplicate'); return; }
    try {
      const row = await createDraft({
        kind: tab,
        name: `${liveRow.name} (copy)`,
        config: liveRow.config,
        parent_id: liveRow.id,
        userId: user.id,
      });
      await refresh();
      setActiveId(row.id);
      toast.success('Duplicated live config');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSave = async (patch: Partial<MissionDraftRow>) => {
    if (!active) return;
    setSaving(true);
    try {
      await updateDraft(active.id, patch as any);
      await refresh();
      toast.success('Draft saved');
    } catch (e: any) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!active) return;
    if (active.status === 'live') { toast.error('Archive or replace the live config first.'); return; }
    if (!confirm(`Delete "${active.name}"? This cannot be undone.`)) return;
    try {
      await deleteDraft(active.id);
      setActiveId(null);
      await refresh();
      toast.success('Draft deleted');
    } catch (e: any) { toast.error(e.message); }
  };

  const handleApplyLive = async () => {
    if (!active) return;
    const issues = tab === 'endless'
      ? validateEndlessConfig(active.config)
      : validateOperationConfig(active.config);
    const errors = issues.filter(i => i.level === 'error');
    if (errors.length) { toast.error(`Fix ${errors.length} error(s) first.`); return; }
    const summary = tab === 'endless'
      ? `Apply this Endless config to live? In-progress runs keep their config; new runs use this one.`
      : `Apply this Operation config to live? Phase targets will update on the active operation immediately.`;
    if (!confirm(summary)) return;
    try {
      await applyDraftLive(active.id, true);
      clearLiveEndlessCache();
      await refreshLiveEndlessCache();
      await refresh();
      toast.success('Applied to live');
    } catch (e: any) { toast.error(e.message); }
  };

  if (authorized === null) {
    return <div className="min-h-screen flex items-center justify-center"><div className="loading-spinner-ring" /></div>;
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      <header className="sticky top-0 z-10 backdrop-blur border-b border-border/40 bg-background/80">
        <div className="px-4 py-3 flex items-center gap-3">
          <Link to="/nexus/balance" className="p-1.5 -ml-1.5 rounded-lg hover:bg-muted active:scale-95 transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-emerald-400" />
              <h1 className="font-semibold truncate">Mission Workshop</h1>
            </div>
            <p className="text-xs text-muted-foreground truncate">Tune Endless &amp; Co-op safely · Admin only</p>
          </div>
          <Link to="/nexus/simulator" className="px-2.5 py-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-1.5 active:scale-95">
            <FlaskConical className="w-3.5 h-3.5" /> Simulator
          </Link>
        </div>
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-2">
            <TabBtn active={tab === 'operation'} onClick={() => { setTab('operation'); setActiveId(null); }}>Co-op Operation</TabBtn>
            <TabBtn active={tab === 'endless'} onClick={() => { setTab('endless'); setActiveId(null); }}>Endless</TabBtn>
          </div>
        </div>
      </header>

      <main className="px-4 py-4 space-y-4 max-w-2xl mx-auto">
        {/* Simulator hand-off */}
        {simCtx.source === 'simulator' && (simCtx.diagnostics?.length || simCtx.recommendations?.length) ? (
          <section className="rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-2 text-emerald-200 text-sm font-semibold">
              <Sparkles className="w-4 h-4" /> From Simulator · {simCtx.strategy}
            </div>
            {simCtx.verdict && <p className="mt-1 text-xs text-emerald-100/80">Verdict: <span className="font-semibold">{simCtx.verdict}</span></p>}
            {simCtx.diagnostics?.length ? (
              <ul className="mt-2 space-y-1 text-xs text-foreground/80">
                {simCtx.diagnostics.map((d, i) => <li key={i}>• {d}</li>)}
              </ul>
            ) : null}
            {simCtx.recommendations?.length ? (
              <>
                <div className="mt-3 text-xs font-semibold text-amber-200">Recommended changes</div>
                <ul className="mt-1 space-y-1 text-xs text-foreground/85">
                  {simCtx.recommendations.map((r, i) => <li key={i}>→ {r}</li>)}
                </ul>
                <p className="mt-2 text-[11px] text-muted-foreground">Edit the active draft below, then Apply Live to deploy. Recommendations are advisory — nothing auto-applies.</p>
              </>
            ) : null}
          </section>
        ) : null}

        {/* Drafts list + status */}
        <section className="rounded-2xl border border-border/60 bg-card/60 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <div className="text-sm font-semibold">Drafts</div>
              <div className="text-[11px] text-muted-foreground">
                Live: {liveRow ? <span className="text-emerald-300">{liveRow.name}</span> : <span className="text-muted-foreground">(none — defaults in code)</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleDuplicateLive} disabled={!liveRow} className="px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/60 text-xs flex items-center gap-1.5 disabled:opacity-40">
                <Copy className="w-3.5 h-3.5" /> From live
              </button>
              <button onClick={handleNew} className="px-2.5 py-1.5 rounded-lg bg-emerald-500 text-emerald-950 text-xs font-semibold flex items-center gap-1.5 active:scale-95">
                <Plus className="w-3.5 h-3.5" /> New
              </button>
            </div>
          </div>
          {loading ? (
            <div className="text-xs text-muted-foreground py-4">Loading…</div>
          ) : drafts.length === 0 ? (
            <div className="text-xs text-muted-foreground py-4 text-center">No drafts yet. Create one, or duplicate the live config.</div>
          ) : (
            <div className="space-y-2">
              {drafts.map(d => (
                <button
                  key={d.id}
                  onClick={() => setActiveId(d.id)}
                  className={cn(
                    'w-full px-3 py-2.5 rounded-xl border text-left flex items-center justify-between gap-2 active:scale-[0.99]',
                    activeId === d.id ? 'border-emerald-500/60 bg-emerald-500/10' : 'border-border/60 bg-background/40',
                  )}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{d.name}</div>
                    <div className="text-[11px] text-muted-foreground">v{d.version} · {new Date(d.updated_at).toLocaleString()}</div>
                  </div>
                  <StatusPill status={d.status} />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* Active draft editor */}
        {active && tab === 'operation' && (
          <OperationEditor draft={active} onSave={handleSave} saving={saving} simCtx={simCtx} />
        )}
        {active && tab === 'endless' && (
          <EndlessEditor draft={active} onSave={handleSave} saving={saving} />
        )}

        {/* Action bar */}
        {active && (
          <div className="sticky bottom-3 z-10">
            <div className="rounded-2xl border border-border/60 bg-card/95 backdrop-blur p-3 flex gap-2 shadow-xl">
              <button onClick={handleDelete} className="px-3 py-2.5 rounded-xl bg-rose-500/10 border border-rose-500/40 text-rose-200 text-xs flex items-center gap-1.5 active:scale-95">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
              <button
                onClick={handleApplyLive}
                disabled={active.status === 'live'}
                className="flex-1 px-3 py-2.5 rounded-xl bg-emerald-500 text-emerald-950 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98] disabled:opacity-40"
              >
                <Upload className="w-4 h-4" />
                {active.status === 'live' ? 'Currently Live' : 'Apply Live'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

/* ─────────────────── Sub-components ─────────────────── */

function TabBtn({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-3 py-2 rounded-lg text-sm border transition active:scale-[0.98]',
        active ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-200' : 'border-border/60 bg-background/40 text-foreground/80',
      )}
    >
      {children}
    </button>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls = status === 'live'
    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
    : status === 'archived'
      ? 'bg-muted/40 text-muted-foreground border-border/60'
      : 'bg-amber-500/10 text-amber-200 border-amber-500/40';
  return <span className={cn('px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide border font-semibold', cls)}>{status}</span>;
}

function ValidationList({ issues }: { issues: { level: 'error' | 'warn'; message: string }[] }) {
  if (!issues.length) {
    return <div className="text-xs text-emerald-300 flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> No issues</div>;
  }
  return (
    <ul className="space-y-1">
      {issues.map((i, idx) => (
        <li key={idx} className={cn('text-xs flex items-start gap-1.5', i.level === 'error' ? 'text-rose-300' : 'text-amber-200')}>
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {i.message}
        </li>
      ))}
    </ul>
  );
}

function OperationEditor({ draft, onSave, saving, simCtx }: { draft: MissionDraftRow; onSave: (p: any) => void; saving: boolean; simCtx: SimContext }) {
  const [cfg, setCfg] = useState<OperationDraftConfig>({ ...DEFAULT_OPERATION_CONFIG, ...(draft.config ?? {}) });
  const [name, setName] = useState(draft.name);
  useEffect(() => { setCfg({ ...DEFAULT_OPERATION_CONFIG, ...(draft.config ?? {}) }); setName(draft.name); }, [draft.id]);
  const issues = validateOperationConfig(cfg);

  // Estimated runs from sim context if available
  const pacing = simCtx.operationPacing;
  const r1 = pacing?.avgKillsPerRun ? Math.ceil(cfg.phaseTargets.phase1 / pacing.avgKillsPerRun) : null;
  const r2 = pacing?.avgScorePerRun ? Math.ceil(cfg.phaseTargets.phase2 / pacing.avgScorePerRun) : null;
  const r3 = pacing?.avgBossDmgPerRun ? Math.ceil(cfg.phaseTargets.phase3 / pacing.avgBossDmgPerRun) : null;

  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-4">
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Draft name</label>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-background/40 border border-border/60 text-sm" />
      </div>

      <div>
        <div className="text-xs font-semibold mb-2">Operation metadata</div>
        <input value={cfg.name} onChange={e => setCfg({ ...cfg, name: e.target.value })} placeholder="Operation name" className="w-full mb-2 px-3 py-2 rounded-lg bg-background/40 border border-border/60 text-sm" />
        <textarea value={cfg.flavor ?? ''} onChange={e => setCfg({ ...cfg, flavor: e.target.value })} placeholder="Flavor text (optional)" rows={2} className="w-full px-3 py-2 rounded-lg bg-background/40 border border-border/60 text-xs" />
      </div>

      <div>
        <div className="text-xs font-semibold mb-2">Phase targets</div>
        <div className="space-y-3">
          <NumField label="Phase 1 — Enemies neutralized" value={cfg.phaseTargets.phase1} min={100} max={50000} step={100}
            onChange={v => setCfg({ ...cfg, phaseTargets: { ...cfg.phaseTargets, phase1: v } })}
            hint={r1 ? `~${r1} runs at sim avg` : undefined} />
          <NumField label="Phase 2 — Score earned" value={cfg.phaseTargets.phase2} min={1000} max={5000000} step={1000}
            onChange={v => setCfg({ ...cfg, phaseTargets: { ...cfg.phaseTargets, phase2: v } })}
            hint={r2 ? `~${r2} runs at sim avg` : undefined} />
          <NumField label="Phase 3 — Boss damage" value={cfg.phaseTargets.phase3} min={1000} max={1000000} step={1000}
            onChange={v => setCfg({ ...cfg, phaseTargets: { ...cfg.phaseTargets, phase3: v } })}
            hint={r3 ? `~${r3} runs at sim avg` : undefined} />
        </div>
      </div>

      <div>
        <div className="text-xs font-semibold mb-2">Per-run cap &amp; min thresholds</div>
        <p className="text-[11px] text-muted-foreground mb-2">Server-side limits (mirrored from <code>submit_operation_contribution</code>).  Display-only here — DB enforces.</p>
        <NumField label="Per-run point cap" value={cfg.thresholds.perRunPointCap} min={500} max={50000} step={500}
          onChange={v => setCfg({ ...cfg, thresholds: { ...cfg.thresholds, perRunPointCap: v } })} />
        <NumField label="Expected group size" value={cfg.expectedGroupSize} min={1} max={20} step={1}
          onChange={v => setCfg({ ...cfg, expectedGroupSize: v })} />
      </div>

      <div className="rounded-xl border border-border/60 bg-background/40 p-3">
        <div className="text-xs font-semibold mb-1.5">Validation</div>
        <ValidationList issues={issues} />
      </div>

      <button
        onClick={() => onSave({ name, config: cfg })}
        disabled={saving}
        className="w-full px-3 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-100 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
      >
        <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Draft'}
      </button>
    </section>
  );
}

function EndlessEditor({ draft, onSave, saving }: { draft: MissionDraftRow; onSave: (p: any) => void; saving: boolean }) {
  const [cfg, setCfg] = useState<EndlessDraftConfig>({ ...defaultEndlessDraftConfig(), ...(draft.config ?? {}), scaling: { ...DEFAULT_ENDLESS_SCALING, ...(draft.config?.scaling ?? {}) } });
  const [name, setName] = useState(draft.name);
  useEffect(() => {
    setCfg({ ...defaultEndlessDraftConfig(), ...(draft.config ?? {}), scaling: { ...DEFAULT_ENDLESS_SCALING, ...(draft.config?.scaling ?? {}) } });
    setName(draft.name);
  }, [draft.id]);
  const issues = validateEndlessConfig(cfg);

  const setScaling = (patch: Partial<EndlessDraftConfig['scaling']>) =>
    setCfg(c => ({ ...c, scaling: { ...c.scaling, ...patch } }));

  return (
    <section className="rounded-2xl border border-border/60 bg-card/60 p-4 space-y-4">
      <div>
        <label className="text-[11px] text-muted-foreground uppercase tracking-wide">Draft name</label>
        <input value={name} onChange={e => setName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-background/40 border border-border/60 text-sm" />
      </div>

      <div>
        <div className="text-xs font-semibold mb-2">Mission core</div>
        <NumField label="Start energy" value={cfg.startEnergy} min={50} max={800} step={10} onChange={v => setCfg({ ...cfg, startEnergy: v })} />
        <NumField label="Base HP" value={cfg.baseHp} min={5} max={60} step={1} onChange={v => setCfg({ ...cfg, baseHp: v })} />
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Enemy HP scaling</div>
        <p className="text-[11px] text-muted-foreground mb-2">Increase late-wave pressure when sims show endless is too easy.</p>
        <NumField label="HP scaling starts at wave" value={cfg.scaling.hpStartWave} min={1} max={20} step={1} onChange={v => setScaling({ hpStartWave: v })} />
        <NumField label="HP added per wave (×)" value={cfg.scaling.hpPerWave} min={0} max={0.4} step={0.01} onChange={v => setScaling({ hpPerWave: v })} />
        <NumField label="HP cap (×)" value={cfg.scaling.hpCap} min={1} max={10} step={0.1} onChange={v => setScaling({ hpCap: v })} />
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Shield scaling</div>
        <NumField label="Shield starts at wave" value={cfg.scaling.shieldStartWave} min={1} max={30} step={1} onChange={v => setScaling({ shieldStartWave: v })} />
        <NumField label="Shield per wave (×)" value={cfg.scaling.shieldPerWave} min={0} max={0.3} step={0.01} onChange={v => setScaling({ shieldPerWave: v })} />
        <NumField label="Shield cap (×)" value={cfg.scaling.shieldCap} min={1} max={6} step={0.1} onChange={v => setScaling({ shieldCap: v })} />
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Speed scaling</div>
        <NumField label="Speed starts at wave" value={cfg.scaling.speedStartWave} min={1} max={30} step={1} onChange={v => setScaling({ speedStartWave: v })} />
        <NumField label="Speed per wave (×)" value={cfg.scaling.speedPerWave} min={0} max={0.05} step={0.001} onChange={v => setScaling({ speedPerWave: v })} />
        <NumField label="Speed cap (×)" value={cfg.scaling.speedCap} min={1} max={2} step={0.05} onChange={v => setScaling({ speedCap: v })} />
      </div>

      <div>
        <div className="text-xs font-semibold mb-1">Boss scaling</div>
        <NumField label="Boss HP per wave-index (×)" value={cfg.scaling.bossHpPerWave} min={0} max={0.15} step={0.005} onChange={v => setScaling({ bossHpPerWave: v })} />
        <NumField label="Boss HP cap (×)" value={cfg.scaling.bossHpCap} min={1} max={5} step={0.1} onChange={v => setScaling({ bossHpCap: v })} />
      </div>

      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
        <div className="text-xs font-semibold text-amber-200">Wave list</div>
        <p className="text-[11px] text-muted-foreground mt-1">
          {cfg.waves.length} waves · total enemies {cfg.waves.reduce((a, w) => a + w.spawns.reduce((s, x) => s + x.count, 0), 0)}.
          Inline wave editing ships in the next workshop pass — current draft preserves the live wave list and only re-tunes scaling.
        </p>
      </div>

      <div className="rounded-xl border border-border/60 bg-background/40 p-3">
        <div className="text-xs font-semibold mb-1.5">Validation</div>
        <ValidationList issues={issues} />
      </div>

      <button
        onClick={() => onSave({ name, config: cfg })}
        disabled={saving}
        className="w-full px-3 py-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-100 text-sm font-semibold flex items-center justify-center gap-2 active:scale-[0.98]"
      >
        <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Draft'}
      </button>
    </section>
  );
}

function NumField({ label, value, min, max, step, onChange, hint }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; hint?: string;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center justify-between text-xs">
        <label className="text-muted-foreground">{label}</label>
        <span className="font-semibold tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full mt-1 accent-emerald-500"
      />
      {hint && <div className="text-[10px] text-emerald-300 mt-0.5">{hint}</div>}
    </div>
  );
}
