import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useClub } from '@/contexts/ClubContext';
import { useAuth } from '@/contexts/AuthContext';
import type { PlatformAsset, InstalledAsset } from '@/types/assets';
import { NAV_ASSET_SLUGS } from '@/types/assets';

interface UseClubAssetsReturn {
  installedAssets: InstalledAsset[];
  allAssets: PlatformAsset[];
  loading: boolean;
  /** True if slug is installed AND enabled for this club */
  isInstalled: (slug: string) => boolean;
  /** True if slug is installed, enabled, AND visible_to_members */
  isVisible: (slug: string) => boolean;
  /**
   * Filter a nav path list: if the club has configured any assets,
   * only paths whose slugs are installed+visible are returned.
   * If nothing is configured yet, all paths pass through (backward compat).
   */
  filterNavPaths: (paths: string[]) => string[];
  install: (assetId: string) => Promise<void>;
  uninstall: (installedId: string) => Promise<void>;
  setEnabled: (installedId: string, enabled: boolean) => Promise<void>;
  setVisible: (installedId: string, visible: boolean) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useClubAssets(): UseClubAssetsReturn {
  const { club } = useClub();
  const { user } = useAuth();
  const [installedAssets, setInstalledAssets] = useState<InstalledAsset[]>([]);
  const [allAssets, setAllAssets] = useState<PlatformAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssets = useCallback(async () => {
    if (!club) { setLoading(false); return; }
    setLoading(true);
    try {
      const [{ data: platform, error: platErr }, { data: installed, error: instErr }] = await Promise.all([
        (supabase as any).from('platform_assets')
          .select('*')
          .eq('is_active', true)
          .order('sort_order'),
        (supabase as any).from('club_installed_assets')
          .select('*, asset:platform_assets(*)')
          .eq('club_id', club.id)
          .order('sort_order'),
      ]);
      if (platErr) {
        console.error('[useClubAssets] platform_assets fetch error:', platErr.message, platErr.code);
      }
      if (instErr) {
        console.error('[useClubAssets] club_installed_assets fetch error:', instErr.message, instErr.code);
      }
      setAllAssets((platform as PlatformAsset[]) ?? []);
      setInstalledAssets((installed as InstalledAsset[]) ?? []);
    } catch (err) {
      console.error('[useClubAssets] unexpected fetch error:', err);
      setAllAssets([]);
      setInstalledAssets([]);
    } finally {
      setLoading(false);
    }
  }, [club?.id]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const isInstalled = useCallback((slug: string) =>
    installedAssets.some(ia => ia.asset?.slug === slug && ia.enabled),
    [installedAssets]);

  const isVisible = useCallback((slug: string) => {
    const ia = installedAssets.find(ia => ia.asset?.slug === slug);
    if (!ia) return false; // not installed = not visible
    return ia.enabled && ia.visible_to_members;
  }, [installedAssets]);

  const filterNavPaths = useCallback((paths: string[]) => {
    // If the catalog table isn't seeded yet (no platform assets exist), pass everything
    // through so the nav doesn't go blank in uninitialized environments.
    if (allAssets.length === 0) return paths;
    return paths.filter(p => {
      const slug = NAV_ASSET_SLUGS[p];
      if (!slug) return true; // non-asset paths always pass (dashboard, compete, profile…)
      return isVisible(slug);
    });
  }, [allAssets, isVisible]);

  const install = useCallback(async (assetId: string) => {
    if (!club || !user) return;
    await (supabase as any).from('club_installed_assets').insert({
      club_id: club.id,
      asset_id: assetId,
      installed_by: user.id,
      enabled: true,
      visible_to_members: true,
    });
    await fetchAssets();
  }, [club, user, fetchAssets]);

  const uninstall = useCallback(async (installedId: string) => {
    await (supabase as any).from('club_installed_assets').delete().eq('id', installedId);
    await fetchAssets();
  }, [fetchAssets]);

  const setEnabled = useCallback(async (installedId: string, enabled: boolean) => {
    await (supabase as any).from('club_installed_assets')
      .update({ enabled })
      .eq('id', installedId);
    setInstalledAssets(prev =>
      prev.map(ia => ia.id === installedId ? { ...ia, enabled } : ia));
  }, []);

  const setVisible = useCallback(async (installedId: string, visible_to_members: boolean) => {
    await (supabase as any).from('club_installed_assets')
      .update({ visible_to_members })
      .eq('id', installedId);
    setInstalledAssets(prev =>
      prev.map(ia => ia.id === installedId ? { ...ia, visible_to_members } : ia));
  }, []);

  return {
    installedAssets, allAssets, loading,
    isInstalled, isVisible, filterNavPaths,
    install, uninstall, setEnabled, setVisible,
    refresh: fetchAssets,
  };
}
