// Nexus Defense — Featured Mission Card
//
// Daily-rotating "Featured Operation" highlight on the hub. The featured
// mission is selected deterministically from the date so all clients see
// the same featured op on the same day. Locked missions degrade gracefully
// to a "complete prior missions" hint without breaking the layout.

import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Star, Lock, ChevronRight } from 'lucide-react';
import { MapLayoutPreview } from './MapLayoutPreview';
import { getLayout } from '@/lib/nexus/mapLayouts';
import { getBriefing, getFeaturedMissionId } from '@/lib/nexus/missionBriefings';
import type { MissionDef } from '@/lib/nexus/types';

interface Props {
  campaign: MissionDef[];
  highestMission: number;
}

export function FeaturedMissionCard({ campaign, highestMission }: Props) {
  if (campaign.length === 0) return null;

  const featuredId = getFeaturedMissionId(new Date());
  const mission = campaign.find(m => m.id === featuredId) ?? campaign[0];
  const briefing = getBriefing(mission.id);
  const layout = getLayout(briefing?.layoutId);
  const unlocked = mission.id <= highestMission;
  const accent = layout?.preview.accent ?? 'hsl(var(--nx-amber))';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative nx-clip-sm overflow-hidden mb-3"
      style={{
        background:
          'radial-gradient(ellipse 85% 65% at 100% 0%, ' +
          accent.replace(')', ' / 0.20)') +
          ', transparent 60%),' +
          'linear-gradient(180deg, hsl(218 35% 11%), hsl(218 38% 7%))',
        border: `1px solid ${accent.replace(')', ' / 0.45)')}`,
        boxShadow: `0 0 14px -6px ${accent.replace(')', ' / 0.4)')}`,
      }}
    >
      <Link
        to={unlocked ? `/nexus/loadout/${mission.id}` : '#'}
        className={`relative block p-3 ${!unlocked ? 'pointer-events-none' : 'active:scale-[0.99] transition'}`}
        aria-disabled={!unlocked}
      >
        <div className="flex items-center gap-3">
          {layout ? (
            <div className="flex-shrink-0">
              <MapLayoutPreview layout={layout} size="md" pulse={unlocked} />
            </div>
          ) : (
            <div
              className="w-[96px] h-[96px] flex-shrink-0 nx-clip-sm flex items-center justify-center"
              style={{ background: 'hsl(218 35% 7%)', border: `1px solid ${accent.replace(')', ' / 0.3)')}` }}
            >
              <Star className="w-7 h-7" style={{ color: accent }} />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Star className="w-3 h-3 flex-shrink-0" style={{ color: accent }} fill="currentColor" />
              <p className="nx-title text-[9px]" style={{ color: accent, letterSpacing: '0.22em' }}>
                FEATURED OPERATION · TODAY
              </p>
            </div>
            <h3 className="text-[14px] font-black tracking-tight leading-tight truncate">{mission.name}</h3>
            <p className="text-[10.5px] text-foreground/70 leading-snug mt-0.5 line-clamp-2">
              {briefing?.tagline ?? `Sector I · ${mission.waves.length} waves · ${mission.rewardCores} cores`}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <span className="nx-title text-[8px]" style={{ color: 'hsl(0 0% 100% / 0.55)', letterSpacing: '0.2em' }}>
                {mission.waves.length} WAVES · {mission.rewardCores} CORES
              </span>
              {unlocked ? (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-black" style={{ color: accent }}>
                  Deploy <ChevronRight className="w-3 h-3" />
                </span>
              ) : (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold text-foreground/55">
                  <Lock className="w-3 h-3" /> Clear M{highestMission} first
                </span>
              )}
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
