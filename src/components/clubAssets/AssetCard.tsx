import { memo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Check, ChevronRight, Crown, FlaskConical,
  Bookmark, Sparkles, Shield, Trophy, TrendingUp, Lock,
  MessageSquareText, CalendarDays, ScrollText, Newspaper,
  MessageCircle, BarChart3, FileText, Link2, Star,
  Brackets, EyeOff, Settings,
} from 'lucide-react';
import type { PlatformAsset, InstalledAsset } from '@/types/assets';
import { CATEGORY_META } from '@/types/assets';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Bookmark, Sparkles, Shield, Trophy, TrendingUp, Lock,
  MessageSquareText, CalendarDays, ScrollText, Newspaper,
  MessageCircle, BarChart3, FileText, Link2, Star,
  Brackets, Settings,
};

const CATEGORY_BG: Record<string, string> = {
  games:          'from-primary/20 to-primary/8',
  social:         'from-blue-500/20 to-blue-500/8',
  events:         'from-orange-400/20 to-orange-400/8',
  'admin-tools':  'from-yellow-400/20 to-yellow-400/8',
  experimental:   'from-purple-500/20 to-purple-500/8',
};

interface AssetCardProps {
  asset: PlatformAsset;
  installed?: InstalledAsset;
  onInstall: (asset: PlatformAsset) => void;
  onConfigure: (installed: InstalledAsset) => void;
  onToggleEnabled: (installed: InstalledAsset) => void;
  onToggleVisible: (installed: InstalledAsset) => void;
}

export const AssetCard = memo(function AssetCard({
  asset, installed,
  onInstall, onConfigure, onToggleEnabled, onToggleVisible,
}: AssetCardProps) {
  const Icon = ICON_MAP[asset.icon_name] ?? Star;
  const isInstalled = !!installed;
  const isEnabled = installed?.enabled ?? false;
  const isHidden = installed ? !installed.visible_to_members : false;
  const categoryMeta = CATEGORY_META[asset.category] ?? { label: asset.category, color: 'hsl(var(--muted-foreground))' };
  const bgClass = CATEGORY_BG[asset.category] ?? 'from-muted/40 to-muted/10';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', damping: 24, stiffness: 300 }}
      className={cn(
        'glass-card p-4 flex flex-col gap-3 relative overflow-hidden',
        !isEnabled && isInstalled && 'opacity-60',
      )}
    >
      {/* Premium / experimental badges */}
      {asset.is_premium && (
        <span className="absolute top-3 right-3 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-yellow-400/15 text-yellow-500 border border-yellow-400/20">
          <Crown className="w-2.5 h-2.5" /> PRO
        </span>
      )}
      {asset.category === 'experimental' && (
        <span className="absolute top-3 right-3 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold bg-purple-500/15 text-purple-400 border border-purple-500/20">
          <FlaskConical className="w-2.5 h-2.5" /> BETA
        </span>
      )}

      {/* Header: icon + name */}
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0',
          'bg-gradient-to-br', bgClass,
        )}>
          <Icon className="w-5 h-5" style={{ color: categoryMeta.color }} />
        </div>

        <div className="flex-1 min-w-0 pr-8">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="font-extrabold text-[14px] tracking-tight leading-tight">{asset.name}</h3>
            {isInstalled && isEnabled && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-primary/12 text-primary border border-primary/20">
                <Check className="w-2.5 h-2.5" /> On
              </span>
            )}
            {isInstalled && !isEnabled && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-muted/50 text-muted-foreground/60 border border-border/20">
                Disabled
              </span>
            )}
            {isHidden && (
              <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-muted/40 text-muted-foreground/50 border border-border/20">
                <EyeOff className="w-2.5 h-2.5" /> Hidden
              </span>
            )}
          </div>
          <span
            className="text-[10px] font-bold uppercase tracking-[0.12em] mt-0.5 block"
            style={{ color: categoryMeta.color + 'cc' }}
          >
            {categoryMeta.label}
          </span>
        </div>
      </div>

      {/* Short description */}
      <p className="text-[12px] text-muted-foreground/75 leading-relaxed -mt-1">
        {asset.short_description}
      </p>

      {/* Action row */}
      <div className="flex items-center gap-2 mt-auto pt-1 border-t border-border/10">
        {!isInstalled ? (
          <button
            onClick={() => onInstall(asset)}
            className="flex-1 h-8 rounded-lg text-[11px] font-extrabold flex items-center justify-center gap-1.5 transition-all active:scale-95"
            style={{
              background: `linear-gradient(135deg, ${categoryMeta.color}22, ${categoryMeta.color}10)`,
              border: `1px solid ${categoryMeta.color}33`,
              color: categoryMeta.color,
            }}
          >
            Install <ChevronRight className="w-3 h-3" />
          </button>
        ) : (
          <>
            <button
              onClick={() => onConfigure(installed!)}
              className="flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-bold bg-muted/30 hover:bg-muted/50 text-foreground/70 transition-colors border border-border/15"
            >
              <Settings className="w-3 h-3" /> Configure
            </button>
            <button
              onClick={() => onToggleEnabled(installed!)}
              className={cn(
                'flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-bold transition-colors border',
                isEnabled
                  ? 'bg-destructive/8 hover:bg-destructive/15 text-destructive/80 border-destructive/15'
                  : 'bg-primary/8 hover:bg-primary/15 text-primary border-primary/20',
              )}
            >
              {isEnabled ? 'Disable' : 'Enable'}
            </button>
            <button
              onClick={() => onToggleVisible(installed!)}
              className="ml-auto p-1.5 rounded-lg hover:bg-muted/40 transition-colors text-muted-foreground/50 hover:text-muted-foreground/80"
              title={isHidden ? 'Show to members' : 'Hide from members'}
            >
              <EyeOff className={cn('w-3.5 h-3.5', !isHidden && 'opacity-30')} />
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
});
