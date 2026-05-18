import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Package, CheckCircle2, XCircle, Crown, FlaskConical,
  Loader2, RefreshCw, BarChart3,
  Bookmark, Sparkles, Shield, Trophy, TrendingUp, Lock,
  MessageSquareText, CalendarDays, ScrollText, Newspaper,
  MessageCircle, FileText, Link2, Star, Brackets, BookOpen,
} from 'lucide-react';
import type { PlatformAsset } from '@/types/assets';
import { CATEGORY_META } from '@/types/assets';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bookmark, Sparkles, Shield, Trophy, TrendingUp, Lock,
  MessageSquareText, CalendarDays, ScrollText, Newspaper,
  MessageCircle, BarChart3, FileText, Link2, Star, Brackets, BookOpen,
};

interface AssetWithStats extends PlatformAsset {
  install_count?: number;
}

export default function AdminAssetCatalogPage() {
  const [assets, setAssets] = useState<AssetWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState<string | null>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await (supabase as any)
        .from('platform_assets')
        .select('*')
        .order('sort_order');

      if (!data) { setAssets([]); return; }

      // Fetch install counts per asset
      const { data: installed } = await (supabase as any)
        .from('club_installed_assets')
        .select('asset_id');

      const countMap = new Map<string, number>();
      (installed ?? []).forEach((r: any) => {
        countMap.set(r.asset_id, (countMap.get(r.asset_id) ?? 0) + 1);
      });

      setAssets((data as PlatformAsset[]).map(a => ({
        ...a,
        install_count: countMap.get(a.id) ?? 0,
      })));
    } catch {
      toast.error('Could not load asset catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const toggleActive = async (asset: AssetWithStats) => {
    setToggling(asset.id);
    try {
      await (supabase as any)
        .from('platform_assets')
        .update({ is_active: !asset.is_active })
        .eq('id', asset.id);
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, is_active: !a.is_active } : a));
      toast.success(`${asset.name} ${asset.is_active ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Update failed');
    } finally {
      setToggling(null);
    }
  };

  const togglePremium = async (asset: AssetWithStats) => {
    setToggling(asset.id);
    try {
      await (supabase as any)
        .from('platform_assets')
        .update({ is_premium: !asset.is_premium })
        .eq('id', asset.id);
      setAssets(prev => prev.map(a => a.id === asset.id ? { ...a, is_premium: !a.is_premium } : a));
      toast.success(`${asset.name} ${asset.is_premium ? 'unmarked' : 'marked'} as premium`);
    } catch {
      toast.error('Update failed');
    } finally {
      setToggling(null);
    }
  };

  const totalInstalls = assets.reduce((sum, a) => sum + (a.install_count ?? 0), 0);
  const activeCount   = assets.filter(a => a.is_active).length;

  return (
    <AdminLayout title="Asset Catalog" subtitle="Manage platform features available to clubs">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Total Assets',    value: assets.length, icon: Package },
          { label: 'Active',          value: activeCount,   icon: CheckCircle2 },
          { label: 'Club Installs',   value: totalInstalls, icon: BarChart3 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="glass-card p-3 text-center">
            <Icon className="w-4 h-4 text-muted-foreground/60 mx-auto mb-1" />
            <p className="font-extrabold text-[18px] leading-none">{value}</p>
            <p className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-[0.1em] mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Refresh */}
      <div className="flex justify-end mb-3">
        <button
          onClick={fetchAssets}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 h-8 rounded-lg text-[11px] font-bold bg-muted/30 hover:bg-muted/50 text-muted-foreground/70 transition-colors border border-border/15"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/50" />
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map((asset, i) => {
            const Icon = ICON_MAP[asset.icon_name] ?? Star;
            const categoryMeta = CATEGORY_META[asset.category] ?? { label: asset.category, color: 'hsl(var(--muted-foreground))' };
            const isBusy = toggling === asset.id;

            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                className={cn(
                  'glass-card p-3.5 flex items-center gap-3',
                  !asset.is_active && 'opacity-50',
                )}
              >
                {/* Icon */}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${categoryMeta.color}22, ${categoryMeta.color}08)` }}
                >
                  <Icon className="w-4 h-4" style={{ color: categoryMeta.color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-[13px] truncate">{asset.name}</span>
                    {asset.is_premium && (
                      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-extrabold bg-yellow-400/15 text-yellow-500">
                        <Crown className="w-2 h-2" /> PRO
                      </span>
                    )}
                    {asset.category === 'experimental' && (
                      <span className="flex items-center gap-0.5 px-1 py-0.5 rounded text-[8px] font-extrabold bg-purple-500/15 text-purple-400">
                        <FlaskConical className="w-2 h-2" /> BETA
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] font-bold" style={{ color: categoryMeta.color + 'bb' }}>
                      {categoryMeta.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">
                      {asset.install_count} club{asset.install_count !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => togglePremium(asset)}
                    disabled={isBusy}
                    title={asset.is_premium ? 'Remove PRO flag' : 'Mark as PRO'}
                    className={cn(
                      'p-1.5 rounded-lg transition-colors border text-[10px]',
                      asset.is_premium
                        ? 'bg-yellow-400/15 border-yellow-400/25 text-yellow-500'
                        : 'bg-muted/20 border-border/15 text-muted-foreground/50 hover:bg-muted/40',
                    )}
                  >
                    <Crown className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => toggleActive(asset)}
                    disabled={isBusy}
                    title={asset.is_active ? 'Deactivate' : 'Activate'}
                    className={cn(
                      'flex items-center gap-1 px-2 h-7 rounded-lg text-[10px] font-bold border transition-colors',
                      asset.is_active
                        ? 'bg-primary/8 border-primary/20 text-primary hover:bg-destructive/8 hover:border-destructive/20 hover:text-destructive'
                        : 'bg-muted/20 border-border/15 text-muted-foreground/60 hover:bg-primary/8 hover:border-primary/20 hover:text-primary',
                    )}
                  >
                    {isBusy ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : asset.is_active ? (
                      <><CheckCircle2 className="w-3 h-3" /> Active</>
                    ) : (
                      <><XCircle className="w-3 h-3" /> Off</>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {!loading && assets.length === 0 && (
        <div className="text-center py-16">
          <Package className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm font-semibold text-muted-foreground/60">No assets found</p>
          <p className="text-xs text-muted-foreground/40 mt-1">Run the platform-assets migration to seed the catalog</p>
        </div>
      )}
    </AdminLayout>
  );
}
