import { MissionDef } from './types';

// 6 missions in Sector I "Outer Rim" — last is a boss.
export const MISSIONS: MissionDef[] = [
  {
    id: 1,
    name: 'First Contact',
    sector: 'Outer Rim',
    startEnergy: 180,
    baseHp: 20,
    rewardCores: 25,
    waves: [
      { index: 0, rewardEnergy: 40, spawns: [{ enemy: 'drone', count: 8, intervalMs: 900 }] },
      { index: 1, rewardEnergy: 50, spawns: [{ enemy: 'drone', count: 14, intervalMs: 700 }] },
      { index: 2, rewardEnergy: 60, spawns: [
        { enemy: 'drone', count: 10, intervalMs: 600 },
        { enemy: 'walker', count: 2, intervalMs: 1500, delayMs: 2000 },
      ] },
    ],
  },
  {
    id: 2,
    name: 'Heavy Footprint',
    sector: 'Outer Rim',
    startEnergy: 200,
    baseHp: 22,
    rewardCores: 35,
    modifier: { label: 'Reinforced Hulls', description: 'Walkers have +25% HP.' },
    waves: [
      { index: 0, rewardEnergy: 50, spawns: [{ enemy: 'drone', count: 12, intervalMs: 700 }] },
      { index: 1, rewardEnergy: 60, spawns: [
        { enemy: 'walker', count: 4, intervalMs: 1400 },
        { enemy: 'drone', count: 8, intervalMs: 600, delayMs: 1500 },
      ] },
      { index: 2, rewardEnergy: 70, spawns: [
        { enemy: 'walker', count: 6, intervalMs: 1100 },
        { enemy: 'drone', count: 16, intervalMs: 500, delayMs: 1500 },
      ] },
      { index: 3, rewardEnergy: 90, spawns: [
        { enemy: 'walker', count: 8, intervalMs: 1000 },
      ] },
    ],
  },
  {
    id: 3,
    name: 'Shield Wall',
    sector: 'Outer Rim',
    startEnergy: 220,
    baseHp: 22,
    rewardCores: 45,
    modifier: { label: 'Shielded Vanguard', description: 'Shielded Troopers regenerate 10 shield/sec.' },
    waves: [
      { index: 0, rewardEnergy: 60, spawns: [{ enemy: 'shielded', count: 5, intervalMs: 1200 }] },
      { index: 1, rewardEnergy: 70, spawns: [
        { enemy: 'shielded', count: 8, intervalMs: 1000 },
        { enemy: 'drone', count: 10, intervalMs: 500, delayMs: 1200 },
      ] },
      { index: 2, rewardEnergy: 80, spawns: [
        { enemy: 'shielded', count: 6, intervalMs: 900 },
        { enemy: 'walker', count: 4, intervalMs: 1300, delayMs: 2000 },
      ] },
      { index: 3, rewardEnergy: 100, spawns: [
        { enemy: 'shielded', count: 12, intervalMs: 800 },
        { enemy: 'walker', count: 6, intervalMs: 1100, delayMs: 1500 },
      ] },
    ],
  },
  {
    id: 4,
    name: 'Ghost Signal',
    sector: 'Outer Rim',
    startEnergy: 240,
    baseHp: 22,
    rewardCores: 55,
    modifier: { label: 'Cloaked Approach', description: 'Stealth units only visible to Rail Battery.' },
    waves: [
      { index: 0, rewardEnergy: 60, spawns: [{ enemy: 'stealth', count: 4, intervalMs: 1300 }] },
      { index: 1, rewardEnergy: 70, spawns: [
        { enemy: 'stealth', count: 6, intervalMs: 1100 },
        { enemy: 'drone', count: 12, intervalMs: 500, delayMs: 1000 },
      ] },
      { index: 2, rewardEnergy: 90, spawns: [
        { enemy: 'stealth', count: 8, intervalMs: 900 },
        { enemy: 'shielded', count: 4, intervalMs: 1200, delayMs: 1500 },
      ] },
      { index: 3, rewardEnergy: 110, spawns: [
        { enemy: 'stealth', count: 10, intervalMs: 800 },
        { enemy: 'walker', count: 6, intervalMs: 1100, delayMs: 1200 },
      ] },
    ],
  },
  {
    id: 5,
    name: 'Convergence',
    sector: 'Outer Rim',
    startEnergy: 280,
    baseHp: 25,
    rewardCores: 70,
    modifier: { label: 'Mixed Assault', description: 'All enemy types appear together.' },
    waves: [
      { index: 0, rewardEnergy: 60, spawns: [
        { enemy: 'drone', count: 14, intervalMs: 500 },
        { enemy: 'walker', count: 4, intervalMs: 1400, delayMs: 1500 },
      ] },
      { index: 1, rewardEnergy: 80, spawns: [
        { enemy: 'shielded', count: 6, intervalMs: 1000 },
        { enemy: 'stealth', count: 4, intervalMs: 1200, delayMs: 1000 },
      ] },
      { index: 2, rewardEnergy: 100, spawns: [
        { enemy: 'walker', count: 6, intervalMs: 1100 },
        { enemy: 'shielded', count: 6, intervalMs: 1000, delayMs: 1500 },
        { enemy: 'stealth', count: 4, intervalMs: 1100, delayMs: 3000 },
      ] },
      { index: 3, rewardEnergy: 130, spawns: [
        { enemy: 'drone', count: 20, intervalMs: 400 },
        { enemy: 'walker', count: 8, intervalMs: 900, delayMs: 1500 },
        { enemy: 'shielded', count: 8, intervalMs: 900, delayMs: 2500 },
        { enemy: 'stealth', count: 6, intervalMs: 1000, delayMs: 4000 },
      ] },
    ],
  },
  {
    id: 6,
    name: 'Siege of the Nexus',
    sector: 'Outer Rim',
    startEnergy: 320,
    baseHp: 30,
    rewardCores: 120,
    isBoss: true,
    modifier: { label: 'BOSS · Siege Mech inbound', description: 'Survive the assault, then face the Siege Mech.' },
    waves: [
      { index: 0, rewardEnergy: 80, spawns: [
        { enemy: 'drone', count: 18, intervalMs: 450 },
        { enemy: 'shielded', count: 4, intervalMs: 1200, delayMs: 2000 },
      ] },
      { index: 1, rewardEnergy: 100, spawns: [
        { enemy: 'walker', count: 8, intervalMs: 900 },
        { enemy: 'stealth', count: 6, intervalMs: 1100, delayMs: 1500 },
      ] },
      { index: 2, rewardEnergy: 120, spawns: [
        { enemy: 'shielded', count: 10, intervalMs: 800 },
        { enemy: 'walker', count: 6, intervalMs: 1100, delayMs: 1500 },
        { enemy: 'drone', count: 18, intervalMs: 400, delayMs: 2500 },
      ] },
      { index: 3, rewardEnergy: 200, spawns: [
        { enemy: 'boss', count: 1, intervalMs: 1000 },
        { enemy: 'shielded', count: 8, intervalMs: 1000, delayMs: 4000 },
        { enemy: 'walker', count: 8, intervalMs: 900, delayMs: 6000 },
      ] },
    ],
  },
];

export function getMission(id: number): MissionDef | undefined {
  return MISSIONS.find(m => m.id === id);
}
