import { Shield, ShieldCheck, ShieldPlus, Star, Target, Crosshair, Crown, type LucideIcon } from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  shield: Shield,
  'shield-check': ShieldCheck,
  'shield-plus': ShieldPlus,
  star: Star,
  target: Target,
  crosshair: Crosshair,
  crown: Crown,
};

/** Resolves a sigil icon code (from the catalog) to a Lucide component. */
export function SigilGlyph({ icon, className }: { icon: string; className?: string }) {
  const Icon = ICON_MAP[icon] ?? Shield;
  return <Icon className={className} />;
}
