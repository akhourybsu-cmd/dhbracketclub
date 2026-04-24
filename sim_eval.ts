import { simulateLevel } from '@/lib/runedelve/simulator';
import { generateLevel } from '@/lib/runedelve/levelGenerator';
import { CLASS_LIST } from '@/lib/runedelve/classConfig';

const RUNS = 80;
const start = 1, end = 30;
console.log(`Level | Class    | Win% | AvgTurns | DmgOut | DmgIn | MinHP | Enemies(HP/Dmg) | Turns | BossRule`);
console.log('-'.repeat(130));
for (let lvl = start; lvl <= end; lvl++) {
  const def = generateLevel(lvl);
  const enemies = def.enemy_config.map(e => `${e.hp}/${e.damage}`).join(',');
  const totalHp = def.enemy_config.reduce((s,e)=>s+e.maxHp,0);
  const wave2 = (def.modifiers as any).waves?.[0]?.enemies?.map((e:any)=>`${e.hp}/${e.damage}`).join(',') ?? '';
  const br = (def.modifiers as any).boss_rule ?? '';
  for (const c of CLASS_LIST) {
    const { aggregate: a } = simulateLevel(lvl, c.id, RUNS);
    const flag = a.clearRate < 0.15 ? ' ⚠️BRUTAL' : a.clearRate < 0.45 ? ' ⚠️Hard' : '';
    console.log(`${String(lvl).padStart(3)} | ${c.id.padEnd(8)} | ${(a.clearRate*100).toFixed(0).padStart(3)}% | ${a.avgTurnsUsed.toFixed(1).padStart(5)} | ${a.avgDamageDealt.toFixed(0).padStart(5)} | ${a.avgDamageTaken.toFixed(0).padStart(4)} | ${a.avgMinHp.toFixed(0).padStart(4)} | ${enemies}${wave2?' +w2:'+wave2:''} | T${def.turn_limit} | ${br}${flag}`);
  }
  console.log('');
}
