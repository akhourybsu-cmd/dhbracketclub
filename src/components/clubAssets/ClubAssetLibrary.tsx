import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, Package, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useClubAssets } from '@/hooks/useClubAssets';
import { AssetCard } from './AssetCard';
import { InstallAssetSheet } from './InstallAssetSheet';
import type { PlatformAsset, InstalledAsset } from '@/types/assets';
import { toast } from 'sonner';

type FilterTab = 'all' | 'installed' | 'games' | 'social' | 'events' | 'admin-tools' | 'experimental';

const TABS: { id: FilterTab; label: string }[] = [
  { id: 'all',          label: 'All' },
  { id: 'installed',    label: 'Installed' },
  { id: 'games',        label: 'Games' },
  { id: 'social',       label: 'Social' },
  { id: 'events',       label: 'Events' },
  { id: 'admin-tools',  label: 'Admin' },
  { id: 'experimental', label: 'Beta' },
];

export function ClubAssetLibrary() {
  const {
    allAssets, installedAssets, loading,
    install, uninstall, setEnabled, setVisible,
    refresh,
  } = useClubAssets();

  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [search, setSearch] = useState('');
  const [sheetAsset, setSheetAsset] = useState<PlatformAsset | null>(null);
  const [installing, setInstalling] = useState(false);

  const installedMap = useMemo(() =>
    new Map(installedAssets.map(ia => [ia.asset_id, ia])),
    [installedAssets]);

  const filtered = useMemo(() => {
    let assets = allAssets;
    if (activeTab === 'installed') {
      assets = assets.filter(a => installedMap.has(a.id));
    } else if (activeTab !== 'all') {
      assets = assets.filter(a => a.category === activeTab);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      assets = assets.filter(a =>
        a.name.toLowerCase().includes(q) ||
        a.short_description.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q),
      );
    }
    return assets;
  }, [allAssets, installedMap, activeTab, search]);

  const installedCount = installedAssets.length;

  const handleInstall = useCallback(async (asset: PlatformAsset) => {
    setInstalling(true);
    try {
      await install(asset.id);
    } catch {
      toast.error('Failed to install asset');
    } finally {
      setInstalling(false);
    }
  }, [install]);

  const handleUninstall = useCallback(async (installed: InstalledAsset) => {
    try {
      await uninstall(installed.id);
      toast.success(`${installed.asset.name} removed`);
    } catch {
      toast.error('Failed to remove asset');
    }
  }, [uninstall]);

  const handleToggleEnabled = useCallback(async (installed: InstalledAsset) => {
    try {
      await setEnabled(installed.id, !installed.enabled);
      toast.success(installed.enabled ? 'Asset disabled' : 'Asset enabled');
    } catch {
      toast.error('Failed to update asset');
    }
  }, [setEnabled]);

  const handleToggleVisible = useCallback(async (installed: InstalledAsset) => {
    try {
      await setVisible(installed.id, !installed.visible_to_members);
      toast.success(installed.visible_to_members ? 'Hidden from members' : 'Visible to members');
    } catch {
      toast.error('Failed to update asset');
    }
  }, [setVisible]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground/50" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-extrabold text-[17px] tracking-tight">Asset Library</h2>
          <p className="text-[11px] text-muted-foreground/65 mt-0.5">
            {installedCount > 0
              ? `${installedCount} asset${installedCount !== 1 ? 's' : ''} installed`
              : 'No assets installed — browse below to add features'}
          </p>
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10 border border-primary/15">
          <Package className="w-4.5 h-4.5 text-primary/80" />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search features…"
          className="pl-9 pr-9 h-9 text-sm bg-muted/20 border-border/20 rounded-xl"
        />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-muted/50">
            <X className="w-3.5 h-3.5 text-muted-foreground/60" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-0.5 scrollbar-none -mx-0.5 px-0.5">
        {TABS.map(tab => {
          const count = tab.id === 'installed'
            ? installedCount
            : tab.id === 'all'
            ? allAssets.length
            : allAssets.filter(a => a.category === tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-shrink-0 flex items-center gap-1 px-3 h-7 rounded-full text-[11px] font-bold transition-all whitespace-nowrap',
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/30 text-muted-foreground/70 hover:bg-muted/50 border border-border/15',
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className={cn(
                  'text-[9px] font-extrabold px-1 py-0.5 rounded-full min-w-[16px] text-center',
                  activeTab === tab.id ? 'bg-white/20' : 'bg-muted/60',
                )}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Asset grid */}
      <AnimatePresence mode="popLayout">
        {filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-16"
          >
            <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-semibold text-muted-foreground/60">
              {search ? 'No assets match your search' : 'Nothing in this category yet'}
            </p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map(asset => (
              <AssetCard
                key={asset.id}
                asset={asset}
                installed={installedMap.get(asset.id)}
                onInstall={a => setSheetAsset(a)}
                onConfigure={ia => toast.info(`Configure ${ia.asset.name} — coming soon`)}
                onToggleEnabled={handleToggleEnabled}
                onToggleVisible={handleToggleVisible}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      {/* Install bottom sheet */}
      <InstallAssetSheet
        asset={sheetAsset}
        open={!!sheetAsset}
        installing={installing}
        onClose={() => setSheetAsset(null)}
        onInstall={handleInstall}
        onConfigureNow={a => toast.info(`Configure ${a.name} — coming soon`)}
      />
    </div>
  );
}
